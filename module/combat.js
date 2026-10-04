import {ID} from './rules.js';
import {request} from './socket.js';
import {gmOnly} from './helpers.js';
import {stageCombatant} from './stage-data.js';
import {orderedCombatants} from './combat-state.js';
// Initiative sorting/rolling and round/turn navigation belong to Foundry.
export class StellaCombat extends foundry.documents.Combat {
  async startCombat() {
    gmOnly(game.user);
    const stage=stageCombatant(this);if(!stage)throw Error('Add a Stage Token to this Combat before starting');
    await request('start',{combat:this.id,stage:stage.actor.system.key,stageActor:stage.actor.id,nativeControls:true,actors:orderedCombatants(this).map(c=>c.actor.id)});
    return this;
  }
  async nextTurn() {
    this._checkNavigation();await super.nextTurn();await this._syncStellar();return this;
  }
  async nextRound() {
    this._checkNavigation();await super.nextRound();await this._syncStellar();return this;
  }
  async previousTurn() {
    this._checkNavigation();await super.previousTurn();await this._syncStellar();return this;
  }
  async previousRound() {
    this._checkNavigation();await super.previousRound();await this._syncStellar();return this;
  }
  async endCombat() {
    const members=[...this.combatants].filter(c=>c.actor).map(c=>c.actor.uuid??c.actor.id);
    const result=await super.endCombat();
    // Foundry returns the deleted document on confirmation; cancelling returns undefined.
    if(result)await request('clear-combat-dice',{actors:members});
    return result;
  }
  _checkNavigation() {
    if(!this.getFlag(ID,'battle'))return;
    gmOnly(game.user);
    if(this.getFlag(ID,'battle').pending)throw Error('Resolve or cancel the pending check first');
  }
  async _syncStellar() {
    if(this.getFlag(ID,'battle')?.active)await request('native-sync',{combat:this.id});
  }
}
