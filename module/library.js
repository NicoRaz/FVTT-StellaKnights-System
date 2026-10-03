import {ID, COLORS, FLOWERS, escapeHTML as esc, isFighter} from "./rules.js";
import {t, formDialog, owner, chat, gmOnly} from "./helpers.js";
import {request} from "./socket.js";
export let skills = [], stages = [];
export async function loadCatalog() {
  const responses = await Promise.all([fetch(`systems/${ID}/data/skills.json`), fetch(`systems/${ID}/data/stages.json`)]);
  if (responses.some(r => !r.ok)) throw Error("Cannot load skill/stage catalog");
  [skills, stages] = await Promise.all(responses.map(r => r.json()));
}
export function skillDocument(record, slot = 0) {
  const typeLine = record.text.match(/Type\s+(.*?)\s+Timing/);
  return {name:record.name, type:"ability", img:`systems/${ID}/assets/emblem.svg`, system:{
    key:record.id, type:record.group, class:typeLine?.[1] ?? "", timing:record.timing,
    timingKey:record.timing, effect:record.text, page:record.page, number:slot, charge:0}};
}
export async function setupActor(actor) {
  const flower = actor.system.details.crest.flower, color = actor.system.details.crest.color;
  const content = `<p>${esc(t("LoadoutHelp"))}</p><label>${esc(t("Crest"))}<select name="color">${Object.keys(COLORS).map(v=>`<option ${v===color?'selected':''}>${v}</option>`).join("")}</select></label>
    <label>${esc(t("CrestAnd"))}<select name="flower">${FLOWERS.map(v=>`<option ${v===flower?'selected':''}>${v}</option>`).join("")}</select></label><p>Choose the color and flower first. The next dialog chooses the five skills.</p>`;
  const choice = await formDialog(t("Setup"), content, f => ({color:f.elements.color.value, flower:f.elements.flower.value}));
  if (!choice) return;
  const available = skills.filter(s => [choice.flower,choice.color].includes(s.group));
  const selected = await formDialog(t("Library"), Array.from({length:5},(_,i)=>`<label>Slot ${i+2}<select name="s${i}">${available.map((s,j)=>`<option value="${s.id}" ${j===i?'selected':''}>${esc(s.name)}</option>`).join("")}</select></label>`).join(""),
    f => Array.from({length:5},(_,i)=>f.elements[`s${i}`].value));
  if (!selected) return;
  await request("loadout", {actor:actor.id,...choice,selected});
}
export async function createLoadout(data, user) {
  const a = owner(game.actors.get(data.actor),user);
  if (!isFighter(a) || !COLORS[data.color] || !FLOWERS.includes(data.flower)) throw Error("Invalid flower/color");
  if (data.selected?.length!==5 || new Set(data.selected).size!==5) throw Error("Choose five different skills");
  const chosen = data.selected.map(key => skills.find(s=>s.id===key && [data.flower,data.color].includes(s.group)));
  if (chosen.some(s=>!s)) throw Error("Skill does not belong to your Flower/Color");
  if (game.settings.get(ID,"battle").active) throw Error("Cannot replace a loadout during a battle");
  const stats = COLORS[data.color];
  await a.update({"system.details.crest":{color:data.color,flower:data.flower}, "system.hp":{value:stats.hp,max:stats.hp,min:0},
    "system.defense.value":stats.defense,"system.charge.value":stats.charge});
  // p.120: changing a loadout keeps learned skills in reserve.
  await a.updateEmbeddedDocuments("Item",a.items.filter(i=>i.type==="ability" && i.system.number>0).map(i=>({_id:i.id,"system.number":0,"system.charge":0})));
  const create=[],update=[];
  [skills[0],...chosen].forEach((s,index)=>{
    const existing=a.items.find(i=>i.system.key===s.id);
    if(existing)update.push({_id:existing.id,"system.number":index+1});else create.push(skillDocument(s,index+1));
  });
  if(update.length)await a.updateEmbeddedDocuments("Item",update);
  if(create.length)await a.createEmbeddedDocuments("Item",create);
}
export async function importLibrary(user) {
  gmOnly(user);
  const existing = new Set(game.items.map(i=>i.system.key));
  await Item.createDocuments(skills.filter(s=>!existing.has(s.id)).map(s=>skillDocument(s)));
  await chat(t("Library"), `${skills.length} skills ready. Stage data are available in the Stellar Battle panel.`);
}
