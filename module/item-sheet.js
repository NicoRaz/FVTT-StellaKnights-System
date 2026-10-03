// Preserve upstream ability fields while replacing the legacy ItemSheet API.
import {ID} from "./rules.js";
import {notifyError} from "./helpers.js";
import {slotUpdates,assertLoadoutEditable} from "./loadout.js";
export class StellaItemSheet extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2) {
  static DEFAULT_OPTIONS={tag:"form",classes:["stella","stella-v14","sheet","item"],position:{width:620,height:690},form:{submitOnChange:true,closeOnSubmit:false,handler:StellaItemSheet.submit}};
  static PARTS={main:{template:`systems/${ID}/templates/ability-sheet.html`}};
  async _prepareContext(options) {return {...await super._prepareContext(options),item:this.item,system:this.item.system,editable:this.isEditable};}
  static async submit(_event,_form,formData) {
    try {
      const data=formData.object,newSlot=Number(data["system.number"]??this.item.system.number);
      if(!this.isEditable)return;
      if(this.item.parent && newSlot!==this.item.system.number) {
        assertLoadoutEditable();
        const updates=slotUpdates(this.item.parent.items,this.item,newSlot);
        delete data["system.number"];
        await this.item.parent.updateEmbeddedDocuments("Item",updates);
      }
      if(this.isEditable)await this.item.update(data);
    }catch(e){notifyError(e);}
  }
}
