// Pure rules from the supplied fan translation, printed pp. 50–51, 132–155, 195.
export const ID = "stellaknights";
export const COLORS = {
  Black: {hp: 16, defense: 3, charge: 3}, Red: {hp: 11, defense: 3, charge: 3},
  Yellow: {hp: 14, defense: 4, charge: 2}, Blue: {hp: 12, defense: 3, charge: 3},
  White: {hp: 16, defense: 4, charge: 2}, Purple: {hp: 16, defense: 4, charge: 2}
};
export const FLOWERS = ["Rose", "Columbine", "Cosmos", "Morning Glory", "Anemone", "Spider Lily", "Amaranthus"];
export const COSTS = {petite: 3, boost: 4, reroll: 5};
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const defense = n => clamp(Number(n), 1, 6);
export function integer(n, lo = 0, hi = 999) {
  n = Number(n);
  if (!Number.isInteger(n) || n < lo || n > hi) throw Error(`Expected integer ${lo}–${hi}`);
  return n;
}
export function gardenDistance(a, b) {
  a = integer(a, 1, 6); b = integer(b, 1, 6);
  const d = Math.abs(a - b); return Math.min(d, 6 - d);
}
export const adjacent = (a, b) => gardenDistance(a, b) <= 1;
export const clockwise = g => integer(g, 1, 6) % 6 + 1;
export const opposite = g => (integer(g, 1, 6) + 2) % 6 + 1;
export function toward(g, target = 1) {
  if (g === target) return g;
  const next = clockwise(g), prev = (g + 4) % 6 + 1;
  return gardenDistance(next, target) <= gardenDistance(prev, target) ? next : prev;
}
export function successes(dice, targetDefense) {
  return dice.filter(n => integer(n, 1, 6) >= defense(targetDefense)).length;
}
export function allocate(dice) {
  const slots = [0, 0, 0, 0, 0, 0];
  for (const n of dice) slots[integer(n, 1, 6) - 1]++;
  return slots;
}
export function shiftDie(dice, index, delta, priorIndex = null) {
  index = integer(index, 0, dice.length - 1); delta = Number(delta);
  if (![1, -1].includes(delta)) throw Error("Shift must be +1 or −1");
  if (priorIndex !== null && priorIndex !== index) throw Error("Petite Lucky must affect the same die in this check");
  const next = [...dice]; next[index] = integer(next[index] + delta, 1, 6); return next;
}
export function endurance(current, change, {revive = false} = {}) {
  if (current === 0 && change > 0 && !revive) throw Error("Normal recovery cannot revive an incapacitated character");
  return Math.max(0, current + change); // Initial Endurance is not a healing cap.
}
export function enemyBlessing(knights) {
  integer(knights, 1, 20); return {hp: knights * 5, charge: Math.max(0, knights - 3), attack: 1};
}
export function wishMedals(tier) { tier = integer(tier, 1, 10); return tier <= 5 ? tier * 6 : null; }
export const isEnemy = a => ["embraced", "eclipsed"].includes(a.type) || a.system?.enemy === true;
export const isFighter = a => ["bringer", "embraced", "eclipsed"].includes(a.type);
export const escapeHTML = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[c]));
