import {ID, COSTS, integer, defense, allocate, shiftDie, successes, adjacent, endurance, enemyBlessing, isEnemy, isFighter, escapeHTML as esc} from "./rules.js";
import {state, saveState, byId, owner, gmOnly, currentActors, chat, rollDice, t} from "./helpers.js";
import {createLoadout, importLibrary, stages} from "./library.js";
import {useSkill, runSteps} from "./skills-engine.js";
import {setRoutine, readOmen, executeOmen, cutRoutine} from "./stages.js";
import {sessionAction,session} from "./session.js";
export function effectiveDefense(a, check = null) {
  let value = a.system.defense.value;
  if (a.items.some(i=>i.system.key==="royal-rose-dress" && i.system.charge>0)) value--;
  for (const m of a.system.modifiers) if (m.kind==="defense") value+=m.value;
  const s=state(); if (s.markers?.some(m=>m.kind==="war" && m.garden===a.system.garden)) value--;
  if (check?.gardenDefense) value=a.system.garden;
  return defense(value+(check?.defense?.[a.id]??0));
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
  if(slots.some(i=>!i)) throw Error("A complete six-slot loadout is required");
  await a.updateEmbeddedDocuments("Item",slots.map((item,i)=>({_id:item.id,"system.charge":item.system.charge+counts[i]})));
}
export async function bonusCharge(a,count) {
  if(a.system.hp.value===0)return;
  const {values,roll}=await rollDice(count);
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
  const valid=targets.map(byId).filter(target=>target.system.hp.value>0 && (options.stage || options.ignoreRange || adjacent(a.system.garden,target.system.garden)));
  if(!valid.length) {await chat(t("Attack"),"No target in range: zero successes.",a);if(options.continuation) await runSteps(options.continuation); return;}
  let modifiers=a?.system.modifiers??[];
  let dice=count+(a?.system.blessings.attack??0)+modifiers.filter(m=>m.kind==="attack").reduce((sum,m)=>sum+m.value,0);
  if(a?.items.some(i=>i.system.key==="royal-rose-dress" && i.system.charge>0))dice++;
  if(a?.system.atypia)dice+=3;
  // Yellow Queen stacks per target; all selected targets must share a pool.
  dice-=Math.max(0,...valid.map(target=>target.system.modifiers.filter(m=>m.kind==="queen").reduce((sum,m)=>sum+m.value,0)));
  const check={kind:"attack",actor:a?.id??null,title:options.title,count:Math.max(0,dice),targets:valid.map(v=>v.id),
    rolled:false,values:[],boosts:0,rerolled:false,defense:options.defense??{},stage:!!options.stage,ignoreRange:!!options.ignoreRange,
    atypia:a?.system.atypia??false,after:options.after??null,continuation:options.continuation??null};
  await createCheck(check);
}
async function rollAttack(user) {
  const {message,c}=pendingCheck();checkAuthority(c,user);if(c.rolled)throw Error("Already rolled");
  const a=c.actor?byId(c.actor):null;
  if(a && a.system.hp.value===0) throw Error("Attacker is incapacitated");
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
    await addDice(byId(c.actor),c.values);results.push("Set dice allocated to slots 1–6.");
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
  await victory();
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
  if(!s.active || s.phase!=="charge" || !s.actors.includes(a.id) || s.charged.includes(a.id))throw Error("Not in Charge phase or already charged");
  if(a.system.hp.value===0)throw Error("Incapacitated characters cannot Charge");
  const count=a.system.charge.value+s.round+a.system.blessings.charge;
  const {values,roll}=await rollDice(count);
  await createCheck({kind:"charge",actor:a.id,count,values,rolled:true,boosts:0,rerolled:false,petiteIndex:null},roll);
  const next=state();next.charged.push(a.id);await saveState(next);await rolledMarkers(a,values);
}
async function distortion(data,user) {
  const a=owner(byId(data.actor),user);if(!isFighter(a)||isEnemy(a)||a.system.distortion>=3)throw Error("Distortion is unavailable");
  if(!state().active || !state().actors.includes(a.id))throw Error("Distortion requires an active battle");
  if(!["life","atypia"].includes(data.effect))throw Error("Unknown Distortion effect");
  await a.update({"system.distortion":a.system.distortion+1});
  if(data.effect==="life") {
    const {values}=await rollDice(2);await heal(a,values.reduce((sum,n)=>sum+n,0),true);
  } else {await heal(a,4,true);await a.update({"system.atypia":true});}
  await chat(t("Distortion"),`${esc(data.effect)} · ${a.system.distortion}/3${a.system.distortion===3?" — Eclipsed next session":""}`,a);
}
async function startBattle(data,user) {
  gmOnly(user);if(state().active)throw Error("Battle already active");
  const actors=[...new Set(data.actors)].map(byId);
  if(!actors.length||actors.some(a=>!isFighter(a)))throw Error("Choose combatants");
  const enemies=actors.filter(isEnemy),knights=actors.filter(a=>!isEnemy(a));
  if(enemies.length!==1||!knights.length)throw Error("Choose one Enemy and at least one Bringer");
  const stage=stages.find(s=>s.id===data.stage);if(!stage)throw Error("Choose a Stage");
  for(const a of actors) {
    const slots=a.items.filter(i=>i.system.number>0);
    if(slots.length!==6||new Set(slots.map(i=>i.system.number)).size!==6)throw Error(`${a.name}: build a six-slot loadout first`);
  }
  const s={active:true,round:1,phase:"set",actors:[enemies[0].id,...knights.map(a=>a.id)],turn:0,stage:stage.id,
    omenIndex:0,omen:null,pending:null,charged:[],maps:[],markers:[],damage:{},supported:[],decisive:[],awarded:false};
  await saveState(s);
  for(const a of actors) {
    const blessing=isEnemy(a)?enemyBlessing(knights.length):{hp:0,charge:0,attack:0};
    await a.update({"system.hp.value":a.system.hp.max+blessing.hp,"system.blessings":blessing,"system.done":false,
      "system.modifiers":[],"system.atypia":false,"system.flames":0,"system.bouquetSpent":0});
    await a.updateEmbeddedDocuments("Item",a.items.map(i=>({_id:i.id,"system.charge":0,"system.uses":{}})));
  }
  await chat(t("Start"),`${esc(stage.name)} · Round 1`);await setRoutine();
}
async function advance(user) {
  gmOnly(user);let s=state();if(!s.active)throw Error("No active battle");if(s.pending)throw Error(t("Pending"));
  if(s.freeEnemy)throw Error("The Enemy must use its granted Stage skill first");
  if(s.phase==="set") {s.phase="charge";await saveState(s);}
  else if(s.phase==="charge") {
    if(s.actors.some(id=>byId(id).system.hp.value>0&&!s.charged.includes(id)))throw Error("All active combatants must Charge first");
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
  if(win||lose) {s.active=false;s.outcome=win?"victory":"defeat";await saveState(s);await chat(t("Battle"),s.outcome+" · Use Award Medals to finish the Curtain Call.");}
}
async function award(data,user) {
  gmOnly(user);const s=state();if(s.active||!s.outcome||s.awarded)throw Error("Finish a battle before awarding; only once per battle");
  for(const a of currentActors().filter(a=>!isEnemy(a))) {
    const medals=Number(s.outcome==="victory")+Number(s.decisive.includes(a.id))+Number(a.system.hp.value>=a.system.hp.max)
      +Number(s.supported.includes(a.id))+Number(data.conversed?.includes(a.id));
    await a.update({"system.exp":a.system.exp+medals});await chat(t("Award"),`${medals} medals`,a);
  }
  s.awarded=true;await saveState(s);
}
export async function execute(op,data,user) {
  if(["roll","resolve","report-reroll"].includes(op)&&data.message&&data.message!==state().pending)throw Error("That check has ended");
  switch(op) {
    case "session-start":case "session-next":case "sync-pair":return sessionAction(op,data,user);
    case "loadout":return createLoadout(data,user);
    case "import":return importLibrary(user);
    case "charge":return charge(data,user);
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
      if(state().active && !game.settings.get(ID,"allowBattleBouquets"))throw Error("No Audience in the Final Chapter. Enable the house rule to give new Bouquets during battle.");
      const narrative=session();
      if(narrative.active && ["chapter-one","chapter-two","interlude"].includes(narrative.phase) && narrative.pairs[narrative.cursor]!==a.id)
        throw Error("Only the current scene's pair receives Bouquets");
      await a.update({"system.bouquet":a.system.bouquet+1});return chat(t("Give"),`${esc(user.name)} → ${esc(a.name)} (${a.system.bouquet})`);
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
      gmOnly(user);const s=state();if(s.phase!=="set")throw Error("Change acting order in Set phase");
      const index=s.actors.indexOf(data.actor),dest=index+integer(data.delta,-1,1);
      if(index<=0||dest<=0||dest>=s.actors.length)throw Error("Enemy acts first");
      [s.actors[index],s.actors[dest]]=[s.actors[dest],s.actors[index]];return saveState(s);
    }
    case "flame-retaliate": {
      const a=owner(byId(data.actor),user),s=state(),d=s.damage?.[a.id];
      if(!d?.source||!d.amount||!a.system.flames||d.flameUsed)throw Error("No eligible Flame Counter retaliation");
      d.flameUsed=true;await saveState(s);return changeHP(byId(d.source),-a.system.flames,{source:a.id});
    }
    case "end": {gmOnly(user);const s=state();s.active=false;s.pending=null;return saveState(s);}
    default:throw Error("Unknown action");
  }
}
