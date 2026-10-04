import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {testStage,setup,user,MockItem,MockCombat} from './runtime-fixture.js';
import {ID} from '../module/rules.js';
import {state,saveState} from '../module/helpers.js';
import {execute,addDice} from '../module/engine.js';
import {skills,skillDocument,compendiumItems} from '../module/library.js';
import {syncCrest} from '../module/crest.js';
import {assertLoadoutEditable} from '../module/loadout.js';
async function flexible(){const fixture=await setup();await game.settings.set(ID,'directorMode',true);return fixture;}
test('Director mode starts a native encounter with partial loadouts and a custom Stage',async()=>{
 const {knight,gm}=await flexible();knight.items.length=0;const hp=knight.system.hp.value;
 await saveState({...state(),active:false});await execute('start',{actors:[knight.id,testStage('none')],stage:'none'},gm);
 assert.equal(state().active,true);assert.equal(state().stage,'none');assert.equal(knight.system.hp.value,hp);
 await execute('advance',{},gm);assert.equal(state().phase,'charge');
 await execute('advance',{},gm);assert.equal(state().phase,'actions');
 await execute('advance',{},gm);assert.equal(state().phase,'cut');
 await execute('advance',{},gm);assert.equal(state().round,2);
});
test('Director mode permits battle loadout edits and preserves Skills when Parents change',async()=>{
 const {knight}=await flexible();assert.doesNotThrow(assertLoadoutEditable);
 const foreign=new MockItem(skillDocument(skills.find(s=>s.group==='Red'),6));knight.items.push(foreign);
 await syncCrest(knight);assert.equal(foreign.system.number,6);
 await game.settings.set(ID,'directorMode',false);await syncCrest(knight);assert.equal(foreign.system.number,0);assert.throws(assertLoadoutEditable);
});
test('Charge allocates dice only to populated slots and Director can Charge outside its phase',async()=>{
 const {knight,gm,rig}=await flexible();knight.items=knight.items.filter(i=>i.type!=='ability'||i.system.number===1);
 const item=knight.items.find(i=>i.type==='ability');await addDice(knight,[1,6]);assert.equal(item.system.charge,1);
 rig([1,1,1,1]);await execute('charge',{actor:knight.id},gm);await execute('resolve',{},gm);
 rig([1,1,1,1]);await execute('charge',{actor:knight.id},gm);await execute('resolve',{},gm);
 assert.equal(item.system.charge,9);assert.equal(state().charged.filter(id=>id===knight.id).length,1);
 await assert.rejects(execute('charge',{actor:knight.id},user('outsider')),/own/);
});
test('Director can use foreign/reserved Skills without Set dice and keeps charges nonnegative',async()=>{
 const {knight,enemy,gm}=await flexible();await saveState({...state(),phase:'set',turn:0});
 const item=knight.items.find(i=>i.system.key==='knights-etiquette');item.system.number=0;item.system.charge=0;
 await execute('use',{actor:knight.id,item:item.id,targets:[enemy.id],path:[],ignoreRange:true},gm);
 assert.equal(item.system.charge,0);assert.ok(state().pending);
 await assert.rejects(execute('use',{actor:knight.id,item:item.id,targets:[enemy.id]},gm),/Pending/);
});
test('Director controls validate before writes, cancel pending cards and preserve native state',async()=>{
 const {knight,gm}=await flexible();await saveState({...state(),active:false});await execute('start',{actors:[knight.id,testStage('none')],stage:'none'},gm);
 const row={actor:knight.id,garden:4,hp:20,bouquet:12,exp:9,distortion:4};
 await execute('charge',{actor:knight.id},gm);const message=game.messages.get(state().pending);
 const data={stage:'none',phase:'actions',round:3,actors:[row]};
 await assert.rejects(execute('director-update',data,user(knight.id)),/GM only/);
 await assert.rejects(execute('director-update',data,gm),/pending check/);assert.equal(knight.system.garden,1);
 await assert.rejects(execute('director-update',{...data,cancelCheck:true,actors:[{...row,garden:99}]},gm));assert.ok(state().pending);
 await execute('director-update',{...data,cancelCheck:true},gm);
 assert.equal(state().pending,null);assert.equal(message.getFlag(ID,'check').resolved,true);assert.equal(game.combat.round,3);
 assert.equal(knight.system.garden,4);assert.equal(knight.system.exp,9);
 await assert.rejects(execute('resolve',{message:message.id},gm),/ended/);
 await execute('director-update',{...data,end:true},gm);assert.equal(state().active,false);
});
test('Director mode permits Bouquets in battle and scenes without linked partners',async()=>{
 const {knight,gm}=await flexible();await execute('give',{actor:knight.id},user('audience'));assert.equal(knight.system.bouquet,51);
 await execute('session-start',{actors:[knight.id]},gm);
 for(let n=0;n<5;n++)await execute('session-next',{},gm);
 assert.equal(game.settings.get(ID,'session').phase,'curtain-call');
});
test('Arena window and its launch actions are removed from runtime',()=>{
 assert.equal(fs.existsSync('module/battle-panel.js'),false);assert.equal(fs.existsSync('templates/battle-panel.html'),false);
 const init=fs.readFileSync('module/init.js','utf8');assert.ok(!init.includes('openBattle'));assert.ok(init.includes('directorControls'));
 assert.ok(!fs.readFileSync('templates/bringer-sheet.html','utf8').includes('data-action="arena"'));
});

test('Compendium documents are available to loadout building without World imports',async()=>{
 await flexible();const docs=[{type:'color',system:{key:'Black'}},{type:'ability',system:{key:'knights-etiquette'}}];
 game.packs=[{metadata:{packageName:ID},documentName:'Item',getDocuments:async()=>docs},{metadata:{packageName:'other'},documentName:'Item',getDocuments:async()=>{throw Error('Unrelated pack');}}];
 assert.deepEqual(await compendiumItems(),docs);assert.equal(game.items.length,0);
});
test('Partial native loadouts preserve chosen slot numbers during battle',async()=>{
 const {knight,gm}=await flexible();const parents=knight.items.filter(i=>['color','flower'].includes(i.type));
 globalThis.fromUuid=async id=>parents.find(p=>p.id===id);
 await execute('loadout',{actor:knight.id,colorUuid:parents.find(p=>p.type==='color').id,flowerUuid:parents.find(p=>p.type==='flower').id,selected:['','','','','','knights-etiquette']},gm);
 assert.equal(knight.items.find(i=>i.system.key==='knights-etiquette').system.number,6);
 assert.equal(knight.items.filter(i=>i.type==='ability'&&i.system.number>0).length,1);
});
test('Native Director navigation permits next round and rewind while protecting pending checks',async()=>{
 const {knight,gm}=await flexible();await saveState({...state(),active:false});await execute('start',{actors:[knight.id,testStage('none')],stage:'none'},gm);
 game.socket={on(){},emit(){}};const {registerSocket}=await import('../module/socket.js');registerSocket(execute);
 const {StellaCombat}=await import('../module/combat.js');const combat=game.combat;Object.setPrototypeOf(combat,StellaCombat.prototype);
 await StellaCombat.prototype.nextRound.call(combat);assert.equal(combat.round,2);
 const original=MockCombat.prototype.previousRound;
 MockCombat.prototype.previousRound=async function(){await this.update({round:this.round-1,turn:0});return this;};
 try{await StellaCombat.prototype.previousRound.call(combat);assert.equal(combat.round,1);assert.equal(state().phase,'actions');}
 finally{if(original)MockCombat.prototype.previousRound=original;else delete MockCombat.prototype.previousRound;}
 await execute('charge',{actor:knight.id},gm);
 await assert.rejects(StellaCombat.prototype.nextRound.call(combat),/pending check/);assert.equal(combat.round,1);
});
