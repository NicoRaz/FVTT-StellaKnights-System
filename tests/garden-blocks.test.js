import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,user} from './runtime-fixture.js';
import {ID} from '../module/rules.js';
import {newBlock,validateBlocks} from '../module/skill-blocks.js';
import {execute} from '../module/engine.js';
const block=(op,values={})=>({...newBlock(),op,...values});
async function regionSetup(){const f=await setup();foundry.data={fields:{NumberField:class{constructor(options){Object.assign(this,options);}}},regionBehaviors:{RegionBehaviorType:class{static defineSchema(){throw Error('The GardenRegionBehavior subclass of DataModel must define its Document schema');}}}};globalThis.CONST={REGION_EVENTS:{TOKEN_ENTER:'tokenEnter',TOKEN_MOVE_WITHIN:'tokenMoveWithin',BEHAVIOR_ACTIVATED:'behaviorActivated',REGION_BOUNDARY:'regionBoundary'}};return {...f,...await import('../module/garden-region.js')};}
test('Garden schema loads during startup localization without calling the abstract parent schema',async()=>{
 const {GardenRegionBehavior,registerGardenRegion,GARDEN_BEHAVIOR}=await regionSetup();
 CONFIG.RegionBehavior={dataModels:{},typeLabels:{},typeIcons:{}};
 globalThis.Hooks={on(){}};
 registerGardenRegion();
 // Foundry localization requests the schema of each registered model before ready.
 const schema=CONFIG.RegionBehavior.dataModels[GARDEN_BEHAVIOR].defineSchema();
 assert.equal(CONFIG.RegionBehavior.dataModels[GARDEN_BEHAVIOR],GardenRegionBehavior);
 assert.deepEqual(Object.keys(schema),['garden']);
 assert.equal(schema.garden.initial,1);assert.equal(schema.garden.min,1);assert.equal(schema.garden.max,6);
 assert.equal(schema.garden.integer,true);assert.equal(schema.garden.required,true);
});
function token(actor){return {actor,flags:{},getFlag(ns,key){return this.flags[ns]?.[key]},async setFlag(ns,key,value){(this.flags[ns]??={})[key]=value;}};}
test('Garden behavior assigns all tokens inside and applies changed values on activation',async()=>{
 const {knight,ally,assignGarden,syncGardenRegion,GARDEN_BEHAVIOR}=await regionSetup();const tokens=[token(knight),token(ally),token(null)];
 const region={tokens:new Set(tokens),behaviors:[{type:GARDEN_BEHAVIOR,system:{garden:4},disabled:false}]};await syncGardenRegion(region);
 assert.equal(knight.system.garden,4);assert.equal(ally.system.garden,4);assert.ok(tokens.every(t=>t.getFlag(ID,'garden')===4));
 region.behaviors[0].system.garden=6;await syncGardenRegion(region);assert.equal(knight.system.garden,6);
 region.behaviors[0].disabled=true;region.behaviors[0].system.garden=2;await syncGardenRegion(region);assert.equal(knight.system.garden,6);
});
test('Garden enter updates the arriving token and runs on one GM only',async()=>{
 const {knight,GardenRegionBehavior}=await regionSetup();const t=token(knight);
 await GardenRegionBehavior.events.tokenEnter.call({garden:3},{data:{token:t}});assert.equal(knight.system.garden,3);
 game.user=user(knight.id);await GardenRegionBehavior.events.tokenMoveWithin.call({garden:5},{data:{token:t}});assert.equal(knight.system.garden,3);
});
test('Block script rolls, branches, repeats, uses locked targets and current Round',async()=>{
 const {knight,enemy,rig}=await setup();const item=knight.items.find(i=>i.type==='ability');item.system.scriptEnabled=true;item.system.charge=1;
 item.system.blocks=[block('roll',{value:2}),block('if',{value:5}),block('damage',{source:'roll'}),block('repeat',{value:2}),block('heal',{target:'self',value:1}),block('modifier',{source:'round',stat:'attack',target:'self'})];
 rig([3,4]);await execute('use',{actor:knight.id,item:item.id,targets:[enemy.id],directUse:true},user(knight.id));
 assert.equal(enemy.system.hp.value,9);assert.equal(knight.system.hp.value,18);assert.equal(item.system.charge,0);assert.equal(knight.system.modifiers.at(-1).value,1);
});
test('Block Attack ignores Garden, Set dice blocks choose a face and healing can revive',async()=>{
 const {knight,enemy,rig}=await setup();knight.system.garden=1;enemy.system.garden=4;enemy.system.hp.value=0;
 const item=knight.items.find(i=>i.type==='ability');item.system.scriptEnabled=true;
 item.system.blocks=[block('heal',{value:5}),block('attack',{value:2}),block('charge',{value:2,face:6,target:'self'})];rig([4,5]);
 await execute('use',{actor:knight.id,item:item.id,targets:[enemy.id]},user(knight.id));
 assert.equal(enemy.system.hp.value,3);assert.equal(knight.items.find(i=>i.system.number===6).system.charge,2);assert.equal(statePending(),null);
});
function statePending(){return game.settings.get(ID,'battle').pending;}
test('Block script rejects unknown code, unsafe repeats and unauthorized actors before writes',async()=>{
 const {knight}=await setup();const item=knight.items.find(i=>i.type==='ability');item.system.scriptEnabled=true;item.system.charge=3;item.system.blocks=[block('eval',{text:'alert(1)'})];
 await assert.rejects(execute('use',{actor:knight.id,item:item.id,targets:[]},user(knight.id)),/Unknown block/);assert.equal(item.system.charge,3);
 item.system.blocks=[block('damage')];await assert.rejects(execute('use',{actor:knight.id,item:item.id,targets:[]},user('outsider')),/own/);
 assert.throws(()=>validateBlocks([block('repeat',{value:11}),block('damage')]),/10 repetitions/);
 assert.throws(()=>validateBlocks([block('if')]),/followed/);
});
