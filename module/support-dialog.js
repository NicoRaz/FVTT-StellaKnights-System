import {isFighter} from "./rules.js";
import {state,pick,t,formDialog} from "./helpers.js";
import {request} from "./socket.js";
export async function supportDialog(effect) {
  const check=state().pending;
  const payers=game.actors.filter(a=>a.isOwner&&isFighter(a));
  const payer=await pick(t("Support"),payers.map(a=>({value:a.id,label:`${a.name} (${a.system.bouquet} Bouquet)`})));
  if(!payer)return;
  const data={payer,effect,check};
  if(effect==="petite") {
    const info=await formDialog(t("Petite"),'<label>Die position (starts at 1)<input type="number" name="index" min="1" value="1"></label><label>Shift<select name="delta"><option value="1">+1</option><option value="-1">−1</option></select></label>',
      f=>({index:Number(f.elements.index.value)-1,delta:Number(f.elements.delta.value)}));
    if(!info)return;Object.assign(data,info);
  }
  await request("offer",data);
}
