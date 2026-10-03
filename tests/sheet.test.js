import test from 'node:test';
import assert from 'node:assert/strict';
import {slotUpdates} from '../module/loadout.js';
class Base {async _prepareContext(){return {};}async _renderHTML(){return 'html';}_onRender(){} async render(){this.renders=(this.renders??0)+1;}}
globalThis.foundry={applications:{api:{HandlebarsApplicationMixin:B=>B},sheets:{ActorSheetV2:Base,ItemSheetV2:Base},apps:{FilePicker:{implementation:class {constructor(options){globalThis.picker=options;}browse(){globalThis.browsed=true;}}}}}};
let active=false;
globalThis.game={user:{isGM:true},settings:{get:()=>({active})},modules:new Map()};
globalThis.ui={notifications:{error:message=>{throw Error(message);}}};
const {StellaActorSheet}=await import('../module/actor-sheet.js');
const {StellaItemSheet}=await import('../module/item-sheet.js');
function fixture(){
  active=false;
  const items=[{id:'basic',type:'ability',system:{key:'knights-etiquette',number:1,charge:2}}, {id:'a',type:'ability',system:{key:'rose',number:2,charge:1}}, {id:'b',type:'ability',system:{key:'blue',number:3,charge:0}}];
  items.get=id=>items.find(i=>i.id===id);
  const actor={items,created:0,updates:[],async createEmbeddedDocuments(_type,docs){return docs.map(data=>{const i={...data,id:'copy'+(++this.created),parent:this};items.push(i);return i;});},async updateEmbeddedDocuments(_type,updates){this.updates.push(...updates);for(const u of updates)items.get(u._id).system.number=u['system.number'];}};
  for(const item of items){item.parent=actor;item.isOwner=true;}
  const sheet=new StellaActorSheet();Object.assign(sheet,{actor,isEditable:true,editMode:true});
  return {sheet,actor,items};
}
test('Dragging an owned Skill swaps numbered slots without duplicating Items or changing dice',async()=>{
  const {sheet,actor,items}=fixture();await sheet.dropSkill(items.get('a'),3);
  assert.equal(items.get('a').system.number,3);assert.equal(items.get('b').system.number,2);
  assert.equal(items.get('a').system.charge,1);assert.equal(actor.created,0);
});
test('External Skill drop copies once; repeated catalog drop reuses the owned Item and displaces to reserve',async()=>{
  const {sheet,actor,items}=fixture();
  const source={id:'world',type:'ability',isOwner:false,testUserPermission:()=>true,system:{key:'new',number:5,charge:8},toObject(){return {_id:this.id,type:this.type,system:{...this.system}};}};
  await sheet.dropSkill(source,2);await sheet.dropSkill(source,4);
  assert.equal(actor.created,1);assert.equal(items.get('a').system.number,0);
  assert.equal(items.get('copy1').system.number,4);assert.equal(items.get('copy1').system.charge,0);
});
test('Invalid, unreadable, Play-mode, read-only and in-battle drops do not create Items',async()=>{
  const {sheet,actor}=fixture();const source={id:'world',type:'ability',isOwner:true,system:{key:'new',number:0}};
  await assert.rejects(sheet.dropSkill(source,1),/Knight/);
  await assert.rejects(sheet.dropSkill({...source,isOwner:false,testUserPermission:()=>false},2),/cannot read/);
  sheet.editMode=false;await assert.rejects(sheet.dropSkill(source,2),/Edit/);sheet.editMode=true;
  sheet.isEditable=false;await assert.rejects(sheet.dropSkill(source,2),/Edit/);sheet.isEditable=true;
  active=true;await assert.rejects(sheet.dropSkill(source,2),/battle/);assert.equal(actor.created,0);
});
test('Basic slot cannot be moved; a reserve Skill replaces an occupied slot and sends the old Skill to reserve',()=>{
  const {items}=fixture();assert.throws(()=>slotUpdates(items,items.get('basic'),0),/slot 1/);
  assert.throws(()=>slotUpdates(items,items.get('a'),7),/0.*6/);
  assert.deepEqual(slotUpdates(items,{id:'reserve',system:{number:0}},2),[{_id:'reserve','system.number':2},{_id:'a','system.number':0}]);
});
test('Changing Number on an Item sheet uses the same swap operation',async()=>{
  const {actor,items}=fixture();const sheet=new StellaItemSheet();sheet.item=items.get('a');sheet.isEditable=true;
  sheet.item.update=async data=>{actor.lastUpdate=data;};
  await StellaItemSheet.submit.call(sheet,null,null,{object:{'system.number':3,name:'Renamed'}});
  assert.equal(items.get('b').system.number,2);assert.equal(actor.lastUpdate.name,'Renamed');
});
test('Portrait and Token pickers update distinct native Actor paths; Tokenizer receives the Actor',async()=>{
  const {sheet}=fixture();const changes=[];sheet.actor.img='portrait.webp';sheet.actor.prototypeToken={texture:{src:'token.webp'}};sheet.actor.update=async data=>changes.push(data);
  await StellaActorSheet.pickImage.call(sheet,null,{dataset:{action:'portrait'}});assert.equal(picker.current,'portrait.webp');await picker.callback('new-portrait.webp');
  await StellaActorSheet.pickImage.call(sheet,null,{dataset:{action:'token'}});assert.equal(picker.current,'token.webp');await picker.callback('new-token.webp');
  assert.deepEqual(changes,[{img:'new-portrait.webp'},{'prototypeToken.texture.src':'new-token.webp'}]);
  let tokenized;game.modules.set('vtta-tokenizer',{api:{tokenizeActor:actor=>{tokenized=actor;}}});
  await StellaActorSheet.tokenizer.call(sheet);assert.equal(tokenized,sheet.actor);
});
test('Sheet rerenders restore scroll and preserve collapsed sections while Play locks character fields',async()=>{
  const {sheet}=fixture();const inputs=[{name:'name'},{name:'system.hp.value'}];const detail={dataset:{section:'loadout'},open:false,addEventListener(_type,handler){this.toggle=handler;}};
  const root={scrollTop:550,querySelectorAll:selector=>selector==='[name]'?inputs:[detail],addEventListener(){}};
  sheet.element={querySelector:()=>root};await sheet._renderHTML({},{});root.scrollTop=0;sheet.editMode=false;sheet._onRender({},{});
  assert.equal(root.scrollTop,550);detail.toggle();assert.equal(sheet.sections.loadout,false);
  assert.equal(inputs[0].disabled,true);assert.equal(inputs[1].disabled,false);
  await StellaActorSheet.mode.call(sheet);assert.equal(sheet.editMode,true);assert.equal(sheet.renders,1);
});
