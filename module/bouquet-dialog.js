// V14 version of upstream Bouquet distribution. GM-mediated cross-owner writes.
import {ID,isFighter,isEnemy} from "./rules.js";
import {request} from "./socket.js";
import {notifyError} from "./helpers.js";
export class BouquetDialog extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS={id:"stella-bouquets",classes:["stella-v14"],window:{title:"Bouquets"},position:{width:440,height:550},actions:{give:BouquetDialog.give}};
  static PARTS={main:{template:`systems/${ID}/templates/bouquet-dialog.html`}};
  async _prepareContext() {return {actors:game.actors.filter(a=>isFighter(a)&&!isEnemy(a)&&a.visible).map(a=>({id:a.id,img:a.img,name:a.name,bouquet:a.system.bouquet}))};}
  static async give(_event,target) {try{await request("give",{actor:target.dataset.actor});}catch(e){notifyError(e);}}
}
