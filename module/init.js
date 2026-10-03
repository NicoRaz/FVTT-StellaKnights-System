// Based on ksx0330/FVTT-StellaKnights-System (MIT), ported to Foundry v14.
import {StellaItemSheet} from "./item-sheet.js";
import {StellaActorSheet} from "./actor-sheet.js";
import {BouquetDialog} from "./bouquet-dialog.js";
import {BattlePanel,supportDialog} from "./battle-panel.js";
import {FighterData,SheathData,AbilityData,CrestData} from "./data-models.js";
import {loadCatalog,skills} from "./library.js";
import {registerSocket,request} from "./socket.js";
import {execute} from "./engine.js";
import {ID} from "./rules.js";
import {notifyError,state,t,openSidebarTab} from "./helpers.js";
import {StellaCombat} from "./combat.js";
import {archiveCombat,ensureCombat,stellarCombat,persistBattle} from "./combat-state.js";
import {crestDocuments,crestItems,syncCrest} from "./crest.js";
let battlePanel,bouquetDialog;
Hooks.once("init",()=>{
  CONFIG.Combat.documentClass=StellaCombat;
  CONFIG.Actor.dataModels={...CONFIG.Actor.dataModels,bringer:FighterData,sheath:SheathData,embraced:FighterData,eclipsed:FighterData};
  CONFIG.Item.dataModels={...CONFIG.Item.dataModels,ability:AbilityData,flower:CrestData,color:CrestData};
  foundry.documents.collections.Actors.registerSheet(ID,StellaActorSheet,{types:["bringer","sheath","embraced","eclipsed"],makeDefault:true});
  foundry.documents.collections.Items.registerSheet(ID,StellaItemSheet,{types:["ability","flower","color"],makeDefault:true});
  game.settings.register(ID,"battle",{scope:"world",config:false,type:Object,default:{active:false,round:0,phase:"set",actors:[],charged:[],markers:[],maps:[]}});
  game.settings.register(ID,"schemaVersion",{scope:"world",config:false,type:Number,default:0});
  game.settings.register(ID,"session",{scope:"world",config:false,type:Object,default:{active:false,phase:"prologue",pairs:[],cursor:0}});
  game.settings.register(ID,"allowBattleBouquets",{name:"Allow Bouquets during Stellar Battle",hint:"House rule (p.114). By default there is no Audience in the Final Chapter.",scope:"world",config:true,type:Boolean,default:false});
  game.stellaknights={request,openCombat:()=>openSidebarTab("combat"),openBattle:()=>{battlePanel??=new BattlePanel();battlePanel.render(true);},
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
  if(game.users.filter(u=>u.active&&u.isGM).sort((a,b)=>a.id.localeCompare(b.id))[0]?.id!==game.user.id||game.settings.get(ID,"schemaVersion")>=2)return;
  // Foundry handles the data -> system / permission -> ownership core migration.
  // Fix the original sheet's incorrect karma path, and recognize its basic skill.
  for(const a of game.actors) {
    const updates=[];
    const selected=crestItems(a);
    if(a.type!=="sheath") {
      const documents=crestDocuments(skills).filter(d=>!selected[d.type]&&d.system.key===a.system.details.crest[d.type]);
      if(documents.length)await a.createEmbeddedDocuments("Item",documents,{stellaCrestChange:true});
    }
    for(const i of a.items){
      if(i.type!=="ability")continue;
      const record=skills.find(s=>s.id===i.system.key||s.name===i.name);
      if(record){const parent=crestDocuments(skills).find(p=>p.system.key===record.group);updates.push({_id:i.id,"system.key":record.id,"system.parentType":parent?.type??"","system.parentKey":parent?.system.key??""});}
      else if(!i.system.key&&/etiquette|作法|예절|에티켓/i.test(i.name))updates.push({_id:i.id,"system.key":"knights-etiquette","system.timingKey":"your-turn"});
    }
    if(updates.length)await a.updateEmbeddedDocuments("Item",updates);
    if(a.type!=="sheath")await syncCrest(a);
  }
  const legacy=game.settings.get(ID,"battle");
  if(legacy.active&&!stellarCombat()){
    const actors=legacy.actors.map(id=>game.actors.get(id)).filter(Boolean);
    if(actors.length){await ensureCombat(actors);await persistBattle(legacy);}
  }
  await game.settings.set(ID,"schemaVersion",2);
}
function refreshSheets(){for(const actor of game.actors)if(actor.sheet?.rendered)actor.sheet.render();}
function refreshPanels(){if(battlePanel?.rendered)battlePanel.render({force:true});if(bouquetDialog?.rendered)bouquetDialog.render({force:true});}
Hooks.on("updateActor",refreshPanels);
for(const hook of ["createItem","updateItem","deleteItem"])Hooks.on(hook,async (item,options)=>{
  refreshPanels();
  if(!options?.stellaCrestChange&&game.users.filter(u=>u.active&&u.isGM).sort((a,b)=>a.id.localeCompare(b.id))[0]?.id===game.user.id&&item.parent&&["flower","color"].includes(item.type))await syncCrest(item.parent,{adjustHP:true});
});
Hooks.on("updateCombat",()=>{
  refreshPanels();
  refreshSheets();
});
Hooks.on("deleteCombat",async combat=>{if(game.user.isGM)await archiveCombat(combat);refreshPanels();refreshSheets();});
Hooks.on("renderCombatTracker",(_app,html)=>{
  const s=state();if(!s.combatId||game.combat?.id!==s.combatId)return;
  const root=html instanceof HTMLElement?html:html[0];if(!root)return;
  const controls=document.createElement('div');controls.className='stella-combat-controls';
  const label=document.createElement('span');label.textContent=`${s.phase} · Round ${s.round}`;controls.append(label);
  if(game.user.isGM&&s.active){const next=document.createElement('button');next.type='button';next.textContent='Next phase / turn';next.addEventListener('click',async()=>{try{await game.combat.nextTurn();}catch(e){notifyError(e);}});controls.append(next);}
  const arena=document.createElement('button');arena.type='button';arena.textContent='Stage / Gardens';arena.addEventListener('click',()=>game.stellaknights.openBattle());controls.append(arena);
  root.prepend(controls);
});
Hooks.on("createActor",refreshPanels);
Hooks.on("deleteActor",refreshPanels);
Hooks.on("updateSetting",setting=>{if([`${ID}.battle`,`${ID}.session`].includes(setting.key)){refreshPanels();refreshSheets();}});
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
