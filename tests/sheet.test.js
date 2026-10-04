import test from 'node:test';
import assert from 'node:assert/strict';
import {slotUpdates} from '../module/loadout.js';
class Base {async _prepareContext(){return {};}async _renderHTML(){return 'html';}_onRender(){} _preSyncPartState(_id,_next,prior,state){state.scrollPositions=[['',prior.scrollTop,prior.scrollLeft??0]];} async _postRender(){await Promise.resolve();if(this.resetScrollAfterRender)this.element.querySelector('.stella-content').scrollTop=0;} async render(){this.renders=(this.renders??0)+1;}}
globalThis.foundry={utils:{deepClone:structuredClone},applications:{api:{HandlebarsApplicationMixin:B=>B},sheets:{ActorSheetV2:Base,ItemSheetV2:Base},apps:{FilePicker:{implementation:class {constructor(options){globalThis.picker=options;}browse(){globalThis.browsed=true;}}}}}};
let active=false;
globalThis.game={i18n:{localize:key=>key},user:{isGM:true},settings:{get:()=>({active})},modules:new Map()};
globalThis.ui={notifications:{error:message=>{throw Error(message);}}};
const {StellaActorSheet}=await import('../module/actor-sheet.js');
const {StellaItemSheet}=await import('../module/item-sheet.js');
function fixture(){
  active=false;
  const items=[{id:'basic',type:'ability',system:{key:'knights-etiquette',number:1,charge:2}}, {id:'a',type:'ability',system:{key:'rose',number:2,charge:1}}, {id:'b',type:'ability',system:{key:'blue',number:3,charge:0}}, {id:'color',type:'color',system:{key:'Black',skillKeys:['rose','blue','new'],stats:{hp:16,defense:3,charge:3}}}];
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
  await assert.rejects(sheet.dropSkill({...source,system:{key:'foreign',number:0}},1),/not granted/);
  await assert.rejects(sheet.dropSkill({...source,isOwner:false,testUserPermission:()=>false},2),/cannot read/);
  sheet.editMode=false;await assert.rejects(sheet.dropSkill(source,2),/Edit/);sheet.editMode=true;
  sheet.isEditable=false;await assert.rejects(sheet.dropSkill(source,2),/Edit/);sheet.isEditable=true;
  active=true;await assert.rejects(sheet.dropSkill(source,2),/battle/);assert.equal(actor.created,0);
});
test('Knight’s Etiquette can move to reserve or swap any slot; a reserve Skill displaces to reserve',()=>{
  const {items}=fixture();assert.deepEqual(slotUpdates(items,items.get('basic'),0),[{_id:'basic','system.number':0}]);
  assert.deepEqual(slotUpdates(items,items.get('basic'),2),[{_id:'basic','system.number':2},{_id:'a','system.number':1}]);
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
  sheet.element={querySelector:()=>root};sheet._preSyncPartState('main',{dataset:{}},{...root,dataset:{}},{});root.scrollTop=0;sheet.editMode=false;await sheet._onRender({},{});await sheet._postRender({},{});
  assert.equal(root.scrollTop,550);detail.toggle();assert.equal(sheet.sections.loadout,false);
  assert.equal(inputs[0].disabled,true);assert.equal(inputs[1].disabled,false);
  await StellaActorSheet.mode.call(sheet);assert.equal(sheet.editMode,true);assert.equal(sheet.renders,1);
});

test('Knight’s Etiquette can be dragged out of slot 1 and deleted through the sheet action',async()=>{
  const {sheet,items}=fixture();await sheet.dropSkill(items.get('basic'),2);
  assert.equal(items.get('basic').system.number,2);assert.equal(items.get('a').system.number,1);
  await sheet.dropSkill(items.get('basic'),0);assert.equal(items.get('basic').system.number,0);
  items.get('basic').system.number=1;let deleted=false;items.get('basic').delete=async()=>{deleted=true;};
  foundry.applications.api.DialogV2={confirm:async()=>true};
  await StellaActorSheet.remove.call(sheet,null,{dataset:{item:'basic'}});assert.equal(deleted,true);
});

test('v14 sidebar navigation uses changeTab and expands the sidebar for Combat and Items',async()=>{
 const {openSidebarTab}=await import('../module/helpers.js');const calls=[];
 ui.sidebar={expand:()=>calls.push('expand'),changeTab:(tab,group)=>calls.push([tab,group])};
 openSidebarTab('combat');openSidebarTab('items');
 assert.deepEqual(calls,['expand',['combat','primary'],'expand',['items','primary']]);
});
test('Details and Battle tabs preserve separate scroll positions across rerenders',async()=>{
 const {sheet}=fixture();const root={scrollTop:180,dataset:{activeTab:'details'}};
 sheet.element={querySelector:()=>root};await StellaActorSheet.switchTab.call(sheet,null,{dataset:{tab:'battle'}});
 assert.equal(sheet.activeTab,'battle');const battleState={};sheet._preSyncPartState('main',{dataset:{activeTab:'battle'}},root,battleState);assert.equal(battleState.scrollPositions[0][1],0);
 root.dataset.activeTab='battle';root.scrollTop=300;await StellaActorSheet.switchTab.call(sheet,null,{dataset:{tab:'details'}});
 const detailsState={};sheet._preSyncPartState('main',{dataset:{activeTab:'details'}},root,detailsState);assert.equal(detailsState.scrollPositions[0][1],180);assert.equal(sheet.tabScroll.battle,300);
});

test('Block editor saves typed rows and supports adding, moving and deleting blocks',async()=>{
 const item={type:'ability',system:{number:0,blocks:[]},async update(changes){for(const [key,value]of Object.entries(changes)){if(key==='system.blocks')this.system.blocks=structuredClone(value);}}};
 const sheet={item,isEditable:true};await StellaItemSheet.addBlock.call(sheet);await StellaItemSheet.addBlock.call(sheet);
 await StellaItemSheet.submit.call(sheet,null,null,{object:{'system.blocks.0.op':'damage','system.blocks.0.value':'3','system.blocks.0.face':'2','system.blocks.1.op':'heal'}});
 assert.equal(item.system.blocks[0].op,'damage');assert.equal(item.system.blocks[0].value,3);assert.equal(item.system.blocks[0].face,2);
 await StellaItemSheet.moveBlock.call(sheet,null,{dataset:{index:'0',action:'blockDown'}});assert.equal(item.system.blocks[0].op,'heal');
 await StellaItemSheet.removeBlock.call(sheet,null,{dataset:{index:'1'}});assert.equal(item.system.blocks.length,1);
});
test('Use button forwards only locked Foundry targets without an aim dialog',async()=>{
 const {sheet,actor,items}=fixture();actor.id='hero';const calls=[];
 game.user={id:'gm',isGM:true,active:true,targets:new Set([{actor:{id:'target'}},{actor:{id:'target'}}])};game.users=[game.user];game.socket={on(){},emit(){}};
 const {registerSocket}=await import('../module/socket.js');registerSocket(async(op,data)=>{calls.push({op,data});});
 await StellaActorSheet.use.call(sheet,null,{dataset:{item:items[0].id}});
 assert.equal(calls.length,1);assert.equal(calls[0].op,'use');assert.deepEqual(calls[0].data.targets,['target']);assert.equal(calls[0].data.directUse,true);
 assert.equal(StellaActorSheet.DEFAULT_OPTIONS.actions.charge,undefined);
});


test('Actor, Item and Stage preserve scroll through async render finalization and repeated updates',async()=>{
 const {StageActorSheet}=await import('../module/stage-actor.js');
 for(const Sheet of [StellaActorSheet,StellaItemSheet,StageActorSheet]){
  assert.deepEqual(Sheet.PARTS.main.scrollable,['']);
  const sheet=new Sheet(),root={dataset:{activeTab:'battle'},scrollTop:640,scrollLeft:12};
  sheet.element={querySelector:()=>root};sheet.resetScrollAfterRender=true;
  for(let n=0;n<3;n++){
   const state={};sheet._preSyncPartState('main',root,root,state);
   root.scrollTop=0;root.scrollLeft=0;
   await sheet._postRender({},{});
   assert.equal(root.scrollTop,640);assert.equal(root.scrollLeft,12);
  }
 }
});
