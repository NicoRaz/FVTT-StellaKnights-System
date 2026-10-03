// Slot changes are shared by drag-and-drop and the Item sheet.
export function slotUpdates(items, item, number) {
  number=Number(number);
  if(!Number.isInteger(number)||number<0||number>6)throw Error("Choose a slot from 0 (reserve) to 6");
  if(item.system.number===1&&number!==1)throw Error("Knight’s Etiquette stays in slot 1");
  if(number===1&&item.system.key!=="knights-etiquette")throw Error("Slot 1 is Knight’s Etiquette");
  const old=Number(item.system.number)||0;
  const occupied=number>0?items.find(i=>i.type==="ability"&&i.id!==item.id&&i.system.number===number):null;
  const updates=[{_id:item.id,"system.number":number}];
  if(occupied)updates.push({_id:occupied.id,"system.number":old});
  return updates;
}
export function assertLoadoutEditable() {
  if(game.settings.get("stellaknights","battle").active)throw Error("Finish the battle before changing the loadout");
}
