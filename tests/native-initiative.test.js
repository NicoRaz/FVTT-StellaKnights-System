import test from 'node:test';
import assert from 'node:assert/strict';
import {testStage,setup,user} from './runtime-fixture.js';
import {execute,effectiveCharge} from '../module/engine.js';
import {state,saveState} from '../module/helpers.js';
import {ID} from '../module/rules.js';
import {ensureCombat} from '../module/combat-state.js';
import {registerSocket,request} from '../module/socket.js';
async function nativeBattle(){
 const fixture=await setup();await game.settings.set(ID,'directorMode',true);await saveState({...state(),active:false});
 const {StellaCombat}=await import('../module/combat.js');CONFIG.Combat.documentClass=StellaCombat;
 game.socket={on(){},emit(){}};registerSocket(execute);
 const combat=await ensureCombat([fixture.enemy,fixture.knight,fixture.ally,fixture.stage]);
 const [enemy,knight,ally,stage]=combat.combatants;
 await combat.updateEmbeddedDocuments('Combatant',[{_id:enemy.id,initiative:2},{_id:knight.id,initiative:18},{_id:ally.id,initiative:11},{_id:stage.id,initiative:-1}]);
 await combat.startCombat();return {...fixture,combat};
}
test('Begin Combat preserves Foundry Initiative, rolls Initiative through core and respects highest score',async()=>{
 const {combat,knight,ally,enemy}=await nativeBattle();
 assert.deepEqual([...combat.combatants].map(c=>c.initiative),[2,18,11,-1]);assert.deepEqual(state().actors,[knight.id,ally.id,enemy.id]);
 assert.equal(combat.turn,0);assert.equal(state().phase,'actions');
 await combat.rollInitiative([combat.combatants[0].id],{formula:'2d6'});
 assert.equal(combat.combatants[0].initiative,20);assert.equal(combat.lastInitiativeOptions.formula,'2d6');assert.equal(state().actors[0],enemy.id);
});
test('Native last turn increments Round and current Charge uses that Round immediately',async()=>{
 const {combat,knight}=await nativeBattle();assert.equal(effectiveCharge(knight),4);
 await combat.nextTurn();assert.equal(combat.turn,1);assert.equal(combat.round,1);
 await combat.nextTurn();assert.equal(combat.turn,2);await combat.nextTurn();assert.equal(combat.turn,3);await combat.nextTurn();
 assert.equal(combat.turn,0);assert.equal(combat.round,2);assert.equal(state().round,2);assert.equal(effectiveCharge(knight),5);
 assert.deepEqual(state().charged,[]);assert.equal(state().initializedRound,2);
});
test('DM Charge All rolls each pool once, allocates each face and preserves unused Set dice',async()=>{
 const {combat,knight,ally,enemy,gm,rig}=await nativeBattle();
 const slot=a=>a.items.find(i=>i.system.number===1);slot(knight).system.charge=2;
 for(const actor of [knight,ally,enemy])rig(Array(effectiveCharge(actor)).fill(1));
 const result=await execute('charge-all',{combat:combat.id},gm);
 assert.deepEqual(result.charged,[knight.id,ally.id,enemy.id]);assert.equal(state().pending,null);assert.equal(slot(knight).system.charge,6);
 assert.equal(slot(ally).system.charge,4);assert.equal(slot(enemy).system.charge,4);
 assert.equal(game.messages.filter(m=>m.getFlag(ID,'batchCharge')).length,3);
 const again=await execute('charge-all',{combat:combat.id},gm);assert.deepEqual(again.charged,[]);assert.equal(slot(knight).system.charge,6);
 await combat.nextRound();assert.equal(effectiveCharge(knight),5);
 for(const actor of [knight,ally,enemy])rig(Array(effectiveCharge(actor)).fill(1));
 await execute('charge-all',{combat:combat.id},gm);assert.equal(slot(knight).system.charge,11);assert.equal(slot(ally).system.charge,9);
 await combat.previousRound();const rewind=await execute('charge-all',{combat:combat.id},gm);assert.deepEqual(rewind.charged,[]);assert.equal(slot(knight).system.charge,11);
});
test('Charge All is GM-only, skips incapacitated fighters and cannot run through pending checks',async()=>{
 const {combat,knight,ally,enemy,gm}=await nativeBattle();
 await assert.rejects(execute('charge-all',{combat:combat.id},user(knight.id)),/GM only/);
 await assert.rejects(execute('charge-all',{combat:'other'},gm),/active Stellar/);
 await execute('charge',{actor:knight.id},gm);await assert.rejects(execute('charge-all',{combat:combat.id},gm),/Pending/);
 await execute('resolve',{},gm);ally.system.hp.value=0;
 const result=await execute('charge-all',{combat:combat.id},gm);assert.deepEqual(result.charged,[enemy.id]);
 assert.equal(game.messages.filter(m=>m.getFlag(ID,'batchCharge')).length,1);
});
test('Serialized double clicks on Charge All cannot allocate twice',async()=>{
 const {combat,knight}=await nativeBattle();
 const results=await Promise.all([request('charge-all',{combat:combat.id}),request('charge-all',{combat:combat.id})]);
 assert.equal(results[0].charged.length,3);assert.equal(results[1].charged.length,0);
 assert.equal(game.messages.filter(m=>m.getFlag(ID,'batchCharge')).length,3);
 assert.equal(knight.items.find(i=>i.system.number===4).system.charge,4);
});
test('Manual Foundry Round changes reset round effects without overwriting Initiative',async()=>{
 const {combat,knight,gm}=await nativeBattle();knight.system.modifiers=[{kind:'attack',value:1,duration:'round'},{kind:'defense',value:1,duration:'battle'}];
 await combat.update({round:5,turn:1});await execute('native-sync',{combat:combat.id},gm);
 assert.equal(effectiveCharge(knight),8);assert.equal(knight.system.modifiers.length,1);assert.equal(knight.system.modifiers[0].duration,'battle');
 assert.deepEqual([...combat.combatants].map(c=>c.initiative),[2,18,11,-1]);assert.equal(combat.turn,1);
});
