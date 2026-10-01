// Disposable, isolated browser-QA workspace. Never targets real company databases.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCompanyManager } from '../server/companies.mjs';
import { createHttpApp } from '../server/http.mjs';
const directory=mkdtempSync(join(tmpdir(),'leader-browser-qa-'));
const companies=createCompanyManager({directory,seed:false});
const db=companies.getStore('demo');const list=db.createList({name:'QA Accounts'});
const tag=db.createTag({name:'iot-gate'});
db.createCard({title:'Alpha — QA fixture',company:'Fictional test company',description:'Browser verification only.',listId:list.id,country:'Germany',secondaryCountry:'Japan',lastContact:'2024-02-09',starred:true,tagIds:[tag.id],flags:{inQuote:{active:true,comment:'Waiting for quote approval'},logisticsIssue:{active:true,comment:'Shipment tracking pending'}}});
db.createCard({title:'Zulu — QA fixture',listId:list.id,country:'United States',lastContact:'2025-06-03'});
const server=createHttpApp({companies}).listen(4178,'127.0.0.1',()=>console.log(JSON.stringify({url:'http://127.0.0.1:4178',directory,pid:process.pid})));
process.on('SIGTERM',()=>server.close(()=>{companies.close();process.exit(0);}));
process.on('SIGINT',()=>server.close(()=>{companies.close();process.exit(0);}));
