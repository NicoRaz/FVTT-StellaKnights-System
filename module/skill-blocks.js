import {ID,integer,isFighter,successes,escapeHTML as esc} from './rules.js';
import {owner,byId,state,rollDice,chat,currentActors} from './helpers.js';
import {changeHP,addDice,effectiveDefense} from './engine.js';
export const BLOCK_OPS={roll:'Roll dice',attack:'Attack',damage:'Damage',heal:'Heal / revive',charge:'Add Set dice',modifier:'Stat bonus',chat:'Message',repeat:'Repeat next block',if:'If dice total ≥ value: next block'};
export const BLOCK_SOURCES={fixed:'Fixed value',round:'Foundry Round',roll:'Last dice total'};
export const BLOCK_TARGETS={targets:'Foundry Targets',self:'Skill user',combatants:'All fighters in Combat'};
export const newBlock=()=>({op:'roll',value:1,face:1,source:'fixed',target:'targets',text:'',stat:'attack',duration:'round'});
export function validateBlocks(blocks){
  if(!Array.isArray(blocks)||blocks.length>40)throw Error('A Skill supports up to 40 blocks');
  for(const [index,b] of blocks.entries()){
    if(!BLOCK_OPS[b.op]||!BLOCK_SOURCES[b.source]||!BLOCK_TARGETS[b.target])throw Error(`Unknown block ${index+1}`);
    integer(b.value,b.op==='modifier'?-100:0,100);integer(b.face??1,1,6);if(!['attack','defense'].includes(b.stat)||!['round','battle','persistent'].includes(b.duration))throw Error('Unknown stat or duration');
    if(['repeat','if'].includes(b.op)&&(!blocks[index+1]||['repeat','if'].includes(blocks[index+1].op)))throw Error('Repeat / If must be followed by an action block');
    if(b.op==='repeat'&&b.value>10)throw Error('Repeat supports up to 10 repetitions');
  }
}
export async function runBlockSkill(data,user){
  const actor=owner(byId(data.actor),user),item=actor.items.get(data.item);if(!item||item.type!=='ability')throw Error('Skill not found');
  const blocks=item.system.blocks??[];validateBlocks(blocks);
  const locked=[...new Set(data.targets??[])].map(byId);let lastTotal=0;
  // The editor stores structured data only. Never evaluate script text as JavaScript.
  await item.update({'system.charge':Math.max(0,item.system.charge-1)});
  await chat(item.name,`<pre>${esc(item.system.effect)}</pre>`,actor);
  const amount=b=>b.source==='round'?state().round??0:b.source==='roll'?lastTotal:b.value;
  async function executeBlock(b){
    const value=integer(amount(b),b.op==='modifier'?-100:0,100),targets=(b.target==='self'?[actor]:b.target==='combatants'?currentActors():locked).filter(isFighter);
    switch(b.op){
      case 'roll':{const result=await rollDice(value);lastTotal=result.values.reduce((sum,n)=>sum+n,0);await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor}),rolls:result.roll?[result.roll]:[],content:`<h3>${esc(item.name)}</h3><p>${result.values.join(', ')} · Total ${lastTotal}</p>`});break;}
      case 'attack':{const result=await rollDice(value);lastTotal=result.values.reduce((sum,n)=>sum+n,0);for(const target of targets)await changeHP(target,-successes(result.values,effectiveDefense(target)),{source:actor.id});await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor}),rolls:result.roll?[result.roll]:[],content:`<h3>${esc(item.name)} · Attack</h3><p>${result.values.join(', ')} → ${targets.map(t=>esc(t.name)).join(', ')}</p>`});break;}
      case 'damage':for(const target of targets)await changeHP(target,-value,{source:actor.id});break;
      case 'heal':for(const target of targets)await target.update({'system.hp.value':target.system.hp.value+value});break;
      case 'charge':for(const target of targets)await addDice(target,Array(value).fill(integer(b.face??1,1,6)));break;
      case 'modifier':for(const target of targets)await target.update({'system.modifiers':[...target.system.modifiers,{kind:b.stat,value,duration:b.duration}]});break;
      case 'chat':await chat(item.name,`<p>${esc(b.text)}</p>`,actor);break;
    }
  }
  for(let index=0;index<blocks.length;index++){
    const b=blocks[index];
    if(b.op==='repeat'){const action=blocks[++index];for(let n=0;n<b.value;n++)await executeBlock(action);}
    else if(b.op==='if'){const action=blocks[++index];if(lastTotal>=b.value)await executeBlock(action);}
    else await executeBlock(b);
  }
}
