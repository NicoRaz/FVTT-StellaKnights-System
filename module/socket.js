import {ID} from "./rules.js";
// Serialize all shared mutations on one GM, including same-actor Bouquet clicks.
// Foundry sockets assume cooperative authenticated world members (see README).
let chain = Promise.resolve();
const pending = new Map();
let execute;
const activeGM = () => game.users.filter(u => u.active && u.isGM).sort((a,b) => a.id.localeCompare(b.id))[0];
export function registerSocket(handler) {
  execute = handler;
  game.socket.on(`system.${ID}`, message => {
    if (message.kind === "reply" && message.to === game.user.id) {
      const p = pending.get(message.id); if (!p) return;
      clearTimeout(p.timeout); pending.delete(message.id);
      message.error ? p.reject(Error(message.error)) : p.resolve(message.result);
    } else if (message.kind === "request" && activeGM()?.id === game.user.id) {
      enqueue(message.op, message.data, game.users.get(message.user)).then(
        result => game.socket.emit(`system.${ID}`, {kind:"reply", id:message.id, to:message.user, result}),
        error => game.socket.emit(`system.${ID}`, {kind:"reply", id:message.id, to:message.user, error:error.message}));
    }
  });
}
function enqueue(op, data, user) {
  const work = chain.then(() => {if (!user?.active) throw Error("User is not active"); return execute(op, data, user);});
  chain = work.catch(() => {}); return work;
}
export async function request(op, data = {}) {
  const gm = activeGM(); if (!gm) throw Error(game.i18n.localize("Stella.NoGM"));
  if (gm.id === game.user.id) return enqueue(op, data, game.user);
  const id = foundry.utils.randomID();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {pending.delete(id); reject(Error("GM response timed out; check the chat/state before retrying."));}, 180000);
    pending.set(id, {resolve,reject,timeout});
    game.socket.emit(`system.${ID}`, {kind:"request", id, op, data, user:game.user.id});
  });
}
