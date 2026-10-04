import {runBlockSkill} from './skill-blocks.js';
import {validateSkillSlot} from "./crest.js";
import {ID, integer, gardenDistance, adjacent, clockwise, opposite, isEnemy, isFighter, escapeHTML as esc} from "./rules.js";
import {state,saveState,byId,owner,currentActors,chat,rollDice,t,pick,directorOverride} from "./helpers.js";
import {attack,bonusCharge,heal,changeHP,pendingCheck,updateCheck,rolledMarkers,victory} from "./engine.js";
import {skills} from "./library.js";
const deathSkills=["system-aquilegia","system-calystegia","eternity-s-amaranthus"];
const allDice=[...deathSkills,"aquilegia-the-remnant"];
const roundLimited=["deep-contemplation"];
const targetRoundLimited=["mind-over-matter","nine-liverary","unlimited-libra"];
const damageReactions=["poisoned-flower-of-grief","black-avenger","unlimited-libra",...deathSkills,"aquilegia-the-remnant"];
const beforeKeys=["calystegia-sphere","wish-bringer","anemone-dress","rewrite-your-story","white-shield","lightning-intercept","black-flowers-zenith"];
const afterRollKeys=["fortress-cosmos","whirlpool-of-thought","draco-grace-command"];
function target(data,a) {return data.targets?.length?data.targets.map(byId):[a];}
function step(op,targets,value,extra={}) {return {op,targets:targets.map(a=>typeof a==="string"?a:a.id),value,...extra};}
export function validatePath(start,path,min=0,max=1) {
  if(!Array.isArray(path)||path.length<min||path.length>max)throw Error(`Movement requires ${min}–${max} spaces`);
  let previous=start;
  for(const garden of path){integer(garden,1,6);if(gardenDistance(previous,garden)!==1)throw Error("Each movement step must enter an adjacent Garden");previous=garden;}
  return path;
}
async function modify(a,m) {await a.update({"system.modifiers":[...a.system.modifiers,m]});}
export async function moveActor(a,path,{forced=false}={}) {
  validatePath(a.system.garden,path,0,12);
  for(const g of path){await a.update({"system.garden":g});
    if(!isEnemy(a) && state().markers?.some(m=>m.kind==="shark"&&m.garden===g))await changeHP(a,-(1+state().round));}
  const s=state();s.lastMove={actor:a.id,count:path.length,round:s.round,forced};await saveState(s);
  await chat(t("Move"),`${path.join(" → ")} (${path.length} spaces)`,a);
}
export async function useSkill(data,user) {
  const a=owner(byId(data.actor),user),item=a.items.get(data.item),s=state();
  if(item?.system.scriptEnabled)return runBlockSkill(data,user);
  const manual=!!data.directUse,override=manual||directorOverride(user);
  if(manual)data={...data,targets:(data.targets??[]).filter(id=>isFighter(byId(id)))};
  if(!item||item.type!=="ability"||(!override&&item.system.charge<1))throw Error("Skill has no Set dice");
  if(!override&&item.system.number<1)throw Error("Assign the Skill to a numbered slot first");
  if(!manual)validateSkillSlot(a,item,item.system.number);
  if(!manual&&(!s.active || !s.actors.includes(a.id)))throw Error("No active battle");
  const key=item.system.key||"custom", timing=item.system.timingKey;
  if(!override&&(s.freeEnemy?.actor===a.id && s.freeEnemy.item!==item.id))throw Error("Use the skill granted by the Stage");
  if(!override&&(a.system.hp.value===0&&!deathSkills.includes(key)))throw Error("Incapacitated characters cannot use skills");
  let check=null;
  if(manual){
    if(s.pending)check=pendingCheck().c;
    const reaction=beforeKeys.includes(key)||afterRollKeys.includes(key),noContext=reaction&&!check;
    const missingEvent=damageReactions.includes(key)&&!s.damage?.[(key==='unlimited-libra'?data.targets?.[0]:a.id)];
    const needsChoices=['amaranthus-room','draco-grace-command','whirlpool-of-thought','diaclock-the-purple','betrayal-s-amaranthus'].includes(key);
    const attackWaiting=s.pending&&!reaction&&(/Attack/i.test(item.system.effect)||item.system.attackDice>0);
    const missingDamageSource=['poisoned-flower-of-grief','black-avenger'].includes(key)&&!s.damage?.[a.id]?.source;
    const missingOmen=key==='spider-lilies-beneath-the-moonlight'&&!s.omen;
    if(!data.targets?.length||noContext||missingEvent||needsChoices||attackWaiting||missingDamageSource||missingOmen||(key==='dance-with-heat'&&!s.lastMove)){await item.update({'system.charge':Math.max(0,item.system.charge-1)});await chat(item.name,`<pre>${esc(item.system.effect)}</pre><p>Used on Foundry targets. Director applies effects requiring a check, movement or choices.</p>`,a);return;}
  }else{
  if(beforeKeys.includes(key)||afterRollKeys.includes(key)) {
    check=pendingCheck().c;
    if(!override&&(check.kind!=="attack"&&key!=="whirlpool-of-thought"))throw Error("This reaction requires an Attack check");
    if(!override&&(beforeKeys.includes(key)&&key!=="black-flowers-zenith"&&check.rolled))throw Error("Reaction must be used before rolling");
    if(!override&&(afterRollKeys.includes(key)&&!check.rolled))throw Error("Reaction must be used after rolling");
    if(!override&&(key==="black-flowers-zenith"&&!check.rolled))throw Error("Use just before damage, after rolling");
  } else if(damageReactions.includes(key)) {
    const recipient=key==="unlimited-libra"?target(data,a)[0]:a;
    const d=s.damage?.[recipient.id];if(!d||d.round!==s.round)throw Error("There is no damage event to react to");
    if(!override&&(deathSkills.includes(key)&&a.system.hp.value!==0))throw Error("Endurance must have just reached 0");
    if(!override&&(key==="aquilegia-the-remnant"&&(a.system.hp.value<1||a.system.hp.value>4)))throw Error("Endurance must be 1–4");
    if(["poisoned-flower-of-grief","black-avenger"].includes(key)&&(!d.source||!d.amount))throw Error("Cannot retaliate against the Stage or zero damage");
    if(key==="poisoned-flower-of-grief"&&!d.check)throw Error("Requires damage from an Attack check");
  } else if(key==="dance-with-heat") {
    if(!s.lastMove||s.lastMove.round!==s.round)throw Error("No movement to react to");
  } else if(key==="spider-lilies-beneath-the-moonlight") {
    if(!s.omen||s.omen.executed)throw Error("No pending Stage Action");
  } else {
    if(!override&&(!s.freeEnemy && (s.phase!=="actions"||s.actors[s.turn]!==a.id||a.system.done)))throw Error("This skill requires your turn");
    if(!override&&(s.freeEnemy && s.freeEnemy.actor!==a.id))throw Error("The Enemy must act first");
    if(s.pending)throw Error(t("Pending"));
    if(timing==="passive")throw Error("Passive skills do not consume Set dice");
  }
  }
  const recipients=target(data,a);
  const checkPath=(...args)=>manual?(Array.isArray(args[1])?args[1]:[]):validatePath(...args);
  const attackKeys=["knights-etiquette","pride-roses","aquilegia-the-fool","win-no-matter-what","cosmos-order","dance-in-the-calystegia","avandner","anemone-s-resolve","phantom-pain","betrayal-s-amaranthus","midnight-vamp","corrupt-touch","red-flowers-gloria","burn-with-fire","deep-blue-blade","anthem-of-eradication"];
  if(!manual&&(attackKeys.includes(key)&&recipients.length!==1))throw Error("Choose one Attack target");
  if(!manual&&(recipients.some(x=>!isFighter(x)||!s.actors.includes(x.id))))throw Error("Target is not a combatant");
  if(!manual&&(!override&&(deathSkills.includes(key)&&item.system.uses.battle)))throw Error("Only once per Stellar Battle");
  if(!manual&&(!override&&(roundLimited.includes(key)&&item.system.uses.round===s.round)))throw Error("Only once per round");
  if(!manual&&(!override&&(targetRoundLimited.includes(key)&&recipients.some(x=>item.system.uses[x.id]===s.round))))throw Error("Only once per target per round");
  const n=allDice.includes(key)?item.system.charge:1,r=s.round;
  const path=data.path??[],path2=data.path2??[],garden=Number(data.garden??a.system.garden);
  const atk=(dice,ts=recipients,extra={})=>step("attack",ts,dice,{...extra,ignoreRange:manual||(override&&!!data.ignoreRange)});
  const hp=(amount,ts=recipients,extra={})=>step(amount>=0?"heal":"damage",ts,Math.abs(amount),extra);
  const mv=(p=path,ts=[a])=>step("move",ts,0,{path:p});
  const here=currentActors().filter(x=>x.system.garden===a.system.garden);
  const near=currentActors().filter(x=>adjacent(x.system.garden,a.system.garden));
  let steps=[];
  switch(key) {
    case "knights-etiquette":checkPath(a.system.garden,path,0,1);steps=data.choice==="move-first"?[mv(),atk(2)]:[atk(2),mv()];break;
    case "pride-roses":steps=[atk(2),atk(2,data.secondary?[byId(data.secondary)]:recipients),hp(2,[a])];break;
    case "purifying-rose":if(!manual&&(recipients.some(x=>!here.includes(x))))throw Error("Targets must be in your Garden");steps=[step("heal-roll",recipients,1)];break;
    case "duel": {
      if(!manual&&(recipients.length!==1||isEnemy(recipients[0])===isEnemy(a)))throw Error("Choose one opponent");
      integer(garden,1,6);if(!manual&&(currentActors().some(x=>x!==a&&x!==recipients[0]&&x.system.garden===garden)))throw Error("Destination Garden must be empty");
      steps=[step("place",[a,...recipients],garden)];break;
    }
    case "royal-rose-dress":if(!manual&&(recipients.length!==1||recipients[0]===a))throw Error("Choose one other character");steps=[hp(2),step("charge",recipients,1)];break;
    case "aquilegia-the-fool":steps=[atk(3+r),hp(-r,[a])];break;
    case "aquilegia-the-remnant":steps=[hp(3+n,[a])];break;
    case "win-no-matter-what":checkPath(a.system.garden,path,1,2);steps=[mv(),atk(5+path.length),hp(-(2+path.length),[a])];break;
    case "system-aquilegia":steps=[hp(5,[a],{revive:true}),hp(-n)];break;
    case "fortress-cosmos":steps=[step("check-defense",recipients,r,{once:true})];break;
    case "cosmos-order":steps=[atk(3,recipients,{afterEffect:"remove-die"})];break;
    case "cosmos-over-the-pain":if(!manual&&(recipients.some(x=>x===a||!near.includes(x))))throw Error("Choose other targets in the same or adjacent Gardens");steps=[hp(-r,[a]),hp(3+r)];break;
    case "around-the-cosmos":steps=recipients.map(x=>step("move",[x],0,{path:data.paths?.[x.id]??checkPath(x.system.garden,path,0,1)}));break;
    case "calystegia-sphere":steps=[step("check-defense",near,r)];break;
    case "dance-in-the-calystegia":steps=[atk(2+r),hp(here.length,[a])];break;
    case "avandner":checkPath(a.system.garden,path,1,1);checkPath(path[0],path2,1,1);steps=[atk(1),mv(),atk(1,data.secondary?[byId(data.secondary)]:recipients),mv(path2)];break;
    case "system-calystegia":if(!manual&&(recipients.length!==1||recipients[0]===a))throw Error("Choose one other character");steps=[hp(5,[a],{revive:true}),hp(n)];break;
    case "anemone-s-resolve":steps=[atk(a.system.garden,recipients,{afterEffect:"anemone-recoil"})];break;
    case "wish-bringer":steps=[{op:"garden-defense"}];break;
    case "phantom-pain":checkPath(a.system.garden,path,1,1);steps=[mv(),{op:"phantom-attack",targets:recipients.map(x=>x.id)}];break;
    case "anemone-dress":steps=[step("check-defense",recipients,r,{nonstack:true})];break;
    case "the-shores-of-victory-defeat": {
      const parity=data.choice==="heal-even"?0:1;
      steps=currentActors().map(x=>hp(x.system.garden%2===parity?r:-r,[x]));break;
    }
    case "the-near-far-shores":steps=[hp(2+r,here),hp(-(2+r),currentActors().filter(x=>x.system.garden===opposite(a.system.garden)))];break;
    case "poisoned-flower-of-grief":case "black-avenger":steps=[hp(-s.damage[a.id].amount,[byId(s.damage[a.id].source)])];break;
    case "spider-lilies-beneath-the-moonlight":steps=[{op:"cancel-omen"},hp(-(5+r),[a])];break;
    case "amaranthus-room":steps=[{op:"map",from:integer(data.from,1,6),to:integer(data.to,1,6)}];break;
    case "betrayal-s-amaranthus": {
      const sacrifice=byId(data.sacrifice??a.id);
      if(!manual&&(!s.actors.includes(sacrifice.id)||!adjacent(a.system.garden,sacrifice.system.garden)))throw Error("First target must be in attack range");
      if(!manual&&(recipients.includes(sacrifice)))throw Error("Second attack must target another character");
      steps=[atk(2,[sacrifice]),atk(5)];break;
    }
    case "eternity-s-amaranthus":steps=[hp(5+n,[a],{revive:true})];break;
    case "unlimited-libra":if(!manual&&(recipients.length!==1||recipients[0]===a))throw Error("Choose another damaged character");steps=[step("charge",recipients,r)];break;
    case "night-runner": {
      checkPath(a.system.garden,path,0,1);if(!manual&&(recipients.length>1||recipients.some(x=>x.system.garden!==a.system.garden)))throw Error("Choose at most one willing target in your Garden");
      steps=[mv(path,[...new Set([a,...recipients])])];break;
    }
    case "midnight-vamp":steps=[hp(2,[a]),atk(3)];break;
    case "corrupt-touch":if(!manual&&(recipients.length!==1))throw Error("Choose one target");checkPath(recipients[0].system.garden,path,1,1);steps=[mv(path,recipients),atk(2,recipients,{afterEffect:"drain"})];break;
    case "black-flowers-zenith":if(!manual&&(recipients.length!==1||recipients[0]===a))throw Error("Choose another character");steps=[step("check-half",recipients,0)];break;
    case "floral-ring":steps=[{op:"flame"}];break;
    case "red-flowers-gloria":steps=[atk(3,recipients,{defense:Object.fromEntries(recipients.map(x=>[x.id,-1]))})];break;
    case "burn-with-fire":steps=[atk(4)];break;
    case "dance-with-heat":steps=[hp(-s.lastMove.count,[byId(s.lastMove.actor)])];break;
    case "rewrite-your-story":steps=[step("check-defense",recipients,-1)];break;
    case "mind-over-matter":if(!manual&&(recipients.length!==1))throw Error("Choose one target");steps=[hp(2),step("charge",recipients,2),hp(-2,[a])];break;
    case "yellow-queen": {
      if(!manual&&(recipients.some(x=>x===a||x.system.garden!==a.system.garden)))throw Error("Choose other willing targets in your Garden");
      if(!manual&&(recipients.some(x=>x.system.modifiers.filter(m=>m.kind==="queen").reduce((s,m)=>s+m.value,0)>=r)))throw Error("Yellow Queen stacks at most Round count times");
      steps=[step("modifier",recipients,1,{kind:"queen",duration:"round"})];break;
    }
    case "yes-my-lady":if(!manual&&(recipients.length!==1))throw Error("Choose one willing target");steps=[step("place",[a],recipients[0].system.garden),step("place",recipients,a.system.garden)];break;
    case "whirlpool-of-thought":steps=[{op:"check-reroll",indices:data.indices??[0]}];break;
    case "wind-signpost":if(!manual&&(recipients.length!==1))throw Error("Choose one willing target");steps=[step("place",recipients,a.system.garden)];break;
    case "deep-blue-blade":steps=[atk(2),...(a.system.garden===3?[atk(3)]:[])];break;
    case "deep-contemplation":steps=[...(a.system.garden===1?[hp(r)]:[]),step("charge",recipients,1)];break;
    case "white-shield":if(!manual&&(recipients.length!==1||!check.targets.includes(recipients[0].id)))throw Error("Choose one target of this Attack");steps=[hp(1),step("check-defense",recipients,1)];break;
    case "anthem-of-eradication":steps=[atk(3,recipients,{afterEffect:"anthem"})];break;
    case "lightning-intercept":if(!manual&&(!check.targets.includes(a.id)))throw Error("The Attack must target you");steps=[...(check.actor?[hp(-(1+r),[byId(check.actor)])]:[]),step("check-defense",[a],r)];break;
    case "flash-step":checkPath(a.system.garden,path,2,3);steps=[mv()];break;
    case "nine-liverary":steps=[step("charge",recipients,r),hp(-r)];break;
    case "diaclock-the-purple":steps=[step("remove-heal",recipients,0,{remove:data.remove??{}})];break;
    case "draco-grace-command":steps=[{op:"check-die",index:integer(data.index,0,check?.values?.length??0-1),value:integer(data.to,1,6)},hp(6-Number(data.to),[a])];break;
    case "purple-flower-dial":steps=recipients.flatMap(x=>[step("move",[x],0,{path:[clockwise(x.system.garden)]}),hp(r,[x])]);break;
    case "custom":if(item.system.move)checkPath(a.system.garden,path,0,item.system.move);steps=[...(item.system.move?[mv()]:[]),...(item.system.attackDice?[atk(item.system.attackDice)]:[])];break;
    default:throw Error("Unrecognized catalog skill");
  }
  // Validate reactions before spending a die; non-stacking skill instances refer to the check.
  if(check && ["fortress-cosmos","anemone-dress"].includes(key)) {
    const {c}=pendingCheck();
    if(!manual&&(!override&&(key==="fortress-cosmos"&&c.usedSkills?.includes(key))))throw Error("Fortress Cosmos only once per check");
    if(!manual&&(!override&&(key==="anemone-dress"&&recipients.some(x=>c.dressTargets?.includes(x.id)))))throw Error("Anemone Dress does not stack on the same target");
  }
  if(key==="whirlpool-of-thought") {
    const indices=[...new Set((data.indices??[0]).map(i=>integer(i,0,check?.values?.length??0-1)))];
    if(!manual&&(indices.length<1||indices.length>2))throw Error("Choose one or two dice");
  }
  if(key==="around-the-cosmos")for(const b of recipients)checkPath(b.system.garden,data.paths?.[b.id]??path,0,1);
  if(key==="diaclock-the-purple")for(const b of recipients)for(const [id,count] of Object.entries(data.remove?.[b.id]??{})){
    const item=b.items.get(id);if(!manual&&(!item))throw Error("Skill not found");integer(count,0,item.system.charge);
  }
  const uses={...item.system.uses};
  if(deathSkills.includes(key))uses.battle=true;
  if(roundLimited.includes(key))uses.round=s.round;
  if(targetRoundLimited.includes(key))for(const x of recipients)uses[x.id]=s.round;
  const boost=s.freeEnemy?.actor===a.id?s.freeEnemy.bonus:0;
  const finalContinuation=s.freeEnemy?.actor===a.id?s.freeEnemy.continuation:null;
  if(s.freeEnemy?.actor===a.id){const next=state();next.freeEnemy=null;await saveState(next);}
  await item.update({"system.charge":Math.max(0,item.system.charge-n),"system.uses":uses});
  await chat(item.name,`<pre>${esc(item.system.effect)}</pre>`,a);
  await runSteps({actor:a.id,key,steps:manual?steps.filter(x=>!["move","place","choose-move","sweep"].includes(x.op)):steps,params:data,boost,finalContinuation});
}
export async function runSteps(context) {
  const a=context.actor?byId(context.actor):null;
  const steps=[...context.steps];
  while(steps.length) {
    const x=steps.shift(), targets=(x.targets??[]).map(byId);
    const continuation={...context,steps};
    switch(x.op) {
      case "attack": {
        const after=x.afterEffect?{...context,steps:[{op:x.afterEffect,targets:x.targets}]}:null;
        await attack(a,x.value+(context.boost??0),x.targets,{defense:x.defense,after,continuation,ignoreRange:x.ignoreRange});return;
      }
      case "stage-attack":await attack(null,x.value,x.targets,{stage:true,title:x.title,continuation,
        after:x.sweep?{actor:null,key:"stage",steps:[{op:"sweep",targets:x.targets}]}:null});return;
      case "phantom-attack":await attack(a,1+currentActors().filter(y=>y.system.garden===a.system.garden).length,x.targets,{continuation,ignoreRange:!!context.params?.directUse});return;
      case "damage":for(const b of targets)await changeHP(b,-x.value,{source:a?.id??null});break;
      case "heal":for(const b of targets)await heal(b,x.value,x.revive);break;
      case "heal-roll": {const {values}=await rollDice(x.value);for(const b of targets)await heal(b,values.reduce((s,n)=>s+n,0));break;}
      case "move":for(const b of targets)await moveActor(b,x.path);break;
      case "place":for(const b of targets)await b.update({"system.garden":integer(x.value,1,6)});break;
      case "charge": {
        if(!targets.length)break;
        const first=targets.shift();
        await bonusCharge(first,x.value);
        // Store continuations on the bonus Charge so players can use Bouquet reactions.
        if(state().pending) {
          const {message,c}=pendingCheck();c.continuation={...context,steps:[...(targets.length?[{...x,targets:targets.map(b=>b.id)}]:[]),...steps]};
          await updateCheck(message,c);return;
        }
        break;
      }
      case "modifier":for(const b of targets)await modify(b,{kind:x.kind,value:x.value,duration:x.duration});break;
      case "check-defense": {
        const {message,c}=pendingCheck();c.defense??={};
        for(const b of targets)c.defense[b.id]=(c.defense[b.id]??0)+x.value;
        c.usedSkills??=[];c.usedSkills.push(context.key);
        if(context.key==="anemone-dress"){c.dressTargets??=[];c.dressTargets.push(...x.targets);}
        await updateCheck(message,c);break;
      }
      case "garden-defense":{const {message,c}=pendingCheck();c.gardenDefense=true;await updateCheck(message,c);break;}
      case "check-half":{const {message,c}=pendingCheck();c.half??=[];c.half.push(...x.targets);await updateCheck(message,c);break;}
      case "check-reroll": {
        const {message,c}=pendingCheck();const indices=[...new Set(x.indices.map(i=>integer(i,0,c.values.length-1)))];
        if(indices.length<1||indices.length>2)throw Error("Choose one or two dice");
        const {values,roll}=await rollDice(indices.length);indices.forEach((i,j)=>c.values[i]=values[j]);
        await updateCheck(message,c,roll);await rolledMarkers(c.actor?byId(c.actor):null,values);break;
      }
      case "check-die": {const {message,c}=pendingCheck();c.values[x.index]=x.value;await updateCheck(message,c);break;}
      case "cancel-omen":{const s=state();s.omen.executed=true;s.omen.cancelled=true;s.omenIndex++;await saveState(s);break;}
      case "map":{const s=state();s.maps.push({from:x.from,to:x.to});await saveState(s);break;}
      case "flame":await a.update({"system.flames":a.system.flames+1});break;
      case "grant": {
        const enemy=targets[0];
        if(state().nativeControls){const s=state();s.freeEnemy={actor:enemy.id,bonus:x.value};await saveState(s);await chat('Stage blessing',`${esc(enemy.name)}: Director chooses and clicks a Skill (+${x.value} Attack dice).`);break;}
        const selected=await pick("Stage blessing — choose Enemy skill",enemy.items.filter(i=>i.system.number>0).map(i=>({value:i.id,label:i.name})));
        if(!selected)throw Error("A Stage-granted skill must be selected");
        const item=enemy.items.get(selected);await item.update({"system.charge":item.system.charge+1});
        const s=state();s.freeEnemy={actor:enemy.id,item:item.id,bonus:x.value,continuation};await saveState(s);
        await chat("Stage blessing",`${esc(enemy.name)}: use ${esc(item.name)} now, with +${x.value} Attack dice.`);return;
      }
      case "choose-move": {
        if(state().nativeControls){await chat('Stage movement',targets.map(b=>esc(b.name)).join(', ')+': Director chooses movement on the scene.');break;}
        for(const b of targets){const g=await pick(`${b.name} — choose Garden (Director confirms player's choice)`,
          [clockwise(b.system.garden),(b.system.garden+4)%6+1].map(v=>({value:String(v),label:`Garden ${v}`})));
          if(g)await moveActor(b,[Number(g)],{forced:true});}break;
      }
      case "sweep":for(const b of targets)if(context.damage?.[b.id]>0)await moveActor(b,[clockwise(b.system.garden)],{forced:true});break;
      case "remove-die":
        for(const b of targets)if(context.damage?.[b.id]>0)await chat("Cosmos Order",`${esc(b.name)}: choose and remove one Set die using the skill − button.`,b);
        break;
      case "anemone-recoil":await changeHP(a,-Math.floor(Object.values(context.damage??{}).reduce((s,n)=>s+n,0)/2));break;
      case "drain":await heal(a,Object.values(context.damage??{}).reduce((s,n)=>s+n,0));break;
      case "anthem":for(const b of targets)if(context.damage?.[b.id]>0)await modify(b,{kind:"attack",value:-1,duration:"next-attack"});break;
      case "remove-heal": {
        for(const b of targets) {
          let removed=0;const updates=[];
          for(const [id,count] of Object.entries(x.remove[b.id]??{})) {
            const item=b.items.get(id);if(!item)throw Error("Skill not found");const n=integer(count,0,item.system.charge);
            removed+=n;updates.push({_id:id,"system.charge":Math.max(0,item.system.charge-n)});
          }
          await b.updateEmbeddedDocuments("Item",updates);if(removed)await heal(b,3+removed);
        }break;
      }
      default:throw Error(`Unknown effect ${x.op}`);
    }
    await victory();
    if(!state().active)return;
  }
  if(context.finalContinuation)await runSteps(context.finalContinuation);
}
