import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,getState,MockItem} from './runtime-fixture.js';
import {execute,attack} from '../module/engine.js';
import {skills,skillDocument} from '../module/library.js';
import {ID} from '../module/rules.js';
test('Every catalog skill can consume its Set dice and complete its declared effects',async()=>{
 for(let index=0;index<54;index++){
  const {knight,ally,enemy,gm}=await setup(),record=skills[index],key=record.id;
  knight.system.hp.value=100;ally.system.hp.value=100;enemy.system.hp.value=100;
  const item=new MockItem(skillDocument(record,6));item.system.charge=2;knight.items.push(item);
  const data={actor:knight.id,item:item.id,targets:[enemy.id],path:[],path2:[],choice:'move-first',garden:3,from:1,to:6,index:0,indices:[0],sacrifice:knight.id,secondary:enemy.id};
  const supports=['purifying-rose','royal-rose-dress','fortress-cosmos','cosmos-over-the-pain','around-the-cosmos','system-calystegia','anemone-dress','unlimited-libra','night-runner','black-flowers-zenith','mind-over-matter','yellow-queen','yes-my-lady','wind-signpost','deep-contemplation','white-shield','nine-liverary','diaclock-the-purple','purple-flower-dial'];
  if(supports.includes(key))data.targets=[ally.id];
  const paths={ 'win-no-matter-what':[2],'around-the-cosmos':[2],'avandner':[2],'phantom-pain':[2],'night-runner':[2],'corrupt-touch':[2],'flash-step':[2,3]};
  data.path=paths[key]??[];if(key==='avandner')data.path2=[1];
  if(key==='diaclock-the-purple')data.remove={[ally.id]:{[ally.items[0].id]:0}};
  const before=['calystegia-sphere','wish-bringer','anemone-dress','rewrite-your-story','white-shield','lightning-intercept','black-flowers-zenith'];
  const after=['fortress-cosmos','whirlpool-of-thought','draco-grace-command'];
  if(before.includes(key)||after.includes(key)){await attack(enemy,3,[knight.id,ally.id]);if(after.includes(key)||key==='black-flowers-zenith')await execute('roll',{},gm);}
  const s=getState();s.damage={[knight.id]:{amount:2,source:enemy.id,check:'prior-check',round:1},[ally.id]:{amount:2,source:enemy.id,check:'prior-check',round:1}};s.lastMove={actor:enemy.id,count:1,round:1};s.omen={index:0,executed:false};await game.settings.set(ID,'battle',s);
  if(['system-aquilegia','system-calystegia','eternity-s-amaranthus'].includes(key))knight.system.hp.value=0;
  if(key==='aquilegia-the-remnant')knight.system.hp.value=3;
  await execute('use',data,gm);
  assert.ok(item.system.charge<2,key+' must consume Set dice');
  let safety=30;
  while(getState().pending&&safety--){const c=game.messages.get(getState().pending).getFlag(ID,'check');if(!c.rolled)await execute('roll',{},gm);await execute('resolve',{},gm);}
  assert.ok(safety>0,key+' must finish');
 }
});
test('Invalid movement and invalid reaction dice do not spend Set dice',async()=>{
 const {knight,enemy,gm}=await setup();const record=skills.find(s=>s.id==='flash-step'),item=new MockItem(skillDocument(record,6));item.system.charge=1;knight.items.push(item);
 await assert.rejects(execute('use',{actor:knight.id,item:item.id,targets:[enemy.id],path:[4]},gm));assert.equal(item.system.charge,1);
});
