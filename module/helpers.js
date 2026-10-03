import {ID, escapeHTML as esc} from "./rules.js";
export const t = key => game.i18n.localize(`Stella.${key}`);
export const notifyError = error => ui.notifications.error(error.message ?? String(error));
export {battleState as state,persistBattle as saveState} from "./combat-state.js";
import {battleState as state} from "./combat-state.js";
export const byId = id => {const a = game.actors.get(id); if (!a) throw Error("Actor not found"); return a;};
export const owner = (a, user) => {if (!user?.isGM && !a.testUserPermission(user, "OWNER")) throw Error("You do not own this character"); return a;};
export const gmOnly = user => {if (!user?.isGM) throw Error("GM only");};
export const currentActors = () => state().actors?.map(id => game.actors.get(id)).filter(Boolean) ?? [];
export async function chat(title, text, actor = null, flags = {}) {
  return ChatMessage.create({speaker: ChatMessage.getSpeaker(actor ? {actor} : {}),
    content: `<article class="stella-chat"><h3>${esc(title)}</h3><div>${text}</div></article>`, flags: {[ID]:flags}});
}
export async function rollDice(count, {atypia = false, transform = true} = {}) {
  if (count <= 0) return {values: [], roll: null};
  if (count > 100) throw Error("Dice pool is too large");
  const roll = await new Roll(`${count}d6${atypia ? "rr1" : ""}`).evaluate();
  let values = roll.dice.flatMap(d => d.results.filter(r => r.active !== false).map(r => r.result));
  if (transform) for (const map of state().maps ?? []) values = values.map(n => n === map.from ? map.to : n);
  return {values, roll};
}
// V14 DialogV2. Callbacks receive (event, button, dialog).
export async function formDialog(title, content, read) {
  return foundry.applications.api.DialogV2.wait({window:{title}, content,
    rejectClose: false, buttons:[{action:"ok", label:t("Confirm"), default:true,
      callback:(_event, button) => read(button.form)}, {action:"cancel", label:t("Cancel"), callback:() => null}]});
}
export async function pick(title, choices, {multiple = false, label = "Target"} = {}) {
  return formDialog(title, `<label>${esc(label)}<select name="choice" ${multiple ? 'multiple size="8"' : ''}>${choices.map(c => `<option value="${esc(c.value)}">${esc(c.label)}</option>`).join("")}</select></label>`,
    form => multiple ? [...form.elements.choice.selectedOptions].map(o => o.value) : form.elements.choice.value);
}
export async function askNumber(title, initial = 1, min = 0, max = 99) {
  return formDialog(title, `<input type="number" name="n" min="${min}" max="${max}" value="${initial}" required>`, form => Number(form.elements.n.value));
}
// v14 Sidebar is an ApplicationV2 with a primary tab group.
export function openSidebarTab(tab) {
  ui.sidebar.expand();
  ui.sidebar.changeTab(tab,'primary');
}
