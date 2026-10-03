// Preserve upstream ability fields while replacing the legacy ItemSheet API.
import {ID} from "./rules.js";
import {notifyError} from "./helpers.js";
import {slotUpdates,assertLoadoutEditable} from "./loadout.js";
import {validateSkillSlot,syncCrest} from "./crest.js";
export class StellaItemSheet extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2) {
  static DEFAULT_OPTIONS={tag:"form",classes:["stella","stella-v14","sheet","item"],position:{width:620,height:690},form:{submitOnChange:true,closeOnSubmit:false,handler:StellaItemSheet.submit}};
  static PARTS={main:{template:`systems/${ID}/templates/ability-sheet.html`}};
  async _prepareContext(options) {return {...await super._prepareContext(options),item:this.item,system:this.item.system,editable:this.isEditable,crest:["flower","color"].includes(this.item.type),skillKeysText:(this.item.system.skillKeys??[]).join("\n"),children:game.items.filter(i=>i.type==="ability"&&this.item.system.skillKeys?.includes(i.system.key))};}
  _onRender(context,options) {
    super._onRender(context,options);
    if(!['flower','color'].includes(this.item.type))return;
    this.element.querySelector('.stella-content').addEventListener('dragover',event=>{if(this.isEditable)event.preventDefault();},{once:false});
    this.element.querySelector('.stella-content').addEventListener('drop',async event=>{
      event.preventDefault();event.stopImmediatePropagation();
      try {
        if(!this.isEditable)return;
        if(this.item.parent)assertLoadoutEditable();
        const data=foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
        if(data.type!=='Item')return;
        const skill=await Item.implementation.fromDropData(data);
        if(skill.type!=='ability')throw Error('Drop a Skill Item onto its Flower / Color parent');
        const key=skill.system.key||skill.id;
        await this.item.update({'system.skillKeys':[...new Set([...this.item.system.skillKeys,key])]},{stellaCrestChange:true});
        if(skill.isOwner)await skill.update({'system.key':key,'system.parentType':this.item.type,'system.parentKey':this.item.system.key});
        if(this.item.parent)await syncCrest(this.item.parent);
      }catch(e){notifyError(e);}
    },{capture:true});
  }
  static async submit(_event,_form,formData) {
    try {
      const data=formData.object,newSlot=Number(data["system.number"]??this.item.system.number);
      if(!this.isEditable)return;
      if(this.item.type==="ability"&&this.item.parent && newSlot!==this.item.system.number) {
        assertLoadoutEditable();
        validateSkillSlot(this.item.parent,this.item,newSlot);
        const updates=slotUpdates(this.item.parent.items,this.item,newSlot);
        delete data["system.number"];
        await this.item.parent.updateEmbeddedDocuments("Item",updates);
      }
      if(["flower","color"].includes(this.item.type)){
        if(this.item.parent)assertLoadoutEditable();
        if('system.skillKeys' in data)data['system.skillKeys']=String(data['system.skillKeys']).split(/[\n,]/).map(k=>k.trim()).filter(Boolean);
      }
      await this.item.update(data,{stellaCrestChange:["flower","color"].includes(this.item.type)});
      if(this.item.parent&&["flower","color"].includes(this.item.type))await syncCrest(this.item.parent,{adjustHP:true});
    }catch(e){notifyError(e);}
  }
}
