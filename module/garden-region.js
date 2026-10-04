import {ID,integer} from './rules.js';
export const GARDEN_BEHAVIOR=`${ID}.garden`;
const authority=()=>game.users.filter(u=>u.active&&u.isGM).sort((a,b)=>a.id.localeCompare(b.id))[0]?.id===game.user.id;
export async function assignGarden(token,garden) {
  garden=integer(garden,1,6);if(!authority()||!token)return;token=token.document??token;
  if(token.getFlag(ID,'garden')!==garden)await token.setFlag(ID,'garden',garden);
  if(token.actor&&'garden' in token.actor.system&&token.actor.system.garden!==garden)await token.actor.update({'system.garden':garden});
}
export async function syncGardenRegion(region) {
  if(!authority()||!region||region.hidden)return;
  const behavior=region.behaviors.find(b=>b.type===GARDEN_BEHAVIOR&&!b.disabled);if(!behavior)return;
  for(const token of region.tokens)await assignGarden(token,behavior.system.garden);
}
export class GardenRegionBehavior extends foundry.data.regionBehaviors.RegionBehaviorType {
  static defineSchema(){return {...super.defineSchema(),garden:new foundry.data.fields.NumberField({required:true,integer:true,min:1,max:6,initial:1,label:'Garden',hint:'Garden number assigned to every Token inside this Region.'})};}
  static events={
    [CONST.REGION_EVENTS.TOKEN_ENTER]:async function(event){await assignGarden(event.data.token,this.garden);},
    [CONST.REGION_EVENTS.TOKEN_MOVE_WITHIN]:async function(event){await assignGarden(event.data.token,this.garden);},
    [CONST.REGION_EVENTS.BEHAVIOR_ACTIVATED]:async function(){await syncGardenRegion(this.region);},
    [CONST.REGION_EVENTS.REGION_BOUNDARY]:async function(){await syncGardenRegion(this.region);}
  };
}
export function registerGardenRegion(){
  CONFIG.RegionBehavior.typeLabels??={};CONFIG.RegionBehavior.typeIcons??={};
  CONFIG.RegionBehavior.dataModels[GARDEN_BEHAVIOR]=GardenRegionBehavior;
  CONFIG.RegionBehavior.typeLabels[GARDEN_BEHAVIOR]='Garden';
  CONFIG.RegionBehavior.typeIcons[GARDEN_BEHAVIOR]='fa-solid fa-seedling';
  Hooks.on('updateRegionBehavior',behavior=>{if(behavior.type===GARDEN_BEHAVIOR&&!behavior.disabled)syncGardenRegion(behavior.parent).catch(error=>ui.notifications.error(error.message));});
  Hooks.on('canvasReady',()=>{for(const region of canvas.scene?.regions??[])syncGardenRegion(region).catch(error=>ui.notifications.error(error.message));});
}
