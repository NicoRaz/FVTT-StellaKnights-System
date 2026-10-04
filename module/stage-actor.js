import {ID,escapeHTML as esc,isFighter} from './rules.js';
import {stages} from './library.js';
import {formDialog,notifyError} from './helpers.js';
import {request} from "./socket.js";
import {stageDocument} from './stage-data.js';
export class StageActorSheet extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2) {
  static DEFAULT_OPTIONS={tag:'form',classes:['stella','stella-v14','sheet','actor'],position:{width:760,height:800},form:{submitOnChange:true,closeOnSubmit:false,handler:StageActorSheet.submit},actions:{addRoutine:StageActorSheet.addRoutine,removeRoutine:StageActorSheet.removeRoutine,preset:StageActorSheet.preset,editSkill:StageActorSheet.editSkill,useSkill:StageActorSheet.useSkill}};
  static PARTS={main:{template:`systems/${ID}/templates/stage-sheet.html`}};
  async _prepareContext(options){return {...await super._prepareContext(options),actor:this.actor,system:this.actor.system,items:[...this.actor.items],editable:this.isEditable};}
  static async submit(_event,_form,data){if(!this.isEditable)return;const changes=data.object,routines=structuredClone(this.actor.system.routines);let changed=false;
    for(const [key,value] of Object.entries(changes)){const match=key.match(/^system\.routines\.(\d+)\.(name|text)$/);if(match&&routines[Number(match[1])]){routines[Number(match[1])][match[2]]=value;delete changes[key];changed=true;}}
    if(changed)changes['system.routines']=routines;await this.actor.update(changes);}
  static async addRoutine(){if(this.isEditable)await this.actor.update({'system.routines':[...this.actor.system.routines,{name:'New Omen',text:''}]});}
  static async removeRoutine(_event,target){if(this.isEditable)await this.actor.update({'system.routines':this.actor.system.routines.filter((_,n)=>n!==Number(target.dataset.index))});}
  static async preset(){
    if(!this.isEditable)return;
    try{const id=await formDialog('Stage preset',`<select name="stage">${stages.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select>`,f=>f.elements.stage.value);if(!id)return;
      const data=stageDocument(stages.find(r=>r.id===id));await this.actor.update({name:data.name,system:data.system,"prototypeToken.actorLink":true});
      const old=this.actor.items.filter(i=>i.system.key?.startsWith('stage:'));if(old.length)await this.actor.deleteEmbeddedDocuments('Item',old.map(i=>i.id));
      await this.actor.createEmbeddedDocuments('Item',data.items);
    }catch(e){notifyError(e);}
  }
  static async editSkill(_event,target){this.actor.items.get(target.dataset.item)?.sheet.render(true);}
  static async useSkill(_event,target){const item=this.actor.items.get(target.dataset.item);if(!item)return;
    try{if(item.system.scriptEnabled)await request('use',{actor:this.actor.id,item:item.id,directUse:true,targets:[...(game.user.targets??[])].map(t=>t.actor?.id).filter(Boolean)});
    else await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:this.actor}),content:`<h3>${esc(item.name)}</h3><pre>${esc(item.system.effect)}</pre>`});}catch(e){notifyError(e);}
  }
}
