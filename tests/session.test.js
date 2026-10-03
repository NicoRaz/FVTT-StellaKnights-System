import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,user,getState,MockActor} from './runtime-fixture.js';
import {execute} from '../module/engine.js';
import {session} from '../module/session.js';
import {skills} from '../module/library.js';
import {ID} from '../module/rules.js';
test('Pair synchronization shares the Wish/Flower but preserves the Sheath’s own story',async()=>{
 const {knight,gm}=await setup(),sheath=new MockActor('sheath','sheath');game.actors.push(sheath);
 knight.system.details.partner=sheath.id;knight.system.details.wish='Our future';knight.system.details.keyword='Bloom!';knight.system.details.karma={type:'hope'};sheath.system.details.story='An independent life';
 await execute('sync-pair',{actor:knight.id},gm);
 assert.equal(sheath.system.details.wish,'Our future');assert.equal(sheath.system.details.karma.type,'despair');assert.equal(sheath.system.details.story,'An independent life');
});
test('Narrative scenes proceed once per pair and cannot skip the Final Chapter battle',async()=>{
 const {knight,ally,gm}=await setup();for(const a of [knight,ally]){const partner=new MockActor(a.id+'-sheath','sheath');a.system.details.partner=partner.id;game.actors.push(partner);}
 const b=getState();b.active=false;b.outcome='victory';await game.settings.set(ID,'battle',b);
 await execute('session-start',{actors:[knight.id,ally.id]},gm);assert.equal(getState().outcome,null);
 await execute('session-next',{},gm);assert.equal(session().phase,'chapter-one');assert.equal(session().cursor,0);
 await execute('session-next',{},gm);assert.equal(session().cursor,1);
 await execute('session-next',{},gm);assert.equal(session().phase,'chapter-two');
 for(let n=0;n<4;n++)await execute('session-next',{},gm);assert.equal(session().phase,'final-chapter');
 await assert.rejects(execute('session-next',{},gm));
 const end=getState();end.outcome='victory';await game.settings.set(ID,'battle',end);await execute('session-next',{},gm);assert.equal(session().phase,'curtain-call');
});
test('Bouquets are blocked in battle without the house rule and awards cannot repeat',async()=>{
 const {knight,ally,enemy,gm}=await setup();await assert.rejects(execute('give',{actor:knight.id},user(ally.id)));
 const s=getState();Object.assign(s,{active:false,outcome:'victory',awarded:false,decisive:[knight.id],supported:[knight.id]});await game.settings.set(ID,'battle',s);
 await execute('award',{conversed:[knight.id]},gm);assert.equal(knight.system.exp,5);assert.equal(ally.system.exp,2);
 await assert.rejects(execute('award',{conversed:[knight.id]},gm));assert.equal(knight.system.exp,5);
});
test('Campaign loadout changes retain old skills in reserve and do not duplicate known skills',async()=>{
 const {knight,gm}=await setup();await game.settings.set(ID,'battle',{active:false});
 const selected=skills.filter(s=>s.group==='Blue').map(s=>s.id).concat('pride-roses');
 const old=knight.items.map(i=>i.id);await execute('loadout',{actor:knight.id,color:'Blue',flower:'Rose',selected},gm);
 assert.ok(old.every(id=>knight.items.get(id)));assert.equal(knight.items.filter(i=>i.system.number>0).length,6);
 const count=knight.items.length;await execute('loadout',{actor:knight.id,color:'Blue',flower:'Rose',selected},gm);assert.equal(knight.items.length,count);
});
