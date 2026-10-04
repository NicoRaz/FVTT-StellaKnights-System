import fs from 'node:fs';
import {battleState} from '../module/combat-state.js';
import {crestDocuments} from '../module/crest.js';
import {ID} from '../module/rules.js';
import {loadCatalog,skillDocument,skills} from '../module/library.js';
let serial=0;
export class Collection extends Array {get(id){return this.find(x=>x.id===id);} }
function setPath(o,key,value){const p=key.split('.');for(const k of p.slice(0,-1))o=o[k]??={};o[p.at(-1)]=structuredClone(value);}
export class MockItem {
 constructor(data){this.id=data._id??'i'+(++serial);this.name=data.name;this.type=data.type;this.ownership=structuredClone(data.ownership??{});this.system={charge:0,uses:{},timingKey:'your-turn',attackDice:0,move:0,...structuredClone(data.system)};}
 toObject(){return {name:this.name,type:this.type,ownership:structuredClone(this.ownership),system:structuredClone(this.system)};}
 testUserPermission(user){return user.isGM||this.parent?.testUserPermission(user)||this.ownership.default>=2;}
 async update(data){for(const [k,v]of Object.entries(data))setPath(this,k,v);return this;}
}
export class MockActor {
 constructor(id,type='bringer',opts={}) {
  this.id=id;this.name=id;this.type=type;this.visible=true;this.isOwner=true;
  this.system={details:{crest:{color:'Black',flower:'Rose'},wishTier:1},hp:{value:16,max:16,min:0},defense:{value:3},charge:{value:3},exp:0,distortion:0,bouquet:50,bouquetSpent:0,garden:1,done:false,enemy:false,flames:0,atypia:false,blessings:{hp:0,charge:0,attack:0},modifiers:[],...opts};
  this.items=new Collection();this.allowed=new Set(['gm',id]);
 }
 testUserPermission(user){return this.allowed.has(user.id);}
 async update(data){for(const[k,v]of Object.entries(data))setPath(this,k,v);return this;}
 async updateEmbeddedDocuments(type,updates){for(const data of updates){const i=this.items.get(data._id);await i.update(Object.fromEntries(Object.entries(data).filter(([k])=>k!=='_id')));}return updates;}
 async deleteEmbeddedDocuments(type,ids){this.items=new Collection(...this.items.filter(i=>!ids.includes(i.id)));}
 async createEmbeddedDocuments(type,data){const items=data.map(d=>new MockItem(d));items.forEach(i=>{i.parent=this;this.items.push(i);});return items;}
}
export class MockCombat {
 constructor(data={}){Object.assign(this,{id:'c'+(++serial),round:0,turn:null,flags:{},combatants:new Collection()},data);}
 get turns(){return [...this.combatants].sort((a,b)=>(b.initiative??0)-(a.initiative??0));}
 get started(){return this.round>0;}
 getFlag(ns,key){return this.flags[ns]?.[key];}
 async update(data){for(const [key,value]of Object.entries(data))setPath(this,key,value);return this;}
 async activate(){game.combat=this;return this;}
 _sortCombatants(a,b){return (b.initiative??0)-(a.initiative??0);}
 async nextTurn(){if(this.turn!==null&&this.turn>=this.turns.length-1)return this.nextRound();return this.update({turn:(this.turn??-1)+1});}
 async nextRound(){return this.update({round:this.round+1,turn:0});}
 async previousTurn(){if((this.turn??0)<=0)return this.previousRound();return this.update({turn:this.turn-1});}
 async previousRound(){return this.update({round:Math.max(1,this.round-1),turn:0});}
 async rollInitiative(ids,options={}){this.lastInitiativeOptions=options;await this.updateEmbeddedDocuments('Combatant',ids.map((id,n)=>({_id:id,initiative:20-n})));return this;}
 async createEmbeddedDocuments(_type,docs){const created=docs.map(d=>({...d,id:'cb'+(++serial),actor:game.actors.get(d.actorId)}));this.combatants.push(...created);return created;}
 async deleteEmbeddedDocuments(_type,ids){this.combatants=new Collection(...this.combatants.filter(c=>!ids.includes(c.id)));}
 async updateEmbeddedDocuments(_type,updates){for(const u of updates)Object.assign(this.combatants.get(u._id),u);return updates;}
 async endCombat(){if(this.cancelEnd)return undefined;game.combats.splice(game.combats.indexOf(this),1);game.combat=null;return this;}
 static async create(data){const combat=new this(data);game.combats.push(combat);game.combat=combat;return combat;}
}
export async function setup() {
 const settings=new Map([[ID+'.battle',{active:false,round:0,phase:'set',actors:[],maps:[],markers:[],charged:[]}]]);
 globalThis.foundry={documents:{Combat:MockCombat},utils:{deepClone:structuredClone,randomID:()=>String(++serial)},applications:{api:{DialogV2:{wait:async config=>{
  const match=config.content.match(/<option value="([^"]+)"/);return match?.[1]??null;
 }}}}};
 globalThis.canvas={scene:null};
 globalThis.CONFIG={Combat:{documentClass:MockCombat}};
 globalThis.game={combats:new Collection(),combat:null,actors:new Collection(),items:new Collection(),messages:new Collection(),users:new Collection(),
  i18n:{localize:key=>key},settings:{get:(ns,key)=>structuredClone(settings.get(ns+'.'+key)),set:async(ns,key,v)=>{settings.set(ns+'.'+key,structuredClone(v));return v;}}};
 const gm={id:'gm',name:'GM',isGM:true,active:true};game.user=gm;game.users.push(gm);
 globalThis.ChatMessage={getSpeaker:({actor}={})=>({actor:actor?.id}),create:async data=>{
  const message={id:'m'+(++serial),...structuredClone({...data,rolls:undefined}),rolls:data.rolls??[],getFlag(ns,key){return this.flags?.[ns]?.[key];},async update(changes){for(const[k,v]of Object.entries(changes)){if(k==='rolls')this.rolls=v;else setPath(this,k,v);}return this;}};
  game.messages.push(message);return message;
 }};
 const queue=[];
 globalThis.Roll=class {
  constructor(formula){this.formula=formula;this.dice=[];}
  async evaluate(){const n=Number(this.formula.match(/^\d+/)[0]),values=queue.shift()??Array(n).fill(4);if(values.length!==n)throw Error(`Rigged dice mismatch ${this.formula}: ${values}`);this.dice=[{results:values.map(result=>({result,active:true}))}];return this;}
 };
 globalThis.fetch=async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(new URL('../'+url.replace('systems/stellaknights/',''),import.meta.url)))});
 await loadCatalog();
 const knight=new MockActor('knight'),ally=new MockActor('ally'),enemy=new MockActor('enemy','embraced');
 game.actors.push(knight,ally,enemy);for(const a of game.actors){a.items=new Collection(...[skills[0],...skills.filter(s=>['Rose','Black'].includes(s.group)).slice(0,5)].map((r,i)=>new MockItem(skillDocument(r,i+1))),...crestDocuments(skills).filter(d=>["Black","Rose"].includes(d.name)).map(d=>new MockItem(d)));for(const item of a.items)item.parent=a;}
 const stage=new MockActor('stage','stage',{key:'none',setText:'',routines:[],omen:0});stage.items=new Collection();game.actors.push(stage);
 canvas.scene={id:'scene',tokens:[{id:'stage-token',actorId:stage.id}]};
 const actors=[enemy.id,knight.id,ally.id];
 await game.settings.set(ID,'battle',{active:true,round:1,phase:'actions',actors,turn:1,stage:'ragnarok',omenIndex:0,omen:null,pending:null,charged:[],maps:[],markers:[],damage:{},decisive:[],supported:[]});
 return {gm,knight,ally,enemy,stage,rig:values=>queue.push(values),settings};
}
export function user(id){return {id,isGM:false,active:true,name:id};}
export function flags(message){return message.getFlag(ID,'check');}
export const getState=battleState;

export function testStage(key='none') {
 const actor=game.actors.get('stage');const record=JSON.parse(fs.readFileSync(new URL('../data/stages.json',import.meta.url))).find(s=>s.id===key);
 Object.assign(actor.system,{key,setText:record?.setText??'',routines:structuredClone(record?.actions??[]),omen:0});return actor.id;
}
