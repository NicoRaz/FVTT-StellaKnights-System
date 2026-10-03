import {ID,isFighter,isEnemy,escapeHTML as esc} from "./rules.js";
import {state,formDialog,pick,t,notifyError,currentActors,chat,rollDice} from "./helpers.js";
import {stages} from "./library.js";
import {request} from "./socket.js";
import {stellarCombat} from "./combat-state.js";
import {effectiveDefense,effectiveCharge} from "./engine.js";
import {session} from "./session.js";
export class BattlePanel extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS={id:"stella-battle",classes:["stella-v14"],window:{title:"Stellar Battle — Arena of Wishes"},position:{width:820,height:790},
    actions:{garden:BattlePanel.garden,start:BattlePanel.start,advance:BattlePanel.advance,open:BattlePanel.open,up:BattlePanel.order,down:BattlePanel.order,
      charge:BattlePanel.charge,award:BattlePanel.award,import:BattlePanel.import,prompt:BattlePanel.prompt,end:BattlePanel.end,
      sessionStart:BattlePanel.sessionStart,sessionNext:BattlePanel.sessionNext,reference:BattlePanel.reference}};
  static PARTS={main:{template:`systems/${ID}/templates/battle-panel.html`}};
  async _prepareContext() {
    const s=state(),actors=currentActors(),active=actors[s.turn];
    const gardens=[6,1,2,5,0,3,-1,4,-1].map(g=>({number:g,blank:g===-1,center:g===0,active:active?.system.garden===g,
      actors:actors.filter(a=>a.system.garden===g).map(a=>({id:a.id,name:a.name,hp:a.system.hp.value,enemy:isEnemy(a)})),
      markers:(s.markers??[]).filter(m=>m.garden===g).map(m=>m.kind).join(", ")}));
    // Hexagonal ring in a 3x3 visual; blank corner cells added by the template.
    const narrative=session(),pair=game.actors.get(narrative.pairs[narrative.cursor]);
    return {s,session:narrative,pair:pair?.name,gm:game.user.isGM,stage:stages.find(x=>x.id===s.stage),active:active?.name,gardens,
      actors:actors.map(a=>({id:a.id,name:a.name,garden:a.system.garden,hp:a.system.hp.value,defense:effectiveDefense(a),charge:effectiveCharge(a),
        done:a.system.done,charged:s.charged?.includes(a.id),owner:a.isOwner,enemy:isEnemy(a)})),
      pending:s.pending,omen:s.omen?stages.find(x=>x.id===s.stage)?.actions[s.omen.index]:null};
  }
  static async start() {
    try {
      const fighters=game.actors.filter(isFighter);
      const data=await formDialog(t("Start"),`<label>${t("Stage")}<select name="stage">${stages.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select></label>
        <p>Select one Enemy and all Bringers. Order can be changed in Set phase.</p>${fighters.map(a=>`<label class="stella-inline"><input type="checkbox" name="actor" value="${a.id}" checked>${esc(a.name)} (${a.type})</label>`).join("")}`,
        f=>({stage:f.elements.stage.value,actors:[...f.querySelectorAll('input[name="actor"]:checked')].map(x=>x.value)}));
      if(data)await request("start",data);
    }catch(e){notifyError(e);}
  }
  static async advance() {try{await stellarCombat()?.nextTurn();}catch(e){notifyError(e);}}
  static async garden(_event,target) {
    try {const a=game.actors.get(target.dataset.actor);const data=await formDialog('Garden',`<label>${esc(a.name)}<input type="number" name="garden" min="1" max="6" value="${a.system.garden}"></label>`,form=>({actor:a.id,field:'garden',value:Number(form.elements.garden.value)}));if(data)await request('adjust',data);}catch(e){notifyError(e);}
  }
  static async open(_event,target) {game.actors.get(target.dataset.actor)?.sheet.render(true);}
  static async order(_event,target) {try{await request("reorder",{actor:target.dataset.actor,delta:target.dataset.action==="up"?-1:1});}catch(e){notifyError(e);}}
  static async charge(_event,target) {try{await request("charge",{actor:target.dataset.actor});}catch(e){notifyError(e);}}
  static async import() {try{await request("import");}catch(e){notifyError(e);}}
  static async sessionStart() {
    try{const actors=await pick("Start Session",game.actors.filter(a=>isFighter(a)&&a.type!=="embraced").map(a=>({value:a.id,label:a.name})),{multiple:true,label:"Pairs taking part (select Bringers / Eclipsed)"});
      if(actors?.length)await request("session-start",{actors});}catch(e){notifyError(e);}
  }
  static async sessionNext() {try{await request("session-next");}catch(e){notifyError(e);}}
  static async reference() {
    try {
      const response=await fetch(`systems/${ID}/data/references.json`);if(!response.ok)throw Error("Reference tables unavailable");
      const refs=await response.json(),index=await pick("Reference Tables",refs.map((r,i)=>({value:String(i),label:r.name})));
      if(index===null)return;
      const ref=refs[Number(index)],{values}=await rollDice(2,{transform:false});
      await chat(ref.name,`<p>Dice: ${values.join(", ")} · printed pp.${ref.pages.join(", ")}. Use the row/column or grouped ranges shown in the table.</p><pre>${esc(ref.text)}</pre>`);
    }catch(e){notifyError(e);}
  }
  static async end() {try{await stellarCombat()?.endCombat();}catch(e){notifyError(e);}}
  static async award() {
    try {
      const choices=currentActors().filter(a=>!isEnemy(a));
      const conversed=await pick(t("Award"),choices.map(a=>({value:a.id,label:a.name})),{multiple:true,label:"Characters who conversed with another Knight in battle"});
      if(conversed)await request("award",{conversed});
    }catch(e){notifyError(e);}
  }
  static async prompt() {
    const times=["Morning, when no one is around","Noisy midday","Lonely evening","Under the stars","Stillness of late night","Just before dawn"];
    const places=["Classroom","Café terrace","School courtyard","Music room","Library","Covered walkway","Greenhouse","Antique shop","Shopping mall","Monorail","Promenade","Stylish restaurant","Indistinct darkness","Run-down café","Tea party under the stairs","Dormitory hallway","Room for two","Arena of Wishes"];
    const {values}=await rollDice(3,{transform:false});
    const place=Math.floor((values[1]-1)/2)*6+values[2]-1;
    await chat(t("ScenePrompt"),`${esc(times[values[0]-1])} · ${esc(places[place])}`);
  }
}
export async function supportDialog(effect) {
  const check=state().pending;
  const payers=game.actors.filter(a=>a.isOwner&&isFighter(a));
  const payer=await pick(t("Support"),payers.map(a=>({value:a.id,label:`${a.name} (${a.system.bouquet} Bouquet)`})));
  if(!payer)return;
  const data={payer,effect,check};
  if(effect==="petite") {
    const info=await formDialog(t("Petite"),'<label>Die position (starts at 1)<input type="number" name="index" min="1" value="1"></label><label>Shift<select name="delta"><option value="1">+1</option><option value="-1">−1</option></select></label>',
      f=>({index:Number(f.elements.index.value)-1,delta:Number(f.elements.delta.value)}));
    if(!info)return;Object.assign(data,info);
  }
  await request("offer",data);
}
