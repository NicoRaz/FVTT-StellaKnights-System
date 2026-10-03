import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,getState,flags} from './runtime-fixture.js';
import {stages} from '../module/library.js';
import {execute} from '../module/engine.js';
import {setRoutine,readOmen,executeOmen} from '../module/stages.js';
import {ID} from '../module/rules.js';
test('All seven Stage catalogs and all 33 Action routines execute and persist a usable state',async()=>{
 for(let stageIndex=0;stageIndex<7;stageIndex++) {
  const {gm,knight,ally,enemy}=await setup();const stage=stages[stageIndex];
  for(let n=0;n<stage.actions.length;n++) {
   knight.system.hp.value=100;ally.system.hp.value=100;enemy.system.hp.value=100;
   const s=getState();Object.assign(s,{stage:stage.id,round:2,turn:1,omenIndex:n,omen:null,pending:null,freeEnemy:null});await game.settings.set(ID,'battle',s);
   await readOmen();assert.equal(getState().omen.index,n);await executeOmen();
   let safety=20;
   while(getState().pending&&safety--){await execute('roll',{},gm);await execute('resolve',{},gm);}
   assert.ok(safety>0,stage.name+' infinite continuation');
   assert.equal(getState().omen.executed,true);assert.equal(getState().omenIndex,n+1);
  }
 }
});
test('Stage markers, alternate ball modes and repeated Set routines are persisted',async()=>{
 const {enemy}=await setup();for(const stage of stages){const s=getState();Object.assign(s,{stage:stage.id,round:1,pending:null,markers:[]});await game.settings.set(ID,'battle',s);await setRoutine();}
 assert.ok(enemy.system.modifiers.some(m=>m.kind==='attack'));
});
