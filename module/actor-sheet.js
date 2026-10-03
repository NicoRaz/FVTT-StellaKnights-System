// V14 adaptation of upstream StellaActorSheet; same fields and six-slot layout.
import {ID,COLORS,FLOWERS,isFighter,isEnemy,wishMedals,escapeHTML as esc} from "./rules.js";
import {t,formDialog,currentActors,notifyError,openSidebarTab} from "./helpers.js";
import {request} from "./socket.js";
import {setupActor,importLibrary} from "./library.js";
import {effectiveDefense,effectiveCharge,effectiveAttackBonus} from "./engine.js";
import {slotUpdates,assertLoadoutEditable} from "./loadout.js";
import {crestItems,skillAllowed,validateSkillSlot,setCrestItem,syncCrest} from "./crest.js";
export class StellaActorSheet extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2) {
  static DEFAULT_OPTIONS={tag:"form",classes:["stella","stella-v14","sheet","actor"],position:{width:860,height:830},
    form:{submitOnChange:true,closeOnSubmit:false,handler:StellaActorSheet.submit},
    actions:{sheetTab:StellaActorSheet.switchTab,arena:()=>game.stellaknights.openBattle(),mode:StellaActorSheet.mode,portrait:StellaActorSheet.pickImage,token:StellaActorSheet.pickImage,tokenizer:StellaActorSheet.tokenizer,tokenConfig:StellaActorSheet.tokenConfig,library:StellaActorSheet.library,setup:StellaActorSheet.setup,charge:StellaActorSheet.charge,use:StellaActorSheet.use,
      edit:StellaActorSheet.edit,delete:StellaActorSheet.remove,new:StellaActorSheet.create,
      plus:StellaActorSheet.adjust,minus:StellaActorSheet.adjust,echo:StellaActorSheet.echo,
      life:StellaActorSheet.distortion,atypia:StellaActorSheet.distortion,flame:StellaActorSheet.flame,
      pair:StellaActorSheet.pair,battle:()=>game.stellaknights.openCombat(),bouquet:()=>game.stellaknights.distributeBouquet()}};
  static PARTS={main:{scrollable:[""],template:`systems/${ID}/templates/bringer-sheet.html`}};
  async _prepareContext(options) {
    const context=await super._prepareContext(options),a=this.actor;
    const skills=a.items.filter(i=>i.type==="ability").sort((a,b)=>a.system.number-b.system.number||a.sort-b.sort);
    return {...context,activeTab:this.activeTab??"details",detailsTab:this.activeTab!=="battle",battleTab:this.activeTab==="battle",editing:!!this.editMode,sections:this.sections??{basic:true,loadout:true,reserve:false},typeLabel:a.type.charAt(0).toUpperCase()+a.type.slice(1),tokenImage:a.prototypeToken.texture.src,hasTokenizer:!!game.modules.get("vtta-tokenizer")?.active,canImport:game.user.isGM,actor:a,system:a.system,editable:this.isEditable,fighter:isFighter(a),enemy:isEnemy(a),
      status:!isFighter(a)?"Sheath":a.system.hp.value===0?t("Incapacitated"):a.system.done?t("Done"):t("Standby"),
      crest:crestItems(a),availableSkills:game.items.filter(i=>i.type==="ability"&&i.visible!==false&&skillAllowed(a,i)),derivedDefense:isFighter(a)?effectiveDefense(a):0,currentCharge:isFighter(a)?effectiveCharge(a):0,attackBonus:isFighter(a)?effectiveAttackBonus(a):0,medalsRequired:wishMedals(a.system.details.wishTier)??t("Unknown"),
      partners:game.actors.filter(x=>x.id!==a.id&&(a.type==="bringer"?x.type==="sheath":a.type==="sheath"?x.type==="bringer":true)).map(x=>({id:x.id,name:x.name})),colors:Object.keys(COLORS),flowers:FLOWERS,karmaChoices:{hope:t("Hope"),despair:t("Despair")},
      slots:Array.from({length:6},(_,index)=>({number:index+1,item:skills.find(i=>i.system.number===index+1)})),items:skills};
  }
  async _renderHTML(context,options) {
    const root=this.element?.querySelector(".stella-content");
    if(!root?.dataset?.activeTab||root.dataset.activeTab===(this.activeTab??'details'))this.scrollPosition=root?.scrollTop??this.scrollPosition??0;
    return super._renderHTML(context,options);
  }
  _onRender(context,options) {
    super._onRender(context,options);
    const root=this.element.querySelector(".stella-content");
    root.scrollTop=this.scrollPosition??0;
    this.sections??={basic:true,loadout:true,reserve:false};
    root.querySelectorAll("details[data-section]").forEach(d=>d.addEventListener("toggle",()=>{this.sections[d.dataset.section]=d.open;}));
    root.querySelectorAll("[name]").forEach(input=>{
      const live=["system.hp.value","system.bouquet","system.reportReroll"].includes(input.name);
      input.disabled=!this.isEditable||(!this.editMode&&!live);
    });
    // Capture prevents the base sheet from handling the same Item a second time.
    root.addEventListener("dragstart",event=>{
      const row=event.target.closest("[data-item-id], [data-world-item-id]");
      if(!row)return;
      event.stopImmediatePropagation();
      const item=row.dataset.worldItemId?game.items.get(row.dataset.worldItemId):this.actor.items.get(row.dataset.itemId);
      if(item)event.dataTransfer.setData("text/plain",JSON.stringify(item.toDragData()));
    },true);
    root.addEventListener("dragover",event=>{if(this.isEditable&&this.editMode){event.preventDefault();event.stopImmediatePropagation();}},true);
    root.addEventListener("drop",async event=>{
      event.preventDefault();event.stopImmediatePropagation();
      try {
        if(!this.isEditable||!this.editMode)throw Error("Switch to Edit mode to change skills");
        const data=foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
        if(data.type!=="Item")return;
        const item=await Item.implementation.fromDropData(data);
        await this.dropSkill(item,Number(event.target.closest("[data-slot]")?.dataset.slot??0));
      }catch(e){notifyError(e);}
    },true);
  }
  async dropSkill(source,number) {
    if(!this.isEditable||!this.editMode)throw Error("Switch to Edit mode to change skills");
    assertLoadoutEditable();
    if(["flower","color"].includes(source.type)){
      if(!source.isOwner&&!source.testUserPermission(game.user,"OBSERVER"))throw Error("You cannot read this Item");
      return setCrestItem(this.actor,source);
    }
    if(source.type!=="ability")throw Error("Drop a Skill, Flower or Color Item");
    if(!source.isOwner&&!source.testUserPermission(game.user,"OBSERVER"))throw Error("You cannot read this Item");
    let item=this.actor.items.get(source.id);
    if(source.parent!==this.actor)item=this.actor.items.find(i=>source.system.key&&i.system.key===source.system.key);
    // Validate before creating a copy so an invalid drop leaves the actor untouched.
    const candidate=item??{id:source.id,type:source.type,system:{...source.system,number:0}};
    validateSkillSlot(this.actor,candidate,number);
    slotUpdates(this.actor.items,candidate,number);
    if(!item){const data=source.toObject();delete data._id;data.system.key=source.system.key||source.id;data.system.number=0;data.system.charge=0;[item]=await this.actor.createEmbeddedDocuments("Item",[data]);}
    await this.actor.updateEmbeddedDocuments("Item",slotUpdates(this.actor.items,item,number));
    return item;
  }
  static async switchTab(_event,target) {
    const next=target.dataset.tab;if(!['details','battle'].includes(next)||next===(this.activeTab??'details'))return;
    this.tabScroll??={};this.tabScroll[this.activeTab??'details']=this.element.querySelector('.stella-content').scrollTop;
    this.activeTab=next;this.scrollPosition=this.tabScroll[next]??0;await this.render();
  }
  static async mode() {if(this.isEditable){this.editMode=!this.editMode;await this.render();}}
  static async library() {
    try {if(game.user.isGM)await importLibrary(game.user);openSidebarTab("items");}catch(e){notifyError(e);}
  }
  static async pickImage(_event,target) {
    if(!this.isEditable||!this.editMode)return;
    const token=target.dataset.action==="token",field=token?"prototypeToken.texture.src":"img";
    new foundry.applications.apps.FilePicker.implementation({type:"image",current:token?this.actor.prototypeToken.texture.src:this.actor.img,
      callback:async path=>{await this.actor.update({[field]:path});}}).browse();
  }
  static async tokenConfig() {if(this.isEditable&&this.editMode)this.actor.prototypeToken.sheet.render(true);}
  static async tokenizer() {
    try {if(!this.isEditable||!this.editMode)return;
      const api=game.modules.get("vtta-tokenizer")?.api;
      if(!api?.tokenizeActor)throw Error("Enable a compatible Tokenizer module first");
      await api.tokenizeActor(this.actor);
    }catch(e){notifyError(e);}
  }
  static async submit(_event,_form,formData) {if(this.isEditable)await this.actor.update(formData.object);}
  static async setup() {if(!this.isEditable||!this.editMode)return;try{await setupActor(this.actor);}catch(e){notifyError(e);}}
  static async pair() {try{await request("sync-pair",{actor:this.actor.id});}catch(e){notifyError(e);}}
  static async charge() {try{await request("charge",{actor:this.actor.id});}catch(e){notifyError(e);}}
  static async edit(_event,target) {this.actor.items.get(target.dataset.item)?.sheet.render(true);}
  static async remove(_event,target) {
    if(!this.isEditable||!this.editMode)return;
    try{assertLoadoutEditable();}catch(e){notifyError(e);return;}
    const item=this.actor.items.get(target.dataset.item);if(!item)return;
    if(await foundry.applications.api.DialogV2.confirm({window:{title:t("Delete")},content:`<p>${esc(item.name)}?</p>`})){await item.delete({stellaCrestChange:true});if(["flower","color"].includes(item.type))await syncCrest(this.actor,{adjustHP:true});}
  }
  static async create() {if(!this.isEditable||!this.editMode)return;const [i]=await this.actor.createEmbeddedDocuments("Item",[{name:t("NewAbility"),type:"ability"}]);i.sheet.render(true);}
  static async adjust(_event,target) {try{await request("set-die",{actor:this.actor.id,item:target.dataset.item,delta:target.dataset.action==="plus"?1:-1});}catch(e){notifyError(e);}}
  static async echo(_event,target) {
    const item=this.actor.items.get(target.dataset.item);if(item)await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:this.actor}),content:`<h3>${esc(item.name)}</h3><pre>${esc(item.system.effect)}</pre>`});
  }
  static async distortion(_event,target) {
    try {if(await foundry.applications.api.DialogV2.confirm({window:{title:t("Distortion")},content:`<p>+1 Distortion (${this.actor.system.distortion} → ${this.actor.system.distortion+1}). At 3, this character is Eclipsed next session.</p>`}))
      await request("distortion",{actor:this.actor.id,effect:target.dataset.action});}catch(e){notifyError(e);}
  }
  static async flame() {try{await request("flame-retaliate",{actor:this.actor.id});}catch(e){notifyError(e);}}
  static async use(_event,target) {
    const item=this.actor.items.get(target.dataset.item);if(!item)return;
    try {const data=await skillOptions(this.actor,item);if(data)await request("use",{actor:this.actor.id,item:item.id,...data});}catch(e){notifyError(e);}
  }
}
export async function skillOptions(a,item) {
  const key=item.system.key,combatants=currentActors();
  const offensive=/Attack/i.test(item.system.effect)||item.system.attackDice>0;
  const selected=[...game.user.targets].map(token=>token.actor?.id),defaultTarget=combatants.find(b=>isEnemy(b)!==isEnemy(a));
  const actorOptions=combatants.map(b=>`<option value="${b.id}">${esc(b.name)} · Garden ${b.system.garden}</option>`).join("");
  let content=`<pre class="stella-rule">${esc(item.system.effect)}</pre><p>Choose willing recipients after they agree. The Director confirms choices for other characters.</p>
    <fieldset><legend>Target / recipients</legend>${combatants.map(b=>`<label class="stella-inline"><input type="checkbox" name="target" value="${b.id}" ${selected.includes(b.id)||(!selected.length&&(offensive?b===defaultTarget:b===a))?'checked':''}>${esc(b.name)} (Garden ${b.system.garden})</label>`).join("")}</fieldset>`;
  const movement=["knights-etiquette","win-no-matter-what","around-the-cosmos","avandner","phantom-pain","night-runner","corrupt-touch","flash-step"];
  if(movement.includes(key)||(!key&&item.system.move))content+='<label>Movement path: each Garden in order (e.g. 2,3); empty means stay where allowed.<input name="path"></label>';
  if(key==="avandner")content+='<label>Second movement path<input name="path2"></label>';
  if(key==="around-the-cosmos")content+=combatants.map(b=>`<label>${esc(b.name)}: individual movement path (optional; otherwise use shared path)<input name="path-${b.id}"></label>`).join("");
  if(["pride-roses","avandner"].includes(key))content+=`<label>Second Attack target<select name="secondary">${actorOptions}</select></label>`;
  if(key==="duel")content+='<label>Empty destination Garden<input name="garden" type="number" min="1" max="6" value="1"></label>';
  if(key==="knights-etiquette")content+='<label>Order<select name="choice"><option value="attack-first">Attack, then move</option><option value="move-first">Move, then attack</option></select></label>';
  if(key==="the-shores-of-victory-defeat")content+='<select name="choice"><option value="heal-odd">Heal odd, damage even Gardens</option><option value="heal-even">Heal even, damage odd Gardens</option></select>';
  if(key==="amaranthus-room")content+='<label>Change all results from<input name="from" type="number" min="1" max="6" value="1"></label><label>to<input name="to" type="number" min="1" max="6" value="6"></label>';
  if(key==="whirlpool-of-thought")content+='<label>Dice to re-roll (positions starting at 1; e.g. 1,3)<input name="indices" value="1"></label>';
  if(key==="draco-grace-command")content+='<label>Die position (starts at 1)<input type="number" name="index" min="1" value="1"></label><label>New result<input type="number" name="to" min="1" max="6" value="6"></label>';
  if(key==="betrayal-s-amaranthus")content+=`<label>First Attack: self or willing target<select name="sacrifice">${actorOptions}</select></label>`;
  if(key==="diaclock-the-purple")content+=combatants.map(b=>`<details><summary>${esc(b.name)}: Set dice to remove</summary>${b.items.filter(i=>i.system.charge>0).map(i=>`<label>${esc(i.name)}<input type="number" name="remove-${b.id}-${i.id}" min="0" max="${i.system.charge}" value="0"></label>`).join("")}</details>`).join("");
  return formDialog(item.name,content,form=>{
    const d={targets:[...form.querySelectorAll('input[name="target"]:checked')].map(x=>x.value)},read=name=>form.elements[name]?.value;
    for(const k of ["choice","secondary","sacrifice"])if(read(k))d[k]=read(k);
    for(const k of ["garden","from","to"])if(read(k))d[k]=Number(read(k));
    if(read("index"))d.index=Number(read("index"))-1;
    for(const k of ["path","path2"])d[k]=(read(k)??"").split(",").map(x=>x.trim()).filter(Boolean).map(Number);
    if(read("indices"))d.indices=read("indices").split(",").map(x=>Number(x.trim())-1);
    if(key==="around-the-cosmos"){
      d.paths={};for(const b of combatants)if(read(`path-${b.id}`)?.trim())d.paths[b.id]=read(`path-${b.id}`).split(",").map(Number);
    }
    if(key==="diaclock-the-purple"){
      d.remove={};for(const b of combatants){d.remove[b.id]={};for(const i of b.items)if(form.elements[`remove-${b.id}-${i.id}`])d.remove[b.id][i.id]=Number(read(`remove-${b.id}-${i.id}`));}
    }
    return d;
  });
}
