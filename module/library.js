import {ID, COLORS, FLOWERS, escapeHTML as esc, isFighter} from "./rules.js";
import {t, formDialog, owner, chat, gmOnly,state} from "./helpers.js";
import {request} from "./socket.js";
import {crestDocuments,setCrestItem,crestItems,skillAllowed} from "./crest.js";
export let skills = [], stages = [];
export async function loadCatalog() {
  const responses = await Promise.all([fetch(`systems/${ID}/data/skills.json`), fetch(`systems/${ID}/data/stages.json`)]);
  if (responses.some(r => !r.ok)) throw Error("Cannot load skill/stage catalog");
  [skills, stages] = await Promise.all(responses.map(r => r.json()));
}
export function skillDocument(record, slot = 0) {
  const typeLine = record.text.match(/Type\s+(.*?)\s+Timing/);
  return {name:record.name, type:"ability", img:`systems/${ID}/assets/emblem.svg`, ownership:{default:2}, system:{
    key:record.id, parentType:FLOWERS.includes(record.group)?"flower":COLORS[record.group]?"color":"",parentKey:record.group==="Basic"?"":record.group,type:record.group, class:typeLine?.[1] ?? "", timing:record.timing,
    timingKey:record.timing, effect:record.text, page:record.page, number:slot, charge:0}};
}
export async function setupActor(actor) {
  const parents=[...actor.items.filter(i=>['flower','color'].includes(i.type)),...game.items.filter(i=>['flower','color'].includes(i.type)&&i.visible!==false)];
  if(!parents.some(i=>i.type==='color')||!parents.some(i=>i.type==='flower'))throw Error('Import the Item Library first, or create Flower / Color Items');
  const current=crestItems(actor);
  const select=type=>`<label>${type}<select name="${type}">${parents.filter(i=>i.type===type).map(i=>`<option value="${esc(i.uuid)}" ${i.id===current[type]?.id?'selected':''}>${esc(i.name)}</option>`).join('')}</select></label>`;
  const choice=await formDialog(t('Setup'),select('color')+select('flower'),f=>({colorUuid:f.elements.color.value,flowerUuid:f.elements.flower.value}));
  if(!choice)return;
  const chosen=await Promise.all([fromUuid(choice.colorUuid),fromUuid(choice.flowerUuid)]),candidate={items:chosen};
  const available=[...game.items,...actor.items].filter(i=>i.type==='ability'&&i.visible!==false&&skillAllowed(candidate,i));
  const unique=[...new Map(available.map(i=>[i.system.key||i.id,i])).values()];
  if(unique.length<6)throw Error('The selected Parent Items must grant at least six different Skill Items');
  const selected=await formDialog(t('Library'),Array.from({length:6},(_,n)=>`<label>Slot ${n+1}<select name="s${n}">${unique.map((i,j)=>`<option value="${esc(i.system.key||i.id)}" ${j===n?'selected':''}>${esc(i.name)}</option>`).join('')}</select></label>`).join(''),
    f=>Array.from({length:6},(_,n)=>f.elements[`s${n}`].value));
  if(selected)await request('loadout',{actor:actor.id,...choice,selected});
}
export async function createLoadout(data,user) {
  const a=owner(game.actors.get(data.actor),user);
  if(!isFighter(a))throw Error('Choose a fighter');
  if(state().active)throw Error('Cannot replace a loadout during a battle');
  // Native Parent Items are authoritative. Older macros using color/flower names remain compatible.
  let parents,keys;
  if(data.colorUuid||data.flowerUuid){
    parents=await Promise.all([fromUuid(data.colorUuid),fromUuid(data.flowerUuid)]);
    if(parents[0]?.type!=='color'||parents[1]?.type!=='flower')throw Error('Choose Color / Flower Items');
    for(const p of parents)if(!p.testUserPermission(user,'OBSERVER'))throw Error('You cannot read this Parent Item');
    if(data.selected?.length!==6)throw Error('Choose six different Skill Items');keys=data.selected;
  }else{
    if(!COLORS[data.color]||!FLOWERS.includes(data.flower))throw Error('Invalid Flower / Color');
    parents=crestDocuments(skills).filter(d=>d.system.key===data.color||d.system.key===data.flower).map(d=>({...d,toObject:()=>structuredClone(d)}));
    if(data.selected?.length!==5)throw Error('Choose five different skills');keys=[skills[0].id,...data.selected];
  }
  if(new Set(keys).size!==6)throw Error('Choose six different Skill Items');
  const candidate={items:parents};
  const documents=keys.map(key=>{
    const source=a.items.find(i=>i.type==='ability'&&(i.system.key||i.id)===key)??game.items.find(i=>i.type==='ability'&&(i.system.key||i.id)===key);
    const record=skills.find(s=>s.id===key),document=source?.toObject?.()??(record?skillDocument(record):null);
    if(!document||!skillAllowed(candidate,document))throw Error('Skill is not granted by the selected Flower / Color Items');
    if(source&&source.parent!==a&&!user.isGM&&!source.testUserPermission(user,'OBSERVER'))throw Error('You cannot read this Skill Item');
    delete document._id;document.system.key=key;return document;
  });
  for(const parent of parents)await setCrestItem(a,parent);
  await a.updateEmbeddedDocuments('Item',a.items.filter(i=>i.type==='ability'&&i.system.number>0).map(i=>({_id:i.id,'system.number':0,'system.charge':0})));
  const create=[],update=[];
  documents.forEach((d,n)=>{
    const existing=a.items.find(i=>i.type==='ability'&&i.system.key===d.system.key);
    if(existing)update.push({_id:existing.id,'system.number':n+1});else{d.system.number=n+1;d.system.charge=0;create.push(d);}
  });
  if(update.length)await a.updateEmbeddedDocuments('Item',update);
  if(create.length)await a.createEmbeddedDocuments('Item',create);
}
export async function importLibrary(user) {
  gmOnly(user);
  const documents=[...crestDocuments(skills),...skills.map(s=>skillDocument(s))];
  const create=[],update=[];
  for(const data of documents){
    const existing=game.items.find(i=>i.type===data.type&&i.system.key===data.system.key);
    if(!existing)create.push(data);
    else {
      const changes={_id:existing.id};
      if((existing.ownership?.default??0)<2)changes['ownership.default']=2;
      if(data.type==='ability'&&!existing.system.parentType&&data.system.parentType){changes['system.parentType']=data.system.parentType;changes['system.parentKey']=data.system.parentKey;}
      if(Object.keys(changes).length>1)update.push(changes);
    }
  }
  if(update.length)await Item.updateDocuments(update);
  if(create.length)await Item.createDocuments(create);
  await chat(t("Library"), `${skills.length} Skill Items, ${FLOWERS.length} Flower Items and ${Object.keys(COLORS).length} Color Items ready.`);
}
