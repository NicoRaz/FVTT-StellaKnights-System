import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {setup,user,Collection} from './runtime-fixture.js';
import {ID} from '../module/rules.js';
import {state,saveState} from '../module/helpers.js';
import {execute} from '../module/engine.js';
import {ensureCombat} from '../module/combat-state.js';
import {registerSocket} from '../module/socket.js';
import {stageDocument} from '../module/stage-data.js';
async function encounter(preset=null){
 const f=await setup();await game.settings.set(ID,'directorMode',true);await saveState({...state(),active:false});
 if(preset){const record=JSON.parse(fs.readFileSync('data/stages.json')).find(r=>r.id===preset);const data=stageDocument(record);f.stage.system=data.system;f.stage.name=data.name;await f.stage.createEmbeddedDocuments('Item',data.items);}
 const {StellaCombat}=await import('../module/combat.js');CONFIG.Combat.documentClass=StellaCombat;game.socket={on(){},emit(){}};registerSocket(execute);
 const combat=await ensureCombat([f.knight,f.ally,f.enemy,f.stage]);return {...f,combat};
}
test('Begin Combat requires a Stage Token, not just a Stage Actor or tokenless Combatant',async()=>{
 const {combat}=await encounter();const stage=combat.combatants.find(c=>c.actor.type==='stage');
 stage.tokenId=null;await assert.rejects(combat.startCombat(),/Stage Token/);assert.equal(combat.round,0);
 combat.combatants=new Collection(...combat.combatants.filter(c=>c!==stage));await assert.rejects(combat.startCombat(),/Stage Token/);assert.equal(combat.round,0);
});
test('Stage presets provide Set, editable Omen routines and native Skill Items',()=>{
 const records=JSON.parse(fs.readFileSync('data/stages.json'));
 for(const record of records){const actor=stageDocument(record);assert.equal(actor.type,'stage');assert.equal(actor.system.setText,record.setText);assert.deepEqual(actor.system.routines,record.actions);assert.equal(actor.items.length,record.actions.length+1);assert.ok(actor.items.every(i=>i.type==='ability'));}
});
test('Automatic Omen runs on every Foundry turn, including Enemy/Stage turns, exactly once',async()=>{
 const {combat,stage,gm}=await encounter();stage.system.routines=[{name:'First omen',text:'First effect'},{name:'Second omen',text:'Second effect'}];
 await combat.startCombat();assert.equal(state().omenIndex,1);assert.equal(stage.system.omen,1);
 await execute('native-sync',{combat:combat.id},gm);assert.equal(state().omenIndex,1);
 await combat.nextTurn();assert.equal(state().omenIndex,2);await combat.nextTurn();assert.equal(state().omenIndex,3);
 await combat.nextTurn();assert.equal(combat.turns[combat.turn].actor.type,'stage');assert.equal(state().omenIndex,4);
 assert.equal(state().actors.length,3);await combat.nextTurn();assert.equal(combat.round,2);assert.equal(state().omenIndex,5);
});
test('Known Stage Omen attacks automatically roll and apply effects without pending cards',async()=>{
 const {combat,knight,ally}=await encounter('plushie');await combat.startCombat();
 assert.equal(knight.system.hp.value,9);assert.equal(state().pending,null);
 await combat.nextTurn();assert.equal(ally.system.hp.value,9);assert.equal(state().pending,null);
});
test('End Combat clears all Set dice including reserves and Stage Skills; cancel leaves dice intact',async()=>{
 const {combat,knight,ally,enemy,stage}=await encounter('plushie');await combat.startCombat();
 for(const actor of [knight,ally,enemy,stage])for(const item of actor.items.filter(i=>i.type==='ability'))item.system.charge=5;
 combat.cancelEnd=true;await combat.endCombat();assert.equal(knight.items[0].system.charge,5);
 combat.cancelEnd=false;await combat.endCombat();
 for(const actor of [knight,ally,enemy,stage])assert.ok(actor.items.filter(i=>i.type==='ability').every(i=>i.system.charge===0));
});
test('Skill click accepts Foundry targets outside Garden, timing, parent and dice restrictions',async()=>{
 const {knight,enemy}=await setup();await game.settings.set(ID,'directorMode',false);
 knight.system.garden=1;enemy.system.garden=4;knight.system.done=true;
 const item=knight.items.find(i=>i.system.key==='knights-etiquette');item.system.number=0;item.system.charge=0;
 await saveState({...state(),phase:'set',turn:0});
 await execute('use',{actor:knight.id,item:item.id,targets:[enemy.id],directUse:true},user(knight.id));
 const card=game.messages.get(state().pending);assert.deepEqual(card.getFlag(ID,'check').targets,[enemy.id]);assert.equal(card.getFlag(ID,'check').ignoreRange,true);
 await execute('roll',{},user(knight.id));await execute('resolve',{},user(knight.id));assert.equal(enemy.system.hp.value,14);assert.equal(item.system.charge,0);
});
test('No Foundry targets never selects an automatic opponent or damages the user',async()=>{
 const {knight,enemy}=await setup();const item=knight.items.find(i=>i.system.key==='knights-etiquette');
 await execute('use',{actor:knight.id,item:item.id,targets:[],directUse:true},user(knight.id));
 assert.equal(state().pending,null);assert.equal(knight.system.hp.value,16);assert.equal(enemy.system.hp.value,16);
 const sheet=fs.readFileSync('module/actor-sheet.js','utf8');assert.ok(sheet.includes('game.user.targets'));assert.ok(!sheet.includes('skillOptions'));
 assert.ok(!fs.readFileSync('templates/bringer-sheet.html','utf8').includes('data-action="charge"'));
});
test('Stage Set and Omen can execute their own Block Scripts automatically',async()=>{
 const {combat,stage,knight}=await encounter();const {newBlock}=await import('../module/skill-blocks.js');
 await stage.createEmbeddedDocuments('Item',[
  {name:'Scripted Set',type:'ability',system:{key:'stage:none:set',scriptEnabled:true,blocks:[{...newBlock(),op:'modifier',target:'combatants',stat:'defense',value:1}]}},
  {name:'Scripted Omen',type:'ability',system:{key:'stage:none:omen:0',scriptEnabled:true,blocks:[{...newBlock(),op:'damage',target:'combatants',value:1}]}}
 ]);stage.system.routines=[{name:'Scripted Omen',text:'Damage all combatants'}];
 await combat.startCombat();assert.equal(knight.system.hp.value,15);assert.equal(knight.system.modifiers.at(-1).value,1);
 await combat.nextTurn();assert.equal(knight.system.hp.value,14);assert.equal(state().pending,null);
});
test('Every catalog Skill can be clicked without timing, Garden or choice dialogs',async()=>{
 const {skills,skillDocument}=await import('../module/library.js');const {MockItem}=await import('./runtime-fixture.js');
 for(const record of skills){
  const {knight,enemy}=await setup();await game.settings.set(ID,'directorMode',false);
  knight.system.garden=1;enemy.system.garden=4;const item=new MockItem(skillDocument(record));item.system.number=0;item.system.charge=0;knight.items.push(item);
  await execute('use',{actor:knight.id,item:item.id,targets:[enemy.id],directUse:true},user(knight.id));
  assert.ok(item.system.charge>=0,record.id);
 }
});
