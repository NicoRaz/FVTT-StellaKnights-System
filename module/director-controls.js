import {state,currentActors,formDialog,gmOnly} from './helpers.js';
import {stages} from './library.js';
import {escapeHTML as esc} from './rules.js';
import {request} from './socket.js';
// Small tracker dialog for rulings; no separate arena or turn tracker.
export async function directorControls() {
  gmOnly(game.user);
  const s=state(),actors=currentActors();
  const content=`<p>Director decisions override the automated sequence. Changing rounds or turns does not undo previous effects.</p>
    <p>Stage: edit the Stage Actor in this Combat.</p><input type="hidden" name="stage" value="${esc(s.stage)}">
    ${s.nativeControls?'<input type="hidden" name="phase" value="actions">':`<label>Phase<select name="phase">${['set','charge','actions','cut'].map(phase=>`<option ${phase===s.phase?'selected':''}>${phase}</option>`).join('')}</select></label>`}
    <label>Round<input name="round" type="number" min="1" value="${Math.max(1,s.round??1)}"></label>
    ${actors.map(a=>`<fieldset><legend>${esc(a.name)}</legend>${[['garden','Garden',1,6,a.system.garden],['hp','Endurance',0,999,a.system.hp.value],['bouquet','Bouquet',0,999,a.system.bouquet],['exp','Medals',0,999,a.system.exp],['distortion','Distortion',0,999,a.system.distortion]].map(([field,label,min,max,value])=>`<label>${label}<input name="${field}-${a.id}" type="number" min="${min}" max="${max}" value="${value}"></label>`).join('')}</fieldset>`).join('')}
    ${s.pending?'<label><input type="checkbox" name="cancelCheck">Cancel the pending check (already applied effects remain)</label>':''}
    <label><input type="checkbox" name="end">End this battle</label>`;
  const data=await formDialog('Director controls',content,f=>({stage:f.elements.stage.value,phase:f.elements.phase.value,round:Number(f.elements.round.value),cancelCheck:!!f.elements.cancelCheck?.checked,end:f.elements.end.checked,
    actors:actors.map(a=>({actor:a.id,...Object.fromEntries(['garden','hp','bouquet','exp','distortion'].map(field=>[field,Number(f.elements[`${field}-${a.id}`].value)]))}))}));
  if(data)await request('director-update',data);
}
