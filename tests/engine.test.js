import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,user,getState,flags,MockItem} from './runtime-fixture.js';
import {execute,attack,createCheck} from '../module/engine.js';
import {skills,skillDocument} from '../module/library.js';
import {saveState} from '../module/helpers.js';
import {ID} from '../module/rules.js';
const pending=()=>game.messages.get(getState().pending);
test('Attack declaration allows pre-roll support and resolves exactly once',async()=>{
 const {knight,enemy,gm,rig}=await setup();rig([2,3,6]);
 await attack(knight,3,[enemy.id]);assert.equal(flags(pending()).rolled,false);assert.equal(enemy.system.hp.value,16);
 await assert.rejects(execute('resolve',{},gm));await execute('roll',{},gm);assert.equal(enemy.system.hp.value,16);
 await execute('resolve',{},gm);assert.equal(enemy.system.hp.value,14);assert.equal(getState().pending,null);
 await assert.rejects(execute('resolve',{},gm));assert.equal(enemy.system.hp.value,14);
});
test('Support requires recipient consent; payer is charged only on acceptance',async()=>{
 const {knight,ally,enemy,gm,rig}=await setup();await attack(knight,2,[enemy.id]);
 await execute('offer',{payer:ally.id,effect:'boost'},user(ally.id));const offer=game.messages.at(-1);
 assert.equal(ally.system.bouquet,50);await assert.rejects(execute('accept',{message:offer.id},user(ally.id)));
 await execute('accept',{message:offer.id},user(knight.id));assert.equal(ally.system.bouquet,46);assert.equal(flags(pending()).boosts,1);
 await assert.rejects(execute('accept',{message:offer.id},gm));rig([1,3,6]);await execute('roll',{},gm);await execute('resolve',{},gm);
 assert.equal(enemy.system.hp.value,14);assert.deepEqual(getState().supported,[ally.id]);
});
test('Dice Boost is capped at three and re-roll at one per check',async()=>{
 const {knight,enemy,gm,rig}=await setup();await attack(knight,1,[enemy.id]);
 for(let n=0;n<3;n++){await execute('offer',{payer:knight.id,effect:'boost'},gm);await execute('accept',{message:game.messages.at(-1).id},gm);}
 await assert.rejects(execute('offer',{payer:knight.id,effect:'boost'},gm));rig([1,1,1,1]);await execute('roll',{},gm);
 rig([6,6,6,6]);await execute('offer',{payer:knight.id,effect:'reroll'},gm);await execute('accept',{message:game.messages.at(-1).id},gm);
 await assert.rejects(execute('offer',{payer:knight.id,effect:'reroll'},gm));await execute('resolve',{},gm);assert.equal(enemy.system.hp.value,12);
});
test('Petite Lucky repeatedly shifts one die and allocates Set dice only after resolve',async()=>{
 const {knight,gm}=await setup();await createCheck({kind:'charge',actor:knight.id,values:[1,4],count:2,rolled:true,rerolled:false,petiteIndex:null});
 for(let n=0;n<2;n++){await execute('offer',{payer:knight.id,effect:'petite',index:0,delta:1},gm);await execute('accept',{message:game.messages.at(-1).id},gm);}
 await assert.rejects(execute('offer',{payer:knight.id,effect:'petite',index:1,delta:1},gm));
 assert.equal(knight.items.find(i=>i.system.number===3).system.charge,0);
 await execute('resolve',{},gm);assert.equal(knight.items.find(i=>i.system.number===3).system.charge,1);assert.equal(knight.items.find(i=>i.system.number===4).system.charge,1);
});
test('Changing Garden before the roll makes an out-of-range attack fail',async()=>{
 const {knight,enemy,gm,rig}=await setup();await attack(knight,2,[enemy.id]);enemy.system.garden=4;rig([6,6]);await execute('roll',{},gm);await execute('resolve',{},gm);assert.equal(enemy.system.hp.value,16);
});
test('Distortion revives, Atypia adds three dice and is consumed once',async()=>{
 const {knight,enemy,gm,rig}=await setup();knight.system.hp.value=0;
 await execute('distortion',{actor:knight.id,effect:'atypia'},gm);assert.equal(knight.system.hp.value,4);assert.equal(knight.system.distortion,1);
 await attack(knight,1,[enemy.id]);assert.equal(flags(pending()).count,4);rig([2,3,4,6]);await execute('roll',{},gm);assert.equal(knight.system.atypia,false);await execute('resolve',{},gm);
 knight.system.distortion=3;await assert.rejects(execute('distortion',{actor:knight.id,effect:'life'},gm));
});
test('Skill multi-attacks resume after each check, consume one Set die and heal without cap',async()=>{
 const {knight,enemy,gm,rig}=await setup();const record=skills.find(s=>s.id==='pride-roses'),item=new MockItem(skillDocument(record,2));item.system.charge=1;knight.items.push(item);
 await execute('use',{actor:knight.id,item:item.id,targets:[enemy.id]},gm);assert.equal(item.system.charge,0);
 rig([4,4]);await execute('roll',{},gm);await execute('resolve',{},gm);assert.ok(getState().pending);
 rig([4,4]);await execute('roll',{},gm);await execute('resolve',{},gm);assert.equal(enemy.system.hp.value,12);assert.equal(knight.system.hp.value,18);
});
test('Normal actor ownership protects charge, distortion and skill mutation',async()=>{
 const {knight}=await setup();await assert.rejects(execute('distortion',{actor:knight.id,effect:'atypia'},user('stranger')));assert.equal(knight.system.distortion,0);
});
test('Start, charge, Set/Actions/Cut flow preserves unused Set dice between rounds',async()=>{
 const {knight,ally,enemy,gm,rig}=await setup();await game.settings.set(ID,'battle',{active:false});
 await execute('start',{actors:[enemy.id,knight.id,ally.id],stage:'ragnarok'},gm);assert.equal(enemy.system.hp.value,26);
 await execute('advance',{},gm);assert.equal(getState().phase,'charge');
 for(const a of [enemy,knight,ally]){rig([1,2,3,4]);await execute('charge',{actor:a.id},gm);await execute('resolve',{},gm);}
 await execute('advance',{},gm);assert.equal(getState().phase,'actions');assert.equal(getState().actors[getState().turn],enemy.id);
 // Stop before Stage attacks: change to no-damage routines through the Director's sandbox.
 const s=getState();s.stage='dragon';s.omenIndex=4;await saveState(s);
 await execute('advance',{},gm);assert.equal(getState().turn,1);
 rig([1]);rig([1]);await execute('advance',{},gm);assert.equal(getState().turn,2);
 // Dragon's breath next turn has no occupants in Garden 4; Garden 1 occupants are hit.
 await execute('advance',{},gm);if(getState().pending){rig(Array(7).fill(1));await execute('roll',{},gm);await execute('resolve',{},gm);await execute('advance',{},gm);}
 assert.equal(getState().phase,'cut');await execute('advance',{},gm);assert.equal(getState().round,2);assert.equal(getState().phase,'set');
 assert.equal(knight.items.find(i=>i.system.number===1).system.charge,1);
});
test('Victory ends the battle immediately and cancels remaining multi-attack steps',async()=>{
 const {knight,enemy,gm,rig}=await setup();enemy.system.hp.value=1;const item=new MockItem(skillDocument(skills.find(s=>s.id==='pride-roses'),2));item.system.charge=1;knight.items.push(item);
 await execute('use',{actor:knight.id,item:item.id,targets:[enemy.id]},gm);rig([6,6]);await execute('roll',{},gm);await execute('resolve',{},gm);
 assert.equal(getState().active,false);assert.equal(getState().outcome,'victory');assert.equal(getState().pending,null);assert.equal(knight.system.hp.value,16);
});
