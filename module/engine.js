import {ID, COSTS, integer, defense, allocate, shiftDie, successes, adjacent, endurance, enemyBlessing, isEnemy, isFighter, escapeHTML as esc} from "./rules.js";
import {state, saveState, byId, owner, gmOnly, currentActors, chat, rollDice, t,directorMode,directorOverride} from "./helpers.js";
import {createLoadout, importLibrary, stages} from "./library.js";
import {useSkill, runSteps} from "./skills-engine.js";
import {setRoutine, readOmen, executeOmen, cutRoutine,turnOmen} from "./stages.js";
import {sessionAction,session} from "./session.js";
import {ensureCombat,stellarCombat,setCombatOrder} from "./combat-state.js";
import {crestStats,crestItems,validateSkillSlot} from "./crest.js";
const activeFor=a=>{const s=state();return !!(s.active&&s.actors.includes(a.id));};
const currentModifiers=a=>(a.system.modifiers??[]).filter(m=>activeFor(a)||!['battle','round','next-attack'].includes(m.duration));
const dressActive=a=>activeFor(a)&&a.items.some(i=>i.system.key==='royal-rose-dress'&&i.system.number>0&&i.system.charge>0);
export function effectiveDefense(a,check=null) {
  let value=crestStats(a).defense;
  if(dressActive(a))value--;
  for(const m of currentModifiers(a))if(m.kind==='defense')value+=m.value;
  const s=state();if(activeFor(a)&&s.markers?.some(m=>m.kind==='war'&&m.garden===a.system.garden))value--;
  if(check?.gardenDefense)value=a.system.garden;
  return defense(value+(check?.defense?.[a.id]??0));
}
export function effectiveCharge(a) {
  const s=state();return Math.max(0,crestStats(a).charge+(activeFor(a)?s.round+(a.system.blessings?.charge??0):0));
}
export function effectiveAttackBonus(a) {
  return (activeFor(a)?(a.system.blessings?.attack??0)+(a.system.atypia?3:0):0)
    +currentModifiers(a).filter(m=>m.kind==='attack').reduce((sum,m)=>sum+m.value,0)+(dressActive(a)?1:0);
}
export async function changeHP(a, delta, {revive=false, source=null, check=null}={}) {
  const previous=a.system.hp.value, value=endurance(previous,delta,{revive});
  await a.update({"system.hp.value":value});
  if (delta<0) {
    const s=state(); s.damage??={}; s.damage[a.id]={amount:previous-value,source,check,round:s.round,at:Date.now()};
    if (value===0 && previous>0 && source && !isEnemy(byId(source)) && isEnemy(a)) {s.decisive??=[];s.decisive.push(source);}
    await saveState(s);
  }
  return previous-value;
}
export async function heal(a, n, revive=false) {if (a.system.hp.value>0 || revive) await changeHP(a,n,{revive});}
export async function addDice(a, values) {
  const counts=allocate(values);
  const slots=Array.from({length:6},(_,i)=>a.items.find(item=>item.system.number===i+1));
  if(!directorMode()&&slots.some(i=>!i)) throw Error("A complete six-slot loadout is required");
  await a.updateEmbeddedDocuments("Item",slots.flatMap((item,i)=>item?[{_id:item.id,"system.charge":item.system.charge+counts[i]}]:[]));
  return counts.flatMap((count,i)=>!slots[i]&&count?[{number:i+1,count}]:[]);
}
export async function bonusCharge(a,count) {
  if(a.system.hp.value===0)return;
  const {values,roll}=await rollDice(count);
  if(state().nativeControls){await addDice(a,values);await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:a}),rolls:roll?[roll]:[],content:`<h3>Bonus Charge · ${esc(a.name)}</h3><p>${values.join(', ')}</p>`});return;}
  await createCheck({kind:"charge",actor:a.id,values,rolled:true,bonus:true,count,boosts:0,rerolled:false,petiteIndex:null},roll);
}
function checkHTML(c) {
  const actor=c.actor?byId(c.actor):null;
  return `<article class="stella-chat"><h3>${esc(c.title??(c.kind==="charge"?t("RollCharge"):t("Attack")))} ${esc(actor?.name??"Stage")}</h3>
    <p>${c.values?.map((n,i)=>`<span class="stella-die" title="Die ${i+1}">${n}</span>`).join(" ")??""}</p>
    <p>${esc(c.status??(c.rolled?"After roll — reactions / Bouquet, then resolve":"Before attack — reactions / Dice Boost, then roll"))}</p>
    ${c.resolved?`<p>${esc(c.summary??"")}</p>`:`<div class="stella-check-buttons">
    ${!c.rolled?'<button type="button" data-stella="roll">'+t("Roll")+'</button>':'<button type="button" data-stella="resolve">'+t("Resolve")+'</button>'}
    ${c.rolled?'<button type="button" data-stella="reroll">'+t("Reroll")+'</button><button type="button" data-stella="report-reroll">Session report re-roll</button>':''}
    ${c.kind==="charge"?'<button type="button" data-stella="petite">'+t("Petite")+'</button>':(!c.rolled?'<button type="button" data-stella="boost">'+t("Boost")+'</button>':'')}
    </div>`}</article>`;
}
export async function updateCheck(message,c,roll=null) {
  const data={content:checkHTML(c),[`flags.${ID}.check`]:c};
  if(roll)data.rolls=[...message.rolls,roll];
  await message.update(data);
}
export async function createCheck(c,roll=null) {
  const s=state(); if(s.pending)throw Error(t("Pending"));
  const m=await ChatMessage.create({speaker:ChatMessage.getSpeaker(c.actor?{actor:byId(c.actor)}:{}),content:checkHTML(c),
    rolls:roll?[roll]:[],flags:{[ID]:{check:c}}});
  s.pending=m.id;await saveState(s);return m;
}
export function pendingCheck() {
  const id=state().pending,m=game.messages.get(id);
  if(!m)throw Error("No pending check");
  return {message:m,c:foundry.utils.deepClone(m.getFlag(ID,"check"))};
}
function checkAuthority(c,user) {c.actor?owner(byId(c.actor),user):gmOnly(user);}
export async function attack(a, count, targets, options={}) {
  const valid=targets.map(byId).filter(target=>(options.ignoreRange||target.system.hp.value>0) && (options.stage || options.ignoreRange || adjacent(a.system.garden,target.system.garden)));
  if(!valid.length) {await chat(t("Attack"),"No target in range: zero successes.",a);if(options.continuation) await runSteps(options.continuation); return;}
  let dice=count+(a?effectiveAttackBonus(a):0);
  // Yellow Queen stacks per target; all selected targets must share a pool.
  dice-=Math.max(0,...valid.map(target=>target.system.modifiers.filter(m=>m.kind==="queen").reduce((sum,m)=>sum+m.value,0)));
  if(options.stage&&state().nativeControls){
    const {values,roll}=await rollDice(Math.max(0,dice));const damage={};
    for(const target of valid)damage[target.id]=await changeHP(target,-successes(values,effectiveDefense(target)),{source:null});
    await ChatMessage.create({speaker:ChatMessage.getSpeaker(),rolls:roll?[roll]:[],content:`<h3>${esc(options.title??'Stage Attack')}</h3><p>${values.join(', ')}</p><p>${valid.map(target=>`${esc(target.name)}: ${damage[target.id]} damage`).join(' · ')}</p>`});
    if(options.after)await runSteps({...options.after,damage,values});
    if(options.continuation)await runSteps({...options.continuation,damage,values});return;
  }
  const check={kind:"attack",actor:a?.id??null,title:options.title,count:Math.max(0,dice),targets:valid.map(v=>v.id),
    rolled:false,values:[],boosts:0,rerolled:false,defense:options.defense??{},stage:!!options.stage,ignoreRange:!!options.ignoreRange,
    atypia:a?.system.atypia??false,after:options.after??null,continuation:options.continuation??null};
  await createCheck(check);
}
async function rollAttack(user) {
  const {message,c}=pendingCheck();checkAuthority(c,user);if(c.rolled)throw Error("Already rolled");
  const a=c.actor?byId(c.actor):null;
  if(!c.ignoreRange&&!directorOverride(user)&&a && a.system.hp.value===0) throw Error("Attacker is incapacitated");
  const {values,roll}=await rollDice(c.count+c.boosts,{atypia:c.atypia});
  c.values=values;c.rolled=true;await updateCheck(message,c,roll);
  if(a)await a.update({"system.atypia":false,"system.modifiers":a.system.modifiers.filter(m=>m.duration!=="next-attack")});
  await rolledMarkers(a,values);
}
export async function rolledMarkers(a,values) {
  if(a && !isEnemy(a) && state().markers?.some(m=>m.kind==="ghost" && m.garden===a.system.garden))
    for(const n of values)if(n===a.system.garden)await changeHP(a,-state().round);
}
async function resolveCheck(user) {
  const {message,c}=pendingCheck();checkAuthority(c,user);if(!c.rolled||c.resolved)throw Error("Check is not ready");
  const results=[];
  if(c.kind==="charge") {
    const unassigned=await addDice(byId(c.actor),c.values);results.push("Set dice allocated to populated slots 1–6.");
    if(unassigned.length)results.push("Empty slots (Director assigns manually): "+unassigned.map(({number,count})=>`${number}: ${count} dice`).join(", "));
  } else {
    const a=c.actor?byId(c.actor):null;
    for(const id of c.targets) {
      const target=byId(id);
      const valid=!a || c.stage || c.ignoreRange || adjacent(a.system.garden,target.system.garden);
      let damage=valid?successes(c.values,effectiveDefense(target,c)):0;
      if(c.half?.includes(id))damage-=Math.floor(damage/2);
      if(c.reduce?.[id])damage=Math.max(0,damage-c.reduce[id]);
      const actual=await changeHP(target,-damage,{source:a?.id??null,check:message.id});
      results.push(`${target.name}: ${actual} damage (Defense ${effectiveDefense(target,c)})`);
      c.damage??={};c.damage[id]=actual;
    }
  }
  c.resolved=true;c.summary=results.join(" · ");await updateCheck(message,c);
  const s=state();s.pending=null;s.lastCheck=message.id;await saveState(s);
  await victory();
  if(!state().active)return; // p.138: battle ends as soon as a victory condition is met.
  if(c.after)await runSteps({...c.after,damage:c.damage??{},values:c.values});
  if(c.continuation && !state().pending)await runSteps({...c.continuation,damage:c.damage??{},values:c.values});
  await victory();await turnOmen();
}
async function bouquetOffer(data,user) {
  const payer=owner(byId(data.payer),user),{message,c}=pendingCheck();
  if(data.check && data.check!==message.id)throw Error("That check has ended");
  if(isEnemy(byId(c.actor??payer.id))||!c.actor)throw Error("Bouquets can only support a Stellar Knight's check");
  if(!COSTS[data.effect] || payer.system.bouquet<COSTS[data.effect])throw Error("Not enough Bouquets");
  validateBouquet(c,data);
  const offer={payer:payer.id,recipient:c.actor,check:message.id,effect:data.effect,index:data.index,delta:data.delta,accepted:false};
  await chat(t("Support"),`${esc(payer.name)} → ${esc(byId(c.actor).name)}: ${esc(data.effect)} (${COSTS[data.effect]} Bouquet)
    <button type="button" data-stella="accept-offer">Accept support</button>`,payer,{offer});
}
function validateBouquet(c,data) {
  if(c.resolved)throw Error("Check is resolved");
  if(data.effect==="boost" && (c.kind!=="attack" || c.rolled || c.boosts>=3))throw Error("Dice Boost: before Attack, maximum three boosts per check");
  if(data.effect==="reroll" && (!c.rolled || c.rerolled))throw Error("Re-roll: only once per check, after rolling");
  if(data.effect==="petite") {
    if(c.kind!=="charge" || !c.rolled)throw Error("Petite Lucky: only after Charge");
    shiftDie(c.values,data.index,data.delta,c.petiteIndex);
  }
}
async function acceptOffer(data,user) {
  const m=game.messages.get(data.message),offer=foundry.utils.deepClone(m?.getFlag(ID,"offer"));
  if(!offer || offer.accepted)throw Error("Offer was already accepted or does not exist");
  owner(byId(offer.recipient),user);
  const {message,c}=pendingCheck();if(message.id!==offer.check)throw Error("That check has ended");
  validateBouquet(c,offer);
  const payer=byId(offer.payer),cost=COSTS[offer.effect];
  if(payer.system.bouquet<cost)throw Error("Not enough Bouquets");
  let roll=null;
  if(offer.effect==="petite"){c.values=shiftDie(c.values,offer.index,offer.delta,c.petiteIndex);c.petiteIndex=Number(offer.index);}
  if(offer.effect==="boost")c.boosts++;
  if(offer.effect==="reroll") {
    ({values:c.values,roll}=await rollDice(c.values.length,{atypia:c.atypia}));c.rerolled=true;
    await rolledMarkers(c.actor?byId(c.actor):null,c.values);
  }
  offer.accepted=true;
  await m.update({[`flags.${ID}.offer`]:offer,content:`<p>${esc(payer.name)}: ${esc(offer.effect)} accepted (${cost} Bouquet)</p>`});
  await payer.update({"system.bouquet":payer.system.bouquet-cost,"system.bouquetSpent":payer.system.bouquetSpent+cost});
  await updateCheck(message,c,roll);
  if(payer.id!==offer.recipient){const s=state();s.supported??=[];s.supported.push(payer.id);await saveState(s);}
}
async function charge(data,user) {
  const a=owner(byId(data.actor),user),s=state();
  if(!isFighter(a)||(!directorOverride(user)&&(!s.active || (!s.nativeControls&&s.phase!=="charge") || !s.actors.includes(a.id) || s.charged.includes(a.id))))throw Error("Not in Charge phase or already charged");
  if(!directorOverride(user)&&a.system.hp.value===0)throw Error("Incapacitated characters cannot Charge");
  if(s.nativeControls&&s.charged.includes(a.id))throw Error("Already charged this Foundry Round");
  const count=effectiveCharge(a);
  const {values,roll}=await rollDice(count);
  await createCheck({kind:"charge",actor:a.id,count,values,rolled:true,boosts:0,rerolled:false,petiteIndex:null},roll);
  const next=state();next.charged??=[];if(!next.charged.includes(a.id))next.charged.push(a.id);if(next.nativeControls){next.chargedRounds??={};next.chargedRounds[next.round]=[...next.charged];}await saveState(next);await rolledMarkers(a,values);
}
async function distortion(data,user) {
  const a=owner(byId(data.actor),user);if(!isFighter(a)||(!directorOverride(user)&&(isEnemy(a)||a.system.distortion>=3)))throw Error("Distortion is unavailable");
  if(!directorOverride(user)&&(!state().active || !state().actors.includes(a.id)))throw Error("Distortion requires an active battle");
  if(!["life","atypia"].includes(data.effect))throw Error("Unknown Distortion effect");
  await a.update({"system.distortion":a.system.distortion+1});
  if(data.effect==="life") {
    const {values}=await rollDice(2);await heal(a,values.reduce((sum,n)=>sum+n,0),true);
  } else {await heal(a,4,true);await a.update({"system.atypia":true});}
  await chat(t("Distortion"),`${esc(data.effect)} · ${a.system.distortion}/3${a.system.distortion===3?" — Eclipsed next session":""}`,a);
}
export async function clearCombatDice(ids) {
  for(const id of new Set(ids)){
    const actor=typeof id==='string'?(game.actors.get(id)??(typeof globalThis.fromUuid==='function'&&id.includes('.')?await fromUuid(id):null)):id;if(!actor)continue;
    const updates=actor.items.filter(i=>i.type==='ability'&&i.system.charge!==0).map(i=>({_id:i.id,'system.charge':0}));
    if(updates.length)await actor.updateEmbeddedDocuments('Item',updates);
  }
}
export async function syncNativeCombat(data,user) {
  gmOnly(user);const combat=stellarCombat();
  if(!combat||combat.id!==data.combat)throw Error("Select the active Stellar Combat first");
  const raw=combat.getFlag(ID,"battle");if(!raw?.active)return;
  const s=state(),oldRound=raw.initializedRound??raw.round;
  s.nativeControls=true;s.phase="actions";s.combatTurn=combat.turn??0;s.turn=s.actors.indexOf(combat.turns[s.combatTurn]?.actor?.id);s.chargedRounds??={};
  if(!raw.nativeControls&&raw.charged?.length)s.chargedRounds[oldRound]=[...raw.charged];
  s.charged=s.chargedRounds[s.round]??[];
  if(s.round!==oldRound){
    s.maps=[];s.damage={};s.omen=null;s.freeEnemy=null;s.initializedRound=s.round;
    for(const a of currentActors())await a.update({"system.done":false,"system.modifiers":a.system.modifiers.filter(m=>m.duration!=="round")});
  }
  await saveState(s);
  if(s.round>oldRound)await setRoutine();
  await turnOmen();
}
async function chargeAll(data,user) {
  gmOnly(user);const initial=state();
  if(!initial.active||!initial.combatId)throw Error("Start a Foundry Combat first");
  if(initial.pending)throw Error(t("Pending"));
  await syncNativeCombat({combat:initial.combatId},user);
  const s=state();if(s.pending)throw Error(t("Pending"));
  const actors=currentActors().filter(a=>isFighter(a)&&a.system.hp.value>0&&!s.charged.includes(a.id));
  // Validate every pool before spending dice, so a malformed actor cannot interrupt the batch midway.
  for(const a of actors){integer(effectiveCharge(a),0,100);if(!directorMode()&&Array.from({length:6},(_,i)=>i+1).some(n=>!a.items.some(item=>item.type==='ability'&&item.system.number===n)))throw Error(`${a.name}: incomplete Skill loadout`);}
  for(const a of actors){
    const {values,roll}=await rollDice(effectiveCharge(a));
    const empty=await addDice(a,values);
    const next=state();next.chargedRounds??={};next.chargedRounds[next.round]??=[];next.chargedRounds[next.round].push(a.id);next.charged=next.chargedRounds[next.round];await saveState(next);
    const note=empty.length?`<p>Empty slots — Director assigns manually: ${empty.map(x=>`${x.number}: ${x.count}`).join(', ')}</p>`:'';
    await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:a}),rolls:roll?[roll]:[],content:`<article class="stella-chat"><h3>Charge Dice · ${esc(a.name)} · Round ${s.round}</h3><p>${values.join(', ')||'0 dice'}</p><p>Set dice allocated to Skill slots.</p>${note}</article>`,flags:{[ID]:{batchCharge:{actor:a.id,round:s.round,values}}}});
    await rolledMarkers(a,values);
  }
  return {round:s.round,charged:actors.map(a=>a.id)};
}
async function startBattle(data,user) {
  gmOnly(user);if(state().active)throw Error("Battle already active");
  const members=[...new Set(data.actors)].map(byId),stageActor=members.find(a=>a.type==="stage"&&(!data.stageActor||a.id===data.stageActor)),actors=members.filter(isFighter);
  if(!stageActor)throw Error("Add a Stage Token to this Combat before starting");
  if(data.combat&&!game.combats.get(data.combat)?.combatants.some(c=>c.actorId===stageActor.id&&c.tokenId))throw Error("Add a Stage Token to this Combat before starting");
  if(!actors.length||members.some(a=>!isFighter(a)&&a.type!=="stage"))throw Error("Choose combatants");
  if(!data.combat&&!globalThis.canvas?.scene?.tokens?.some(t=>t.actorId===stageActor.id))throw Error("Add a Stage Token to the active scene and Combat before starting");
  const enemies=actors.filter(isEnemy),knights=actors.filter(a=>!isEnemy(a));
  if(!directorMode()&&(enemies.length!==1||!knights.length))throw Error("Choose one Enemy and at least one Bringer");
  const stage={id:stageActor.system.key,name:stageActor.name};
  if(!directorMode())for(const a of actors) {
    const crest=crestItems(a);if(!crest.color||!crest.flower)throw Error(`${a.name}: choose Flower and Color Items first`);
    const slots=a.items.filter(i=>i.type==="ability"&&i.system.number>0);
    for(const skill of slots)validateSkillSlot(a,skill,skill.system.number);
    if(slots.length!==6||new Set(slots.map(i=>i.system.number)).size!==6)throw Error(`${a.name}: build a six-slot loadout first`);
  }
  const ordered=actors;
  await ensureCombat(members,data.combat);
  if(!stellarCombat()?.combatants.some(c=>c.actorId===stageActor.id&&c.tokenId))throw Error("Add a Stage Token to this Combat before starting");
  const s={active:true,round:1,phase:data.nativeControls?"actions":"set",nativeControls:!!data.nativeControls,stageActor:stageActor.id,combatTurn:0,initializedRound:1,chargedRounds:{},actors:ordered.map(a=>a.id),turn:0,stage:stage?.id??"none",
    omenIndex:stageActor.system.omen??0,omenTurns:[],omen:null,pending:null,charged:[],maps:[],markers:[],damage:{},supported:[],decisive:[],awarded:false};
  await saveState(s);
  for(const a of actors) {
    const blessing=isEnemy(a)?enemyBlessing(knights.length):{hp:0,charge:0,attack:0};
    await a.update({"system.hp.value":(crestItems(a).color?crestStats(a).hp:a.system.hp.value)+blessing.hp,"system.blessings":blessing,"system.done":false,
      "system.modifiers":[],"system.atypia":false,"system.flames":0,"system.bouquetSpent":0});
    await a.updateEmbeddedDocuments("Item",a.items.filter(i=>i.type==="ability").map(i=>({_id:i.id,"system.charge":0,"system.uses":{}})));
  }
  await chat(t("Start"),`${esc(stage?.name??"Director-managed battle")} · Round 1`);await setRoutine();if(data.nativeControls)await turnOmen();
}
async function advance(user) {
  if(state().nativeControls)throw Error("Use Foundry Combat Tracker to advance turns and rounds");
  gmOnly(user);let s=state();if(!s.active)throw Error("No active battle");if(s.pending)throw Error(t("Pending"));
  if(!directorOverride(user)&&s.freeEnemy)throw Error("The Enemy must use its granted Stage skill first");
  if(directorOverride(user)&&s.freeEnemy){s.freeEnemy=null;await saveState(s);}
  if(s.phase==="set") {s.phase="charge";await saveState(s);}
  else if(s.phase==="charge") {
    if(!directorOverride(user)&&s.actors.some(id=>byId(id).system.hp.value>0&&!s.charged.includes(id)))throw Error("All active combatants must Charge first");
    s.phase="actions";s.turn=0;await saveState(s);await skipIncapacitated();await readOmen();
  } else if(s.phase==="actions") {
    const a=byId(s.actors[s.turn]);await a.update({"system.done":true});
    if(!isEnemy(a) && s.omen && !s.omen.executed){await executeOmen();if(state().pending)return;}
    s=state();s.turn++;s.omen=null;await saveState(s);await skipIncapacitated();s=state();
    if(s.turn>=s.actors.length){s.phase="cut";await saveState(s);await cutRoutine();}
    else await readOmen();
  } else {
    s.round++;s.phase="set";s.turn=0;s.charged=[];s.maps=[];s.damage={};await saveState(s);
    for(const a of currentActors())await a.update({"system.done":false,"system.modifiers":a.system.modifiers.filter(m=>m.duration!=="round")});
    await setRoutine();
  }
  await victory();
}
async function skipIncapacitated() {
  const s=state();while(s.turn<s.actors.length && byId(s.actors[s.turn]).system.hp.value===0)s.turn++;
  if(s.turn>=s.actors.length)s.phase="cut";await saveState(s);
}
export async function victory() {
  const s=state();if(!s.active||s.pending)return;
  const actors=currentActors();const win=actors.filter(isEnemy).every(a=>a.system.hp.value===0),lose=actors.filter(a=>!isEnemy(a)).every(a=>a.system.hp.value===0);
  if(!directorMode()&&(win||lose)) {s.active=false;s.outcome=win?"victory":"defeat";await saveState(s);await chat(t("Battle"),s.outcome+" · Use Award Medals to finish the Curtain Call.");}
}
async function award(data,user) {
  gmOnly(user);const s=state();if(s.active||!s.outcome||s.awarded)throw Error("Finish a battle before awarding; only once per battle");
  for(const a of currentActors().filter(a=>!isEnemy(a))) {
    const medals=Number(s.outcome==="victory")+Number(s.decisive.includes(a.id))+Number(a.system.hp.value>=crestStats(a).hp)
      +Number(s.supported.includes(a.id))+Number(data.conversed?.includes(a.id));
    await a.update({"system.exp":a.system.exp+medals});await chat(t("Award"),`${medals} medals`,a);
  }
  s.awarded=true;await saveState(s);
}
export async function execute(op,data,user) {
  if(data.combat&&["advance","end","charge-all","native-sync"].includes(op)&&data.combat!==state().combatId)throw Error("Select the active Stellar Combat first");
  if(["roll","resolve","report-reroll"].includes(op)&&data.message&&data.message!==state().pending)throw Error("That check has ended");
  switch(op) {
    case "session-start":case "session-next":case "sync-pair":return sessionAction(op,data,user);
    case "loadout":return createLoadout(data,user);
    case "import":return importLibrary(user);
    case "charge":return charge(data,user);
    case "charge-all":return chargeAll(data,user);
    case "native-sync":return syncNativeCombat(data,user);
    case "roll":return rollAttack(user);
    case "resolve":return resolveCheck(user);
    case "offer":return bouquetOffer(data,user);
    case "accept":return acceptOffer(data,user);
    case "distortion":return distortion(data,user);
    case "use":return useSkill(data,user);
    case "start":return startBattle(data,user);
    case "advance":return advance(user);
    case "award":return award(data,user);
    case "report-reroll": {
      const {message,c}=pendingCheck();checkAuthority(c,user);if(!c.actor||!c.rolled)throw Error("Only after your Charge or Attack check");
      const a=byId(c.actor);if(!a.system.reportReroll)throw Error("No session report re-roll available");
      const {values,roll}=await rollDice(c.values.length,{atypia:c.atypia});c.values=values;
      await a.update({"system.reportReroll":false});return updateCheck(message,c,roll);
    }
    case "give": {
      const a=byId(data.actor);if(!isFighter(a)||isEnemy(a))throw Error("Give Bouquets to a Bringer");
      if(!directorMode()&&state().active && !game.settings.get(ID,"allowBattleBouquets"))throw Error("No Audience in the Final Chapter. Enable the house rule to give new Bouquets during battle.");
      const narrative=session();
      if(!directorMode()&&narrative.active && ["chapter-one","chapter-two","interlude"].includes(narrative.phase) && narrative.pairs[narrative.cursor]!==a.id)
        throw Error("Only the current scene's pair receives Bouquets");
      await a.update({"system.bouquet":a.system.bouquet+1});return chat(t("Give"),`${esc(user.name)} → ${esc(a.name)} (${a.system.bouquet})`);
    }
    case "director-update": {
      gmOnly(user);const s=state();
      if(!s.combatId)throw Error("Select a Stellar Combat first");
      if(!["set","charge","actions","cut"].includes(data.phase))throw Error("Unknown phase");
      if(data.stage!==s.stage)throw Error("Unknown Stage");
      const round=integer(data.round,1,999);
      const updates=(data.actors??[]).map(row=>({actor:byId(row.actor),values:{"system.garden":integer(row.garden,1,6),"system.hp.value":integer(row.hp,0,999),"system.bouquet":integer(row.bouquet,0,999),"system.exp":integer(row.exp,0,999),"system.distortion":integer(row.distortion,0,999)}}));
      if(updates.some(row=>!s.actors.includes(row.actor.id)))throw Error("Actor is not in this Combat");
      if(s.pending&&!data.cancelCheck&&(data.phase!==s.phase||round!==s.round||data.stage!==s.stage||data.end))throw Error("Resolve or cancel the pending check first");
      if(data.cancelCheck&&s.pending){const {message,c}=pendingCheck();c.resolved=true;c.summary="Cancelled by the Director; applied effects remain.";await updateCheck(message,c);s.pending=null;}
      for(const row of updates)await row.actor.update(row.values);
      if(data.stage!==s.stage){s.markers=[];s.maps=[];s.omen=null;s.omenIndex=0;s.freeEnemy=null;}
      s.stage=data.stage;s.phase=data.phase;s.round=round;s.turn=Math.min(s.turn??0,Math.max(0,s.actors.length-1));
      if(data.end){await clearCombatDice(s.actors);s.active=false;s.pending=null;}
      await saveState(s);return chat("Director",`Round ${round} · ${esc(s.phase)}${data.end?" · Battle ended":""}`);
    }
    case "adjust": {
      gmOnly(user);const a=byId(data.actor);const value=integer(data.value,0,999);
      if(data.field==="hp")return a.update({"system.hp.value":value});
      if(data.field==="garden")return a.update({"system.garden":integer(value,1,6)});
      throw Error("Unsupported adjustment");
    }
    case "set-die": {
      const a=owner(byId(data.actor),user),i=a.items.get(data.item);if(!i)throw Error("Skill not found");
      const delta=integer(data.delta,-1,1);return i.update({"system.charge":integer(i.system.charge+delta,0,999)});
    }
    case "reorder": {
      gmOnly(user);const s=state();if(!directorOverride(user)&&s.phase!=="set")throw Error("Change acting order in Set phase");
      const index=s.actors.indexOf(data.actor),dest=index+integer(data.delta,-1,1);
      if(index<0||dest<0||dest>=s.actors.length||(!directorOverride(user)&&(index===0||dest===0)))throw Error("Enemy acts first");
      [s.actors[index],s.actors[dest]]=[s.actors[dest],s.actors[index]];
      await setCombatOrder(stellarCombat(),s.actors);return saveState(s);
    }
    case "flame-retaliate": {
      const a=owner(byId(data.actor),user),s=state(),d=s.damage?.[a.id];
      if(!d?.source||!d.amount||!a.system.flames||d.flameUsed)throw Error("No eligible Flame Counter retaliation");
      d.flameUsed=true;await saveState(s);return changeHP(byId(d.source),-a.system.flames,{source:a.id});
    }
    case "clear-combat-dice": {gmOnly(user);return clearCombatDice(data.actors??[]);}
    case "end": {gmOnly(user);const s=state();await clearCombatDice(s.actors??[]);s.active=false;s.pending=null;return saveState(s);}
    default:throw Error("Unknown action");
  }
}
