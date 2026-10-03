import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import Handlebars from 'handlebars';
const manifest=JSON.parse(fs.readFileSync('system.json'));
if(manifest.id!=='stellaknights'||manifest.compatibility.minimum!=='14')throw Error('Invalid manifest');
for(const file of [...manifest.esmodules,...manifest.styles,...manifest.languages.map(l=>l.path),manifest.license])if(!fs.existsSync(file))throw Error('Missing '+file);
for(const file of fs.readdirSync('module').filter(f=>f.endsWith('.js'))){
 execFileSync(process.execPath,['--check',path.join('module',file)]);
 const text=fs.readFileSync(path.join('module',file),'utf8');
 for(const match of text.matchAll(/from\s+['"](\.\/[^'"]+)['"]/g))if(!fs.existsSync(path.join('module',match[1])))throw Error('Missing import '+match[1]);
}
for(const file of fs.readdirSync('templates')){Handlebars.precompile(fs.readFileSync(path.join('templates',file),'utf8'));}
for(const file of [...fs.readdirSync('lang').map(f=>'lang/'+f),...fs.readdirSync('data').map(f=>'data/'+f),'template.json'])JSON.parse(fs.readFileSync(file));
const skills=JSON.parse(fs.readFileSync('data/skills.json'));
const engine=fs.readFileSync('module/skills-engine.js','utf8');
if(new Set(skills.map(s=>s.id)).size!==skills.length)throw Error('Duplicate catalog keys');
for(const skill of skills)if(!engine.includes(`case "${skill.id}"`))throw Error('Missing handler '+skill.id);
console.log('Manifest, module syntax/imports, templates, JSON and all '+skills.length+' skill handlers OK.');
