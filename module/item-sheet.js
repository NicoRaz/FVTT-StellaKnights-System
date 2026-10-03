// Preserve upstream ability fields while replacing the legacy ItemSheet API.
import {ID} from "./rules.js";
import {notifyError} from "./helpers.js";
export class StellaItemSheet extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2) {
  static DEFAULT_OPTIONS={tag:"form",classes:["stella","stella-v14","sheet","item"],position:{width:620,height:690},form:{submitOnChange:true,closeOnSubmit:false,handler:StellaItemSheet.submit}};
  static PARTS={main:{template:`systems/${ID}/templates/ability-sheet.html`}};
  async _prepareContext(options) {return {...await super._prepareContext(options),item:this.item,system:this.item.system,editable:this.isEditable};}
  static async submit(_event,_form,formData) {
    try {
      const data=formData.object,newSlot=Number(data["system.number"]??this.item.system.number);
      if(this.item.parent) {
        if(this.item.system.number===1&&newSlot!==1)throw Error("Slot 1 cannot be changed");
        if(newSlot===1&&this.item.system.key!=="knights-etiquette")throw Error("Slot 1 is Knight’s Etiquette");
        if(newSlot>0&&this.item.parent.items.some(i=>i.id!==this.item.id&&i.system.number===newSlot))throw Error("That slot is already occupied");
      }
      if(this.isEditable)await this.item.update(data);
    }catch(e){notifyError(e);}
  }
}
