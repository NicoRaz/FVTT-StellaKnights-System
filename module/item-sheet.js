import {BLOCK_OPS,BLOCK_SOURCES,BLOCK_TARGETS,newBlock,validateBlocks} from './skill-blocks.js';
// Preserve upstream ability fields while replacing the legacy ItemSheet API.
import {ID} from "./rules.js";
import {notifyError} from "./helpers.js";
import {slotUpdates,assertLoadoutEditable} from "./loadout.js";
import {validateSkillSlot,syncCrest} from "./crest.js";
import {PreserveSheetScroll} from './sheet-scroll.js';
export class StellaItemSheet extends PreserveSheetScroll(foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2)) {
  static DEFAULT_OPTIONS={tag:"form",classes:["stella","stella-v14","sheet","item"],position:{width:700,height:800},actions:{addBlock:StellaItemSheet.addBlock,removeBlock:StellaItemSheet.removeBlock,blockUp:StellaItemSheet.moveBlock,blockDown:StellaItemSheet.moveBlock},form:{submitOnChange:true,closeOnSubmit:false,handler:StellaItemSheet.submit}};
  static PARTS={main:{scrollable:[''],template:`systems/${ID}/templates/ability-sheet.html`}};
  async _prepareContext(options) {return {...await super._prepareContext(options),item:this.item,system:this.item.system,blocks:(this.item.system.blocks??[]).map(b=>({...b,isModifier:b.op==='modifier',isCharge:b.op==='charge',isChat:b.op==='chat',useSource:!['chat','repeat','if'].includes(b.op)})),blockOps:BLOCK_OPS,blockSources:BLOCK_SOURCES,blockTargets:BLOCK_TARGETS,blockStats:{attack:"Attack bonus",defense:"Defense"},blockDurations:{round:"Round",battle:"Battle",persistent:"Persistent"},editable:this.isEditable,crest:["flower","color"].includes(this.item.type),skillKeysText:(this.item.system.skillKeys??[]).join("\n"),children:game.items.filter(i=>i.type==="ability"&&this.item.system.skillKeys?.includes(i.system.key))};}
  async _onRender(context,options) {
    await super._onRender(context,options);
    if(this.item.type==='ability'){
      const root=this.element.querySelector('.stella-content');
      root.addEventListener('dragstart',event=>{const handle=event.target.closest('.block-handle');if(this.isEditable&&handle)event.dataTransfer.setData('text/plain',JSON.stringify({type:'StellaSkillBlock',index:Number(handle.dataset.blockIndex)}));});
      root.addEventListener('dragover',event=>{if(this.isEditable&&event.target.closest('.skill-block'))event.preventDefault();});
      root.addEventListener('drop',async event=>{const row=event.target.closest('.skill-block');if(!this.isEditable||!row)return;event.preventDefault();try{const data=JSON.parse(event.dataTransfer.getData('text/plain'));if(data.type!=='StellaSkillBlock')return;const blocks=structuredClone(this.item.system.blocks),from=Number(data.index),to=Number(row.dataset.blockIndex);if(!Number.isInteger(from)||from<0||from>=blocks.length||from===to)return;blocks.splice(to,0,blocks.splice(from,1)[0]);await this.item.update({'system.blocks':blocks});}catch(e){notifyError(e);}});
      return;
    }
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
  static async addBlock(){if((this.item.system.blocks??[]).length>=40){notifyError(Error('A Skill supports up to 40 blocks'));return;}if(this.isEditable)await this.item.update({'system.blocks':[...(this.item.system.blocks??[]),newBlock()]});}
  static async removeBlock(_event,target){if(this.isEditable)await this.item.update({'system.blocks':this.item.system.blocks.filter((_,n)=>n!==Number(target.dataset.index))});}
  static async moveBlock(_event,target){if(!this.isEditable)return;const blocks=structuredClone(this.item.system.blocks),index=Number(target.dataset.index),next=index+(target.dataset.action==='blockUp'?-1:1);if(next<0||next>=blocks.length)return;[blocks[index],blocks[next]]=[blocks[next],blocks[index]];await this.item.update({'system.blocks':blocks});}
  static async submit(_event,_form,formData) {
    try {
      const data=formData.object,newSlot=Number(data["system.number"]??this.item.system.number);
      if(!this.isEditable)return;
      if(this.item.type==='ability'){
        const blocks=structuredClone(this.item.system.blocks??[]);let changed=false;
        for(const [key,value] of Object.entries(data)){const match=key.match(/^system\.blocks\.(\d+)\.(\w+)$/);if(!match)continue;const index=Number(match[1]);if(blocks[index])blocks[index][match[2]]=['value','face'].includes(match[2])?Number(value):value;delete data[key];changed=true;}
        if(changed){validateBlocks(blocks);data['system.blocks']=blocks;}
      }
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
