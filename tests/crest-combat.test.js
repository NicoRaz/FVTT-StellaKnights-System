import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {setup,MockItem,user} from './runtime-fixture.js';
import {crestDocuments,crestItems,crestStats,setCrestItem,skillAllowed} from '../module/crest.js';
import {skills,skillDocument,importLibrary} from '../module/library.js';
import {execute,effectiveCharge,effectiveDefense,effectiveAttackBonus} from '../module/engine.js';
import {state,saveState} from '../module/helpers.js';
import {ensureCombat,archiveCombat} from '../module/combat-state.js';
import {registerSocket} from '../module/socket.js';
import {ID} from '../module/rules.js';
test('Flower and Color are native Items with complete child Skill lists and authored stats',async()=>{
 await setup();const docs=crestDocuments(skills);assert.equal(docs.length,13);
 for(const skill of skills.filter(s=>s.id!=='knights-etiquette')){
  const parent=docs.find(p=>p.system.key===skill.group);assert.ok(parent,skill.id);
  assert.ok(parent.system.skillKeys.includes(skill.id));
  const document=skillDocument(skill);assert.equal(document.system.parentType,parent.type);assert.equal(document.system.parentKey,parent.system.key);
 }
});
test('Library import includes all 54 Skills and 13 Parent Items and is idempotent',async()=>{
 const {gm}=await setup();let updates=0;
 globalThis.Item={createDocuments:async docs=>{game.items.push(...docs.map(d=>new MockItem(d)));},updateDocuments:async docs=>{updates+=docs.length;for(const d of docs)await game.items.get(d._id).update(d);}};
 await importLibrary(gm);assert.equal(game.items.length,67);await importLibrary(gm);assert.equal(game.items.length,67);
 assert.equal(updates,0);game.items[0].ownership.default=0;await importLibrary(gm);assert.equal(updates,1);
});
test('Replacing a Parent keeps one Item per type, recalculates stats and reserves ineligible Skills',async()=>{
 const {knight}=await setup();await saveState({...state(),active:false});
 const blue=crestDocuments(skills).find(d=>d.name==='Blue');
 await setCrestItem(knight,{...blue,toObject:()=>structuredClone(blue)});
 assert.equal(knight.items.filter(i=>i.type==='color').length,1);assert.equal(crestItems(knight).color.system.key,'Blue');
 assert.deepEqual(crestStats(knight),{hp:12,defense:3,charge:3});assert.equal(knight.system.hp.value,12);
 const foreign=new MockItem(skillDocument(skills.find(s=>s.group==='Red'),2));assert.equal(skillAllowed(knight,foreign),false);
 assert.equal(skillAllowed(knight,new MockItem(skillDocument(skills[0],6))),true);
 const customFlower=crestDocuments(skills).find(d=>d.name==='Cosmos');customFlower.system.stats={hp:2,defense:1,charge:2};
 await setCrestItem(knight,{...customFlower,toObject:()=>structuredClone(customFlower)});
 assert.deepEqual(crestStats(knight),{hp:14,defense:4,charge:5});
 assert.ok(knight.items.filter(i=>i.type==='ability'&&i.system.number>0).every(i=>skillAllowed(knight,i)));
});
test('Battle uses native Combatants and native round/turn as the source of truth',async()=>{
 const {knight,ally,enemy,gm}=await setup();await saveState({...state(),active:false});
 await execute('start',{actors:[knight.id,enemy.id,ally.id],stage:'plushie'},gm);
 assert.equal(game.combats.length,1);assert.equal(game.combat.combatants.length,3);assert.equal(game.combat.round,1);
 assert.equal(state().actors[0],enemy.id);assert.equal(game.combat.turn,null);assert.equal(state().phase,'set');
 assert.equal(effectiveCharge(enemy),4);assert.equal(effectiveDefense(enemy),4);assert.equal(enemy.system.hp.value,26);
 assert.equal(effectiveAttackBonus(enemy),1);
 await game.combat.update({round:4,turn:2,'flags.stellaknights.battle.phase':'actions'});
 assert.equal(state().round,4);assert.equal(state().turn,2);assert.equal(effectiveCharge(enemy),7);
 // Changing the old world setting cannot replace a live Combat's state.
 await game.settings.set(ID,'battle',{active:true,round:999,actors:[]});assert.equal(state().round,4);
 await archiveCombat(game.combat);const archive=game.settings.get(ID,'battle');assert.equal(archive.active,false);assert.equal(archive.pending,null);assert.equal(archive.round,4);
});
test('Native initiative order changes affect the roster; phase advances cannot target a different Combat',async()=>{
 const {knight,ally,enemy,gm}=await setup();await saveState({...state(),active:false});
 await execute('start',{actors:[enemy.id,knight.id,ally.id],stage:'ragnarok'},gm);
 const cb=game.combat.combatants.find(c=>c.actorId===ally.id);
 await game.combat.updateEmbeddedDocuments('Combatant',[{_id:cb.id,initiative:2.5}]);assert.deepEqual(state().actors,[enemy.id,ally.id,knight.id]);
 await assert.rejects(execute('advance',{combat:'different'},gm),/active Stellar/);
});
test('Foundry Combat next-turn controls run Stellar phases through the serialized GM workflow',async()=>{
 const {knight,ally,enemy,gm}=await setup();await saveState({...state(),active:false});
 await execute('start',{actors:[enemy.id,knight.id,ally.id],stage:'ragnarok'},gm);
 game.socket={on(){},emit(){}};registerSocket(execute);
 const {StellaCombat}=await import('../module/combat.js');
 // Exercise the native class method on a live mock Combat document.
 await StellaCombat.prototype.nextTurn.call(game.combat);assert.equal(state().phase,'charge');
 assert.equal(game.combat.turn,null);await assert.rejects(StellaCombat.prototype.nextTurn.call(game.combat),/must Charge/);
});
test('Reserved or ungranted Skills cannot spend dice; Knight’s Etiquette is not tied to slot 1',async()=>{
 const {knight,enemy,gm}=await setup();const basic=knight.items.find(i=>i.system.key==='knights-etiquette');basic.system.number=6;basic.system.charge=1;
 await execute('use',{actor:knight.id,item:basic.id,targets:[enemy.id],path:[]},gm);assert.equal(basic.system.charge,0);
 const foreign=new MockItem(skillDocument(skills.find(s=>s.group==='Red'),2));foreign.system.charge=1;knight.items.push(foreign);
 await assert.rejects(execute('use',{actor:knight.id,item:foreign.id,targets:[enemy.id]},gm),/not granted/);assert.equal(foreign.system.charge,1);
 basic.system.number=0;basic.system.charge=1;await assert.rejects(execute('use',{actor:knight.id,item:basic.id},gm),/numbered slot/);
});
test('Bringer template exposes only current stats and has no Garden or starting stat inputs',()=>{
 const template=fs.readFileSync(new URL('../templates/bringer-sheet.html',import.meta.url),'utf8');
 for(const field of ['system.garden','system.hp.max','system.defense.value','system.charge.value'])assert.ok(!template.includes('name="'+field+'"'));
 assert.ok(template.includes('{{currentCharge}}'));assert.ok(template.includes('{{derivedDefense}}'));assert.ok(!template.includes('Base Defense'));
});

test('Native next-round control waits for Cut; native phase transitions persist their new round',async()=>{
 const {knight,ally,enemy,gm}=await setup();await saveState({...state(),active:false});
 await execute('start',{actors:[enemy.id,knight.id,ally.id],stage:'midnight-ball'},gm);
 game.socket={on(){},emit(){}};registerSocket(execute);const {StellaCombat}=await import('../module/combat.js');
 await assert.rejects(StellaCombat.prototype.nextRound.call(game.combat),/Complete Set/);
 await saveState({...state(),phase:'cut'});await StellaCombat.prototype.nextRound.call(game.combat);
 assert.equal(game.combat.round,2);assert.equal(state().phase,'set');assert.equal(effectiveCharge(knight),5);
});

test('Native Parent UUID loadouts use authored Item stats and can omit Knight’s Etiquette entirely',async()=>{
 const {knight,gm}=await setup();await saveState({...state(),active:false});
 const parents=crestDocuments(skills).filter(d=>['Black','Rose'].includes(d.name)).map(d=>new MockItem(d));
 parents[0].system.stats={hp:23,defense:5,charge:2};parents[1].system.stats={hp:2,defense:0,charge:1};
 globalThis.fromUuid=async uuid=>parents.find(p=>p.id===uuid);
 const selected=skills.filter(s=>['Rose','Black'].includes(s.group)).slice(0,6).map(s=>s.id);
 await execute('loadout',{actor:knight.id,colorUuid:parents[0].id,flowerUuid:parents[1].id,selected},gm);
 assert.deepEqual(crestStats(knight),{hp:25,defense:5,charge:3});
 assert.equal(knight.items.find(i=>i.system.number===1).system.key,selected[0]);
 assert.equal(knight.items.find(i=>i.system.key==='knights-etiquette').system.number,0);
 parents[0].ownership.default=0;
 await assert.rejects(execute('loadout',{actor:knight.id,colorUuid:parents[0].id,flowerUuid:parents[1].id,selected},user(knight.id)),/cannot read this Parent/);
});

test('Reserved passive Skills no longer modify current Defense or Attack bonus',async()=>{
 const {knight}=await setup();const dress=new MockItem(skillDocument(skills.find(s=>s.id==='royal-rose-dress'),3));dress.system.charge=1;knight.items.push(dress);
 assert.equal(effectiveDefense(knight),2);assert.equal(effectiveAttackBonus(knight),1);
 dress.system.number=0;assert.equal(effectiveDefense(knight),3);assert.equal(effectiveAttackBonus(knight),0);
});

test('Round and Stage effects disappear from current stats when the battle ends',async()=>{
 const {knight}=await setup();knight.system.blessings={hp:10,charge:2,attack:2};
 knight.system.modifiers=[{kind:'defense',value:1,duration:'round'},{kind:'attack',value:1,duration:'battle'}];
 assert.equal(effectiveCharge(knight),6);assert.equal(effectiveAttackBonus(knight),3);assert.equal(effectiveDefense(knight),4);
 await saveState({...state(),active:false});assert.equal(effectiveCharge(knight),3);assert.equal(effectiveAttackBonus(knight),0);assert.equal(effectiveDefense(knight),3);
});
