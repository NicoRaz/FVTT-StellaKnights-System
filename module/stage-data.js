import {ID} from './rules.js';
export function stageDocument(record) {
  const ability=(name,key,effect,timing)=>({name,type:'ability',img:`systems/${ID}/assets/emblem.svg`,system:{key,type:'Stage',timing,timingKey:'stage',effect,number:0,charge:0,parentType:'stage',parentKey:record.id}});
  return {name:record.name,type:'stage',prototypeToken:{actorLink:true},img:`systems/${ID}/assets/emblem.svg`,system:{garden:1,key:record.id,setText:record.setText,routines:structuredClone(record.actions),omen:0,description:`Stage · p.${record.page}`},
    items:[ability('Set Routine',`stage:${record.id}:set`,record.setText,'Start of Round'),...record.actions.map((r,n)=>ability(r.name,`stage:${record.id}:omen:${n}`,r.text,'Start of Turn'))]};
}
export function stageCombatant(combat) {
  return combat?.combatants.find(c=>c.actor?.type==='stage'&&!!c.tokenId);
}
export function activeStage() {
  const id=game.combat?.getFlag(ID,'battle')?.stageActor;
  return id?game.actors.get(id):null;
}
export function stageRecord() {
  const actor=activeStage();if(!actor)return null;
  return {id:actor.system.key,name:actor.name,setText:actor.system.setText,actions:actor.system.routines??[],actor};
}
