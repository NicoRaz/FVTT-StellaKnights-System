import {runBlockSkill} from './skill-blocks.js';
import {stageRecord} from './stage-data.js';
import {clockwise,opposite,toward,gardenDistance,isEnemy,escapeHTML as esc} from "./rules.js";
import {state,saveState,currentActors,chat,rollDice,t} from "./helpers.js";
import {heal,changeHP,attack,bonusCharge} from "./engine.js";
import {runSteps,moveActor} from "./skills-engine.js";
import {stages} from "./library.js";
const roster=()=>({enemy:currentActors().find(isEnemy),knights:currentActors().filter(a=>!isEnemy(a)&&a.system.hp.value>0)});
const atk=(n,list,title)=>({op:"stage-attack",value:n,targets:list.map(a=>a.id),title});
const hp=(n,list)=>({op:n>=0?"heal":"damage",value:Math.abs(n),targets:list.map(a=>a.id)});
const free=(enemy,bonus=0)=>({op:"grant",targets:[enemy.id],value:bonus});
async function marker(kind,gardens) {
  const s=state();for(const garden of gardens)if(!s.markers.some(m=>m.kind===kind&&m.garden===garden))s.markers.push({kind,garden});await saveState(s);
}
async function attackBonus(enemy,value,duration="battle") {
  await enemy.update({"system.modifiers":[...enemy.system.modifiers,{kind:"attack",value,duration}]});
}
export async function setRoutine() {
  const s=state(),stage=stageRecord()??stages.find(x=>x.id===s.stage),{enemy,knights}=roster();
  if(!stage)return;
  const scripted=stage.actor?.items.find(i=>i.system.key===`stage:${s.stage}:set`&&i.system.scriptEnabled);
  if(scripted){await runBlockSkill({actor:stage.actor.id,item:scripted.id,targets:[...(game.user.targets??[])].map(t=>t.actor?.id).filter(Boolean)},game.user);return;}
  if(!enemy)return;
  await chat(`${t("Set")} · Round ${s.round}`,`<pre>${esc(stage.setText)}</pre>`);
  switch(s.stage) {
    case "ragnarok":if(s.round===1)await marker("war",[1,4]);else {const {values}=await rollDice(1);await heal(enemy,values[0]);}break;
    case "blade-dance":break; // Cut routine fires at the start of every Cut phase.
    case "deep-sea":
      if(s.round===1)await marker("shark",[1]);else for(const a of knights){const g=toward(a.system.garden);if(g!==a.system.garden)await moveActor(a,[g],{forced:true});}break;
    case "plushie":
      if(s.round===1)await enemy.update({"system.modifiers":[...enemy.system.modifiers,{kind:"defense",value:1,duration:"round"}]});
      else for(const a of knights)await changeHP(a,-a.system.garden);break;
    case "robot":
      if(s.round===1)await attackBonus(enemy,1);else {const {values}=await rollDice(1);await heal(enemy,values[0]);await bonusCharge(enemy,1);}break;
    case "midnight-ball":break;
    case "dragon":
      if(s.round===1)for(const a of knights){const {values}=await rollDice(1);if(values[0]<=4){const g=toward(a.system.garden);if(g!==a.system.garden)await moveActor(a,[g],{forced:true});await changeHP(a,-values[0]);}}
      else if(s.round===2)await attackBonus(enemy,1);break;
  }
}
export async function readOmen({allTurns=false}={}) {
  const s=state();if(!allTurns&&(s.phase!=="actions"||!s.actors[s.turn]))return;
  const a=game.actors.get(s.actors[s.turn]);if(!allTurns&&isEnemy(a))return;
  const stage=stageRecord()??stages.find(x=>x.id===s.stage);if(!stage||!stage.actions?.length)return;
  const index=s.omenIndex%stage.actions.length;
  s.omen={index,executed:false};
  if(s.stage==="plushie"&&index>=2){const {values}=await rollDice(1);s.omen.garden=values[0];}
  await saveState(s);
  const routine=stage.actions[index];
  await chat(`Omen · ${routine.name}`,`<pre>${esc(routine.text)}</pre>${s.omen.garden?`<p>Garden ${s.omen.garden}</p>`:""}`);
}
export async function executeOmen() {
  let s=state();if(!s.omen||s.omen.executed)return;
  const stage=stageRecord()??stages.find(x=>x.id===s.stage),routine=stage.actions[s.omen.index],n=s.omen.index+1,selectedGarden=s.omen.garden;
  s.omen.executed=true;s.omenIndex++;await saveState(s);
  if(stage.actor)await stage.actor.update({"system.omen":s.omenIndex%stage.actions.length});
  const scripted=stage.actor?.items.find(i=>i.system.key===`stage:${s.stage}:omen:${s.omen.index}`&&i.system.scriptEnabled);
  if(scripted){await runBlockSkill({actor:stage.actor.id,item:scripted.id,targets:[...(game.user.targets??[])].map(t=>t.actor?.id).filter(Boolean)},game.user);return;}
  const {enemy,knights}=roster(),r=s.round;
  if(!enemy){await chat(routine.name,`<pre>${esc(routine.text)}</pre>`);return;}
  const inGardens=g=>knights.filter(a=>g.includes(a.system.garden));
  const highest=[...knights].sort((a,b)=>b.system.hp.value-a.system.hp.value)[0];
  const highestTargets=highest?[highest]:[];
  let steps=[];
  switch(s.stage) {
    case "ragnarok":
      if(n===1)steps=[atk(5,inGardens([enemy.system.garden]),routine.name),atk(5,inGardens([opposite(enemy.system.garden)]),routine.name)];
      if(n===2)steps=[atk(5,knights.filter(a=>gardenDistance(a.system.garden,enemy.system.garden)<=1),routine.name)];
      if(n===3)steps=[atk(5,inGardens([1,3,5]),routine.name)];
      if(n===4)steps=[hp(3,[enemy]),free(enemy)];
      if(n===5)steps=[atk(5,inGardens([2,3,6]),routine.name)];break;
    case "blade-dance":
      if(n===1)steps=[free(enemy,2)];
      if(n===2)await marker("ghost",[1,2,3,4,5,6]);
      if(n===3)steps=[atk(4,inGardens([1,3,5]),routine.name)];
      if(n===4&&knights.length) {
        const closest=[...knights].sort((a,b)=>gardenDistance(a.system.garden,enemy.system.garden)-gardenDistance(b.system.garden,enemy.system.garden)||b.system.hp.value-a.system.hp.value)[0];
        const e=await rollDice(5),k=await rollDice(5),es=e.values.reduce((s,n)=>s+n,0),ks=k.values.reduce((s,n)=>s+n,0);
        await chat(routine.name,`${esc(enemy.name)}: ${es} · ${esc(closest.name)}: ${ks}`);
        if(es!==ks)steps=[hp(-5,[es<ks?enemy:closest])];
      }
      if(n===5)steps=[free(enemy),{op:"heal-roll",targets:[enemy.id],value:1}];break;
    case "deep-sea":
      if(n===1)steps=[atk(5,inGardens([2,4,6]),routine.name)];
      if(n===2)steps=[atk(5,inGardens([3,4,5]),routine.name)];
      if(n===3)for(const a of knights){const {values}=await rollDice(1);if(values[0]<=3&&a.system.garden!==1){await a.update({"system.garden":1});await changeHP(a,-(1+r));}}
      if(n===4&&highest)steps=[atk(8,[highest],routine.name),hp(-(1+r),knights.filter(a=>a!==highest&&a.system.garden===highest.system.garden)),
        ...knights.filter(a=>a!==highest&&a.system.garden===highest.system.garden).map(a=>({op:"choose-move",targets:[a.id],value:1}))];
      if(n===5)steps=knights.map(a=>({...atk(2,[a],routine.name),sweep:true}));break;
    case "plushie":
      if(n<=2&&knights.length) {
        const ordered=[...knights].sort((a,b)=>(n===1?a.system.garden-b.system.garden:b.system.garden-a.system.garden)||b.system.hp.value-a.system.hp.value);
        steps=[atk(7,[ordered[0]],routine.name)];
      }else if(n>=3){const found=inGardens([selectedGarden]);steps=[atk(found.length?n+2:4,found.length?found:knights,routine.name)];}break;
    case "robot":
      if(n===1)steps=[atk(7,inGardens([enemy.system.garden,opposite(enemy.system.garden)]),routine.name)];
      if(n===2)steps=[atk(5,knights.filter(a=>gardenDistance(a.system.garden,enemy.system.garden)<=1),routine.name)];
      if(n===3)steps=knights.map(a=>hp(-a.system.garden,[a]));
      if(n===4&&highest)steps=[atk(8,highestTargets,routine.name),{op:"choose-move",targets:highestTargets.map(a=>a.id),value:1}];
      if(n===5)steps=[free(enemy,1)];break;
    case "midnight-ball":
      if(r%2===1) {
        if(n===1)steps=[hp(1,inGardens([2,4,6])),hp(4,[enemy])];
        if(n===2)steps=[hp(1,[enemy]),free(enemy)];
        if(n===3&&knights.length) {const low=[...knights].sort((a,b)=>a.system.hp.value-b.system.hp.value)[0];steps=[hp(1,[low]),{op:"place",targets:[low.id],value:enemy.system.garden}];}
      }else {
        if(n===1)steps=[atk(6,inGardens([2,4,6]),routine.name)];
        if(n===2)steps=[atk(5,inGardens([1,3,5]),routine.name)];
        if(n===3&&highest)steps=[atk(9,highestTargets,routine.name),{op:"place",targets:[highest.id],value:enemy.system.garden}];
      }break;
    case "dragon":
      if(n===1)steps=[atk(7,inGardens([1,4]),routine.name)];
      if(n===2)steps=[atk(6,inGardens([2,4,6]),routine.name)];
      if(n===3)steps=[atk(7,inGardens([3,6]),routine.name)];
      if(n===4)steps=[hp(4,[enemy]),free(enemy)];
      if(n===5)for(const a of knights){const {values}=await rollDice(1);if(values[0]>=4)steps.push(hp(-(values[0]+2),[a]));}break;
  }
  await chat(routine.name,`<pre>${esc(routine.text)}</pre>`);
  await runSteps({actor:null,key:"stage",steps});
}
export async function cutRoutine() {
  if(!roster().enemy)return;
  const s=state(),{enemy,knights}=roster();
  if(s.stage==="blade-dance"&&knights.length) {
    const target=[...knights].sort((a,b)=>gardenDistance(b.system.garden,enemy.system.garden)-gardenDistance(a.system.garden,enemy.system.garden)||b.system.hp.value-a.system.hp.value)[0];
    await attack(null,3+s.round,[target.id],{stage:true,title:"Starving Wolf"});
  }
  if(s.stage==="deep-sea")for(const a of knights)if(a.system.garden===1)await changeHP(a,-(1+s.round));
}

export async function turnOmen() {
  const s=state();if(!s.nativeControls||!s.active||s.pending)return;
  const stage=stageRecord();if(!stage?.actions.length)return;
  const combat=game.combat,key=`${combat.round}:${combat.turns[combat.turn]?.id}`;
  if(s.omenTurns?.includes(key))return;
  s.omenTurns??=[];s.omenTurns.push(key);await saveState(s);
  await readOmen({allTurns:true});await executeOmen();
}
