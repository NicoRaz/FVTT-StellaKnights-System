import {directorMode} from './helpers.js';
import {COLORS,FLOWERS,ID,isFighter} from './rules.js';
export const crestItems=actor=>({color:actor.items.find(i=>i.type==='color'),flower:actor.items.find(i=>i.type==='flower')});
export function crestDocuments(catalog) {
  return [...Object.entries(COLORS).map(([name,stats])=>({name,type:'color',system:{key:name,stats:{hp:stats.hp,defense:stats.defense,charge:stats.charge}}})),
    ...FLOWERS.map(name=>({name,type:'flower',system:{key:name,stats:{hp:0,defense:0,charge:0}}}))].map(d=>({...d,img:`systems/${ID}/assets/emblem.svg`,ownership:{default:2},system:{...d.system,
      description:'Drag this Item onto a character to select its crest. Its Skill list suggests the matching loadout; Director rulings can allow other Skills.',skillKeys:catalog.filter(s=>s.group===d.name).map(s=>s.id)}}));
}
export function crestStats(actor) {
  const {color,flower}=crestItems(actor);
  if(!color)return {hp:0,defense:1,charge:0};
  return Object.fromEntries(['hp','defense','charge'].map(key=>[key,Number(color.system.stats?.[key]??0)+Number(flower?.system.stats?.[key]??0)]));
}
export function skillAllowed(actor,item) {
  if(item.system.key==='knights-etiquette')return true;
  const {color,flower}=crestItems(actor),key=item.system.key||item.id;
  return [color,flower].some(parent=>parent?.system.skillKeys?.includes(key));
}
export function validateSkillSlot(actor,item,number) {
  if(!directorMode()&&number>0&&!skillAllowed(actor,item))throw Error('This Skill is not granted by the selected Flower or Color Item');
}
export async function syncCrest(actor,{adjustHP=false}={}) {
  if(!isFighter(actor))return;
  const {color,flower}=crestItems(actor),stats=crestStats(actor),updates={};
  const values={'system.hp.max':stats.hp,'system.defense.value':Math.max(1,Math.min(6,stats.defense)),'system.charge.value':Math.max(0,stats.charge),
    'system.details.crest.color':color?.system.key??'','system.details.crest.flower':flower?.system.key??''};
  for(const [path,value] of Object.entries(values)){
    const current=path.split('.').reduce((o,k)=>o?.[k],actor);
    if(current!==value)updates[path]=value;
  }
  if(adjustHP&&stats.hp!==actor.system.hp.max)updates['system.hp.value']=Math.max(0,actor.system.hp.value+stats.hp-actor.system.hp.max);
  const invalid=directorMode()?[]:actor.items.filter(i=>i.type==='ability'&&i.system.number>0&&!skillAllowed(actor,i));
  if(invalid.length)await actor.updateEmbeddedDocuments('Item',invalid.map(i=>({_id:i.id,'system.number':0})));
  if(Object.keys(updates).length)await actor.update(updates);
}
export async function setCrestItem(actor,source) {
  if(!['flower','color'].includes(source.type))throw Error('Choose a Flower or Color Item');
  const existing=actor.items.find(i=>i.type===source.type);
  if(source.parent===actor)return source;
  const data=source.toObject();delete data._id;data.folder=null;
  let item;
  if(existing){delete data.type;await existing.update(data,{stellaCrestChange:true});item=existing;}
  else [item]=await actor.createEmbeddedDocuments('Item',[data],{stellaCrestChange:true});
  await syncCrest(actor,{adjustHP:true});return item;
}
