import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {ClassicLevel} from 'classic-level';
import {skillDocument} from '../module/library.js';
test('Shipped LevelDB compendiums contain all 54 Skills and 13 Parents with valid folders',async()=>{
 const manifest=JSON.parse(await fs.readFile('system.json','utf8')),catalog=JSON.parse(await fs.readFile('data/skills.json','utf8'));
 const all=[],counts=[];const temp=await fs.mkdtemp(path.join(os.tmpdir(),'stella-packs-'));
 try{
  for(const pack of manifest.packs.filter(p=>p.type==='Item')){
   const destination=path.join(temp,pack.name);await fs.cp(pack.path,destination,{recursive:true});
   const db=new ClassicLevel(destination,{keyEncoding:'utf8',valueEncoding:'utf8'});
   try{
    const entries=await db.iterator().all(),items=entries.filter(([key])=>key.startsWith('!items!')).map(([,v])=>JSON.parse(v));
    const folders=new Set(entries.filter(([key])=>key.startsWith('!folders!')).map(([,v])=>JSON.parse(v)._id));
    for(const item of items){assert.match(item._id,/^[a-zA-Z0-9]{16}$/);assert.ok(folders.has(item.folder));}
    const expected=pack.name.startsWith('color')?'color':pack.name.startsWith('flower')?'flower':'';
    for(const item of items.filter(i=>i.type==='ability'))assert.equal(item.system.parentType,expected);
    counts.push(items.filter(i=>i.type==='ability').length);all.push(...items);
   }finally{await db.close();}
  }
  assert.deepEqual(counts,[25,28,1]);assert.equal(all.filter(i=>i.type!=='ability').length,13);
  for(const record of catalog){const item=all.find(i=>i.type==='ability'&&i.system.key===record.id);assert.ok(item);assert.deepEqual(item.system,skillDocument(record).system);}
  for(const parent of all.filter(i=>i.type!=='ability'))for(const key of parent.system.skillKeys)assert.ok(all.some(i=>i.system.key===key&&i.system.parentKey===parent.system.key));
 }finally{await fs.rm(temp,{recursive:true,force:true});}
});

test('Stage Actor compendium ships seven Stages with matching Set/Omen Skill Items',async()=>{
 const manifest=JSON.parse(await fs.readFile('system.json','utf8')),pack=manifest.packs.find(p=>p.name==='stages');assert.equal(pack.type,'Actor');
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'stella-stages-'));await fs.cp(pack.path,path.join(temp,'pack'),{recursive:true});
 const db=new ClassicLevel(path.join(temp,'pack'),{keyEncoding:'utf8',valueEncoding:'utf8'});
 try{const entries=await db.iterator().all();const actors=entries.filter(([key])=>key.startsWith('!actors!')).map(([,v])=>JSON.parse(v));assert.equal(actors.length,7);
 for(const actor of actors){assert.equal(actor.type,'stage');assert.ok(actor.system.setText);assert.equal(actor.items.length,actor.system.routines.length+1);assert.ok(actor.items.every(i=>i.type==='ability'));}}
 finally{await db.close();await fs.rm(temp,{recursive:true,force:true});}
});
