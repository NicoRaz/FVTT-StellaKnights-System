import {ID,isEnemy} from './rules.js';
import {request} from './socket.js';
import {pick} from './helpers.js';
import {stages} from './library.js';
import {setCombatOrder,orderedCombatants} from './combat-state.js';
// Foundry owns the Combat and Combatant documents, tracker, rounds and turns.
// These methods add Stellar phases and Stage routines to its native controls.
export class StellaCombat extends foundry.documents.Combat {
  _sortCombatants(a,b) {
    const enemy=Number(b.actor&&isEnemy(b.actor))-Number(a.actor&&isEnemy(a.actor));
    return enemy||super._sortCombatants(a,b);
  }
  async startCombat() {
    const stage=await pick('Stellar Battle — Stage',stages.map(s=>({value:s.id,label:s.name})));
    if(stage)await request('start',{combat:this.id,stage,actors:orderedCombatants(this).map(c=>c.actor.id)});
    return this;
  }
  async nextTurn() {
    if(!this.getFlag(ID,'battle'))return super.nextTurn();
    await request('advance',{combat:this.id});return this;
  }
  async nextRound() {
    if(!this.getFlag(ID,'battle'))return super.nextRound();
    if(this.getFlag(ID,'battle').phase!=='cut')throw Error('Complete Set, Charge and Actions before starting the next round');
    await request('advance',{combat:this.id});return this;
  }
  async previousTurn() {
    if(!this.getFlag(ID,'battle'))return super.previousTurn();
    throw Error('Resolved Skill and Stage effects cannot be undone by rewinding a turn');
  }
  async previousRound() {
    if(!this.getFlag(ID,'battle'))return super.previousRound();
    throw Error('Resolved Skill and Stage effects cannot be undone by rewinding a round');
  }
  async rollInitiative(_ids,_options={}) {
    await setCombatOrder(this,orderedCombatants(this).map(c=>c.actor.id));return this;
  }

}
