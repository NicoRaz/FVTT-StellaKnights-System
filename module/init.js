// Based on ksx0330/FVTT-StellaKnights-System (MIT), ported to Foundry v14.
import {StellaItemSheet} from "./item-sheet.js";
import {StellaActorSheet} from "./actor-sheet.js";
import {BouquetDialog} from "./bouquet-dialog.js";
import {supportDialog} from "./support-dialog.js";
import {directorControls} from "./director-controls.js";
import {FighterData,SheathData,AbilityData,CrestData,StageData} from "./data-models.js";
import {loadCatalog,skills} from "./library.js";
import {registerSocket,request} from "./socket.js";
import {execute,clearCombatDice} from "./engine.js";
import {ID,isFighter} from "./rules.js";
import {notifyError,state,t,openSidebarTab,currentActors} from "./helpers.js";
import {StellaCombat} from "./combat.js";
import {archiveCombat,ensureCombat,stellarCombat,persistBattle} from "./combat-state.js";
import {crestDocuments,crestItems,syncCrest} from "./crest.js";
import {StageActorSheet} from "./stage-actor.js";
import {registerGardenRegion} from "./garden-region.js";
let bouquetDialog;
Hooks.once("init",()=>{
  registerGardenRegion();
  CONFIG.Combat.documentClass=StellaCombat;
  CONFIG.Combat.initiative??={};CONFIG.Combat.initiative.formula??="1d20";
  CONFIG.Actor.dataModels={...CONFIG.Actor.dataModels,stage:StageData,bringer:FighterData,sheath:SheathData,embraced:FighterData,eclipsed:FighterData};
  CONFIG.Item.dataModels={...CONFIG.Item.dataModels,ability:AbilityData,flower:CrestData,color:CrestData};
  foundry.documents.collections.Actors.registerSheet(ID,StellaActorSheet,{types:["bringer","sheath","embraced","eclipsed"],makeDefault:true});
  foundry.documents.collections.Actors.registerSheet(ID,StageActorSheet,{types:["stage"],makeDefault:true});
  foundry.documents.collections.Items.registerSheet(ID,StellaItemSheet,{types:["ability","flower","color"],makeDefault:true});
  game.settings.register(ID,"battle",{scope:"world",config:false,type:Object,default:{active:false,round:0,phase:"set",actors:[],charged:[],markers:[],maps:[]}});
  game.settings.register(ID,"schemaVersion",{scope:"world",config:false,type:Number,default:0});
  game.settings.register(ID,"session",{scope:"world",config:false,type:Object,default:{active:false,phase:"prologue",pairs:[],cursor:0}});
  game.settings.register(ID,"directorMode",{name:"Director rulings",hint:"Allow loadout edits during combat and flexible encounters. The Director can override turn and Skill usage limits; ownership and pending-check protection remain active.",scope:"world",config:true,type:Boolean,default:true});
  game.settings.register(ID,"allowBattleBouquets",{name:"Allow Bouquets during Stellar Battle",hint:"House rule (p.114). By default there is no Audience in the Final Chapter.",scope:"world",config:true,type:Boolean,default:false});
  game.stellaknights={request,openCombat:()=>openSidebarTab("combat"),openDirectorControls:directorControls,
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
    if(a.type==="stage")continue;
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
function refreshPanels(){if(bouquetDialog?.rendered)bouquetDialog.render({force:true});}
Hooks.on("updateActor",refreshPanels);
for(const hook of ["createItem","updateItem","deleteItem"])Hooks.on(hook,async (item,options)=>{
  refreshPanels();
  if(!options?.stellaCrestChange&&game.users.filter(u=>u.active&&u.isGM).sort((a,b)=>a.id.localeCompare(b.id))[0]?.id===game.user.id&&item.parent&&["flower","color"].includes(item.type))await syncCrest(item.parent,{adjustHP:true});
});
Hooks.on("updateCombat",(combat,changes,options)=>{
  if(!options?.stellaPhaseTransition&&combat.getFlag(ID,"battle")?.active&&('round' in changes||'turn' in changes)&&game.users.filter(u=>u.active&&u.isGM).sort((a,b)=>a.id.localeCompare(b.id))[0]?.id===game.user.id)request("native-sync",{combat:combat.id}).catch(notifyError);
  refreshPanels();
  refreshSheets();
});
Hooks.on("deleteCombat",async combat=>{if(game.users.filter(u=>u.active&&u.isGM).sort((a,b)=>a.id.localeCompare(b.id))[0]?.id===game.user.id){await clearCombatDice(combat.combatants.filter(c=>c.actor).map(c=>c.actor));await archiveCombat(combat);}refreshPanels();refreshSheets();});
Hooks.on("renderCombatTracker",(_app,html)=>{
  const s=state();if(!s.combatId||game.combat?.id!==s.combatId)return;
  const root=html instanceof HTMLElement?html:html[0];if(!root)return;
  const controls=document.createElement('div');controls.className='stella-combat-controls';
  const label=document.createElement('span');label.textContent=`Round ${s.round}`;controls.append(label);
  if(game.user.isGM&&s.active){
    const charge=document.createElement('button');charge.type='button';charge.title='Roll and allocate immediately. Use individual Charge checks for Bouquet reactions.';charge.textContent=`Charge Dice — All (Round ${s.round})`;
    const fighters=currentActors().filter(a=>isFighter(a)&&a.system.hp.value>0);
    charge.disabled=!!s.pending||!fighters.some(a=>!s.charged?.includes(a.id));
    charge.addEventListener('click',async()=>{charge.disabled=true;try{await request('charge-all',{combat:game.combat.id});}catch(e){notifyError(e);}finally{ui.combat?.render({force:true});}});controls.append(charge);
  }
  if(game.user.isGM){const director=document.createElement('button');director.type='button';director.textContent='Director controls';director.addEventListener('click',async()=>{try{await directorControls();}catch(e){notifyError(e);}});controls.append(director);}
  root.prepend(controls);
});
Hooks.on("createActor",refreshPanels);
Hooks.on("deleteActor",refreshPanels);
Hooks.on("updateSetting",setting=>{if([`${ID}.battle`,`${ID}.session`].includes(setting.key)){refreshPanels();refreshSheets();}});
Hooks.on("getSceneControlButtons",controls=>{
  const tokens=controls.tokens;if(!tokens)return;
  tokens.tools.stellaBattle={name:"stellaBattle",title:t("Battle"),icon:"fa-solid fa-fan",order:90,button:true,onChange:()=>game.stellaknights.openCombat()};
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
