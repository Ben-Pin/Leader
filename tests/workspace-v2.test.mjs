import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve,sep } from 'node:path';
import { createStore } from '../server/store.mjs';
import { createCompanyManager } from '../server/companies.mjs';

test('flag and star activation dates are independent of contact dates, stable on edits, portable',async()=>{
  const db=createStore({path:':memory:',seed:false}),restored=createStore({path:':memory:',seed:false});
  try{
    const listId=db.createList({name:'Test'}).id;
    let c=db.createCard({title:'Alpha',listId,lastContact:'2024-01-02',flags:{inQuote:{active:true,comment:'Quote 47'}}});
    const first=c.flags.inQuote.activatedAt;assert.ok(first);assert.equal(c.starredAt,null);
    assert.equal(db.bootstrap().stats.active,1);
    c=db.updateCard(c.id,{version:c.version,flags:{inQuote:{active:true,comment:'Revised quote'}}});
    assert.equal(c.flags.inQuote.activatedAt,first);
    c=db.updateCard(c.id,{version:c.version,starred:true});assert.ok(c.starredAt);const starDate=c.starredAt;
    c=db.updateCard(c.id,{version:c.version,title:'Beta',starred:true});assert.equal(c.starredAt,starDate);
    c=db.updateCard(c.id,{version:c.version,flags:{inQuote:{active:false,comment:'Accepted'}}});assert.equal(db.bootstrap().stats.active,0);
    await new Promise(r=>setTimeout(r,5));
    c=db.updateCard(c.id,{version:c.version,flags:{inQuote:{active:true,comment:'Second quote'}}});assert.ok(c.flags.inQuote.activatedAt>first);assert.equal(c.lastContact,'2024-01-02');
    restored.importData(db.exportData());assert.deepEqual(restored.getCard(c.id),c);
  }finally{db.close();restored.close();}
});
test('two countries, tag/comment search, Z-A, pagination and geography count cards once per country',()=>{
  const db=createStore({path:':memory:',seed:false});try{
    const listId=db.createList({name:'Test'}).id,tagId=db.createTag({name:'Microcontrollers'}).id;
    const a=db.createCard({title:'Alpha',listId,country:'Germany',secondaryCountry:'Japan',tagIds:[tagId],flags:{logisticsIssue:{active:true,comment:'Tracking XYZ'}}});
    db.createCard({title:'Zulu',listId,country:'Germany',secondaryCountry:'Germany'});
    assert.equal(db.listCards({country:'Japan'}).items[0].id,a.id);
    for(const q of ['Japan','microcontrollers','tracking xyz'])assert.equal(db.listCards({q}).total,1);
    assert.equal(db.listCards({q:'  Alpha  '}).total,1);
    assert.equal(db.listCards({sort:'titleDesc',limit:1}).items[0].title,'Zulu');
    assert.equal(db.listCards({sort:'titleDesc',limit:1,offset:1}).items[0].title,'Alpha');
    assert.deepEqual(db.geography().countries.map(c=>[c.country,c.count]),[['Germany',2],['Japan',1]]);
    db.updateCard(a.id,{version:a.version,archived:true});assert.deepEqual(db.geography().countries.map(c=>[c.country,c.count]),[['Germany',1]]);
  }finally{db.close();}
});
test('disconnect is recoverable across restart and never deletes a company database',()=>{
  const directory=mkdtempSync(join(tmpdir(),'leader-disconnect-test-'));let manager=createCompanyManager({directory,seed:false});
  try{
    const companyId=manager.createCompany({name:'Disconnect fixture'}).id;
    const db=manager.getStore(companyId);const card=db.createCard({title:'Preserved',listId:db.bootstrap().lists[0].id});
    manager.disconnectCompany(companyId);assert.equal(manager.listCompanies().some(c=>c.id===companyId),false);assert.throws(()=>manager.getStore(companyId));
    manager.close();manager=createCompanyManager({directory,seed:false});assert.equal(manager.listCompanies().some(c=>c.id===companyId),false);
    manager.reconnectCompany(companyId);assert.equal(manager.getStore(companyId).getCard(card.id).title,'Preserved');
    manager.disconnectCompany('demo');assert.throws(()=>manager.disconnectCompany(companyId));
  }finally{manager.close();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));assert.ok(directory.includes('leader-disconnect-test-'));rmSync(directory,{recursive:true,force:true});}
});
