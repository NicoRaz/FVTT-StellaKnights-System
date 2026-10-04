// V14 adaptation of upstream StellaActorSheet; same fields and six-slot layout.
import {ID,COLORS,FLOWERS,isFighter,isEnemy,wishMedals,escapeHTML as esc} from "./rules.js";
import {t,formDialog,currentActors,notifyError,openSidebarTab,directorMode,directorOverride} from "./helpers.js";
import {request} from "./socket.js";
import {setupActor} from "./library.js";
import {effectiveDefense,effectiveCharge,effectiveAttackBonus} from "./engine.js";
import {slotUpdates,assertLoadoutEditable} from "./loadout.js";
import {crestItems,skillAllowed,validateSkillSlot,setCrestItem,syncCrest} from "./crest.js";
import {PreserveSheetScroll} from './sheet-scroll.js';
export class StellaActorSheet extends PreserveSheetScroll(foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2)) {
  static DEFAULT_OPTIONS={tag:"form",classes:["stella","stella-v14","sheet","actor"],position:{width:860,height:830},
    form:{submitOnChange:true,closeOnSubmit:false,handler:StellaActorSheet.submit},
    actions:{sheetTab:StellaActorSheet.switchTab,mode:StellaActorSheet.mode,portrait:StellaActorSheet.pickImage,token:StellaActorSheet.pickImage,tokenizer:StellaActorSheet.tokenizer,tokenConfig:StellaActorSheet.tokenConfig,library:StellaActorSheet.library,setup:StellaActorSheet.setup,use:StellaActorSheet.use,
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
      crest:crestItems(a),availableSkills:game.items.filter(i=>i.type==="ability"&&i.visible!==false&&(directorMode()||skillAllowed(a,i))),derivedDefense:isFighter(a)?effectiveDefense(a):0,currentCharge:isFighter(a)?effectiveCharge(a):0,attackBonus:isFighter(a)?effectiveAttackBonus(a):0,medalsRequired:wishMedals(a.system.details.wishTier)??t("Unknown"),
      partners:game.actors.filter(x=>x.id!==a.id&&(a.type==="bringer"?x.type==="sheath":a.type==="sheath"?x.type==="bringer":true)).map(x=>({id:x.id,name:x.name})),colors:Object.keys(COLORS),flowers:FLOWERS,karmaChoices:{hope:t("Hope"),despair:t("Despair")},
      slots:Array.from({length:6},(_,index)=>({number:index+1,item:skills.find(i=>i.system.number===index+1)})),items:skills};
  }
  _preSyncPartState(partId,newElement,priorElement,state) {
    super._preSyncPartState(partId,newElement,priorElement,state);
    if(partId==='main'&&newElement.dataset.activeTab!==priorElement.dataset.activeTab){
      this.tabScroll??={};this.tabScroll[priorElement.dataset.activeTab]=priorElement.scrollTop;
      state.scrollPositions=[['',this.tabScroll[newElement.dataset.activeTab]??0,0]];
    }
  }
  async _onRender(context,options) {
    await super._onRender(context,options);
    const root=this.element.querySelector(".stella-content");
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
    if(!item){const data=source.toObject();delete data._id;data.folder=null;data.system.key=source.system.key||source.id;data.system.number=0;data.system.charge=0;[item]=await this.actor.createEmbeddedDocuments("Item",[data]);}
    await this.actor.updateEmbeddedDocuments("Item",slotUpdates(this.actor.items,item,number));
    return item;
  }
  static async switchTab(_event,target) {
    const next=target.dataset.tab;if(!['details','battle'].includes(next)||next===(this.activeTab??'details'))return;
    this.tabScroll??={};this.tabScroll[this.activeTab??'details']=this.element.querySelector('.stella-content').scrollTop;
    this.activeTab=next;await this.render();
  }
  static async mode() {if(this.isEditable){this.editMode=!this.editMode;await this.render();}}
  static async library() {
    try {openSidebarTab("compendium");}catch(e){notifyError(e);}
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
    try {const targets=[...new Set([...game.user.targets].map(token=>token.actor?.id).filter(Boolean))];await request("use",{actor:this.actor.id,item:item.id,targets,directUse:true});}catch(e){notifyError(e);}
  }
}
