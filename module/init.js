// Based on ksx0330/FVTT-StellaKnights-System (MIT), ported to Foundry v14.
import {StellaItemSheet} from "./item-sheet.js";
import {StellaActorSheet} from "./actor-sheet.js";
import {BouquetDialog} from "./bouquet-dialog.js";
import {BattlePanel,supportDialog} from "./battle-panel.js";
import {FighterData,SheathData,AbilityData} from "./data-models.js";
import {loadCatalog} from "./library.js";
import {registerSocket,request} from "./socket.js";
import {execute} from "./engine.js";
import {ID} from "./rules.js";
import {notifyError,state,t} from "./helpers.js";
let battlePanel,bouquetDialog;
Hooks.once("init",()=>{
  CONFIG.Actor.dataModels={...CONFIG.Actor.dataModels,bringer:FighterData,sheath:SheathData,embraced:FighterData,eclipsed:FighterData};
  CONFIG.Item.dataModels={...CONFIG.Item.dataModels,ability:AbilityData};
  foundry.documents.collections.Actors.registerSheet(ID,StellaActorSheet,{types:["bringer","sheath","embraced","eclipsed"],makeDefault:true});
  foundry.documents.collections.Items.registerSheet(ID,StellaItemSheet,{types:["ability"],makeDefault:true});
  game.settings.register(ID,"battle",{scope:"world",config:false,type:Object,default:{active:false,round:0,phase:"set",actors:[],charged:[],markers:[],maps:[]}});
  game.settings.register(ID,"schemaVersion",{scope:"world",config:false,type:Number,default:0});
  game.settings.register(ID,"session",{scope:"world",config:false,type:Object,default:{active:false,phase:"prologue",pairs:[],cursor:0}});
  game.settings.register(ID,"allowBattleBouquets",{name:"Allow Bouquets during Stellar Battle",hint:"House rule (p.114). By default there is no Audience in the Final Chapter.",scope:"world",config:true,type:Boolean,default:false});
  game.stellaknights={request,openBattle:()=>{battlePanel??=new BattlePanel();battlePanel.render(true);},
    distributeBouquet:()=>{bouquetDialog??=new BouquetDialog();bouquetDialog.render(true);},
    BouquetDialog:[],getBattle:state};
  // The upstream localization helpers remain available to user-authored templates.
  Handlebars.registerHelper("incremented",index=>Number(index)+1);
  Handlebars.registerHelper("ifEquals",function(a,b,options){return a===b?options.fn(this):options.inverse(this);});
  Handlebars.registerHelper("ifSuccess",function(a,b,options){return a>=b?options.fn(this):options.inverse(this);});
});
Hooks.once("ready",async()=>{
  try{await loadCatalog();registerSocket(execute);await migrateWorld();}
  catch(e){notifyError(e);}
});
async function migrateWorld() {
  if(!game.user.isGM||game.settings.get(ID,"schemaVersion")>=1)return;
  // Foundry handles the data -> system / permission -> ownership core migration.
  // Fix the original sheet's incorrect karma path, and recognize its basic skill.
  for(const a of game.actors) {
    const updates=[];
    for(const i of a.items)if(i.system.number===1&&!i.system.key && /etiquette|作法|예절|에티켓/i.test(i.name))
      updates.push({_id:i.id,"system.key":"knights-etiquette","system.timingKey":"your-turn"});
    if(updates.length)await a.updateEmbeddedDocuments("Item",updates);
  }
  await game.settings.set(ID,"schemaVersion",1);
}
function refreshPanels(){if(battlePanel?.rendered)battlePanel.render({force:true});if(bouquetDialog?.rendered)bouquetDialog.render({force:true});}
Hooks.on("updateActor",refreshPanels);
Hooks.on("createActor",refreshPanels);
Hooks.on("deleteActor",refreshPanels);
Hooks.on("updateSetting",setting=>{if([`${ID}.battle`,`${ID}.session`].includes(setting.key))refreshPanels();});
Hooks.on("getSceneControlButtons",controls=>{
  const tokens=controls.tokens;if(!tokens)return;
  tokens.tools.stellaBattle={name:"stellaBattle",title:t("Battle"),icon:"fa-solid fa-fan",order:90,button:true,onChange:()=>game.stellaknights.openBattle()};
  tokens.tools.stellaBouquet={name:"stellaBouquet",title:t("BouquetDialog"),icon:"fa-solid fa-seedling",order:91,button:true,onChange:()=>game.stellaknights.distributeBouquet()};
});
Hooks.on("renderChatMessageHTML",(message,html)=>{
  if(!message.flags[ID])return;
  html.querySelectorAll("[data-stella]").forEach(button=>button.addEventListener("click",async event=>{
    event.preventDefault();button.disabled=true;
    try {
      const action=button.dataset.stella;
      if(["boost","petite","reroll"].includes(action)){
        if(state().pending!==message.id)throw Error("This card is no longer the pending check");
        await supportDialog(action);
      }
      else if(action==="accept-offer")await request("accept",{message:message.id});
      else {
        // Never resolve whichever unrelated check is currently pending from an old card.
        if(state().pending!==message.id)throw Error("This card is no longer the pending check");
        await request(action,{message:message.id});
      }
    }catch(e){notifyError(e);}finally{button.disabled=false;}
  }));
});
