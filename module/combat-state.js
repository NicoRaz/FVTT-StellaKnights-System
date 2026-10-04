import {ID,isFighter} from './rules.js';
export function stellarCombat() {
  const selected=game.combat?.getFlag(ID,'battle')?game.combat:null;
  if(selected?.getFlag(ID,'battle').active)return selected;
  return game.combats?.find(c=>c.getFlag(ID,'battle')?.active)??selected;
}
export function battleState() {
  const combat=stellarCombat();
  if(!combat)return foundry.utils.deepClone(game.settings.get(ID,'battle'));
  const s=foundry.utils.deepClone(combat.getFlag(ID,'battle'));
  s.actors=combat.turns.filter(c=>c.actor&&isFighter(c.actor)).map(c=>c.actor.id);
  s.round=combat.round??s.round;
  if(s.nativeControls){s.phase='actions';s.charged=s.chargedRounds?.[s.round]??[];s.combatTurn=combat.turn??0;s.turn=s.actors.indexOf(combat.turns[s.combatTurn]?.actor?.id);}
  else if(s.phase==='actions')s.turn=combat.turn??s.turn;
  s.combatId=combat.id;return s;
}
export async function persistBattle(s) {
  const combat=stellarCombat();
  if(!combat)return game.settings.set(ID,'battle',s);
  await combat.update({[`flags.${ID}.battle`]:s,round:s.round??0,turn:s.nativeControls?(s.combatTurn??combat.turn??0):s.phase==='actions'&&s.turn<s.actors.length?s.turn:null},{stellaPhaseTransition:true});
  return s;
}
export async function ensureCombat(actors,combatId=null) {
  let combat=combatId?game.combats.get(combatId):game.combat;
  if(combat?.getFlag(ID,'battle')?.active)throw Error('Combat is already active');
  if(combatId&&!combat)throw Error("Combat not found");
  if(!combat||combat.started)combat=await CONFIG.Combat.documentClass.create({scene:globalThis.canvas?.scene?.id??null,active:true});
  const seen=new Set();
  const unwanted=combat.combatants.filter(c=>{const duplicate=seen.has(c.actorId);seen.add(c.actorId);return duplicate||!actors.some(a=>c.actorId===a.id);});
  if(unwanted.length)await combat.deleteEmbeddedDocuments('Combatant',unwanted.map(c=>c.id));
  const missing=actors.filter(a=>!combat.combatants.some(c=>c.actorId===a.id));
  if(missing.length)await combat.createEmbeddedDocuments('Combatant',missing.map(a=>({actorId:a.id,name:a.name,img:a.img,
    sceneId:globalThis.canvas?.scene?.id??null,tokenId:globalThis.canvas?.scene?.tokens?.find(t=>t.actorId===a.id)?.id??null})));
  // Attach first so all subsequent phase updates use this native Combat document.
  await combat.update({[`flags.${ID}.battle`]:{active:false,round:0,phase:'set',actors:actors.map(a=>a.id),turn:0}});
  await combat.activate();return combat;
}
export async function setCombatOrder(combat,ids) {
  await combat.updateEmbeddedDocuments('Combatant',ids.map((id,index)=>({_id:combat.combatants.find(c=>c.actorId===id).id,initiative:ids.length-index})));
}
export async function archiveCombat(combat) {
  const s=combat.getFlag(ID,'battle');if(!s)return;
  await game.settings.set(ID,'battle',{...s,round:combat.round,turn:combat.turn??s.turn,actors:combat.turns.filter(c=>c.actor&&isFighter(c.actor)).map(c=>c.actor.id),active:false,pending:null,combatId:null});
}
export const orderedCombatants=combat=>combat.turns.filter(c=>c.actor);
