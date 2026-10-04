import {ID,isFighter,isEnemy,escapeHTML as esc} from "./rules.js";
import {gmOnly,byId,chat,t,state,saveState,directorMode} from "./helpers.js";
export const session=()=>game.settings.get(ID,"session")??{active:false,phase:"prologue",pairs:[],cursor:0};
const save=s=>game.settings.set(ID,"session",s);
const phases=["prologue","chapter-one","chapter-two","interlude","final-chapter","curtain-call","cleanup"];
const scenes=["chapter-one","chapter-two","interlude","curtain-call"];
export async function sessionAction(op,data,user) {
  gmOnly(user);
  if(op==="sync-pair") {
    const a=byId(data.actor),partner=byId(a.system.details.partner);
    if(!isFighter(a)||partner.type!=="sheath")throw Error("Select a Sheath as the Bringer's partner first");
    const d=a.system.details;
    await partner.update({"system.details.partner":a.id,"system.details.wish":d.wish,"system.details.wishTier":d.wishTier,
      "system.details.crest":d.crest,"system.details.keyword":d.keyword,"system.details.karma.type":d.karma.type==="hope"?"despair":"hope"});
    return chat(t("Partner"),`${esc(a.name)} ↔ ${esc(partner.name)}: synchronized shared Wish, Flower/Color, keyword and opposing Hope/Despair.`);
  }
  if(op==="session-start") {
    if(!directorMode()&&state().active)throw Error("Finish the battle first");
    const pairs=[...new Set(data.actors)].map(byId);
    if(!pairs.length||pairs.some(a=>!isFighter(a)||a.type==="embraced"))throw Error("Choose Bringers (and Eclipsed for Irregular play)");
    if(!directorMode())for(const a of pairs)if(!a.system.details.partner||byId(a.system.details.partner).type!=="sheath")throw Error(`${a.name}: link a Sheath first`);
    const battle=state();battle.outcome=null;await saveState(battle);
    await save({active:true,phase:"prologue",pairs:pairs.map(a=>a.id),cursor:0});
  } else if(op==="session-next") {
    const s=session();if(!s.active)throw Error("No active session");
    if(!directorMode()&&s.phase==="final-chapter"&&(state().active||!state().outcome))throw Error("Complete the Stellar Battle first");
    if(scenes.includes(s.phase)&&s.cursor+1<s.pairs.length)s.cursor++;
    else {s.phase=phases[phases.indexOf(s.phase)+1]??"cleanup";s.cursor=0;if(s.phase==="cleanup")s.active=false;}
    await save(s);
  } else throw Error("Unknown session action");
  const s=session(),a=scenes.includes(s.phase)?byId(s.pairs[s.cursor]):null;
  await chat("Session",`${esc(s.phase)}${a?` · ${esc(a.name)} / ${esc(game.actors.get(a.system.details.partner)?.name??"Unlinked")}`:""}`);
}
