import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createStore } from '../server/store.mjs';

test('multiple contacts persist, search, export, validate and retain legacy compatibility', () => {
  const store=createStore({path:':memory:',seed:false});
  const restored=createStore({path:':memory:',seed:false});
  try {
    const listId=store.createList({name:'Fictional contacts'}).id;
    let card=store.createCard({title:'Fixture',listId,country:'Germany',contactName:'Original',email:'old@demo.example'});
    assert.equal(card.contacts[0].name,'Original');
    card=store.updateCard(card.id,{version:card.version,contacts:[{...card.contacts[0],role:'Director'},{name:'Мария',role:'Инженер 50%_test',email:'second@demo.example'}]});
    for(const q of ['мария','инженер','second@demo.example','50%_test']) {
      assert.equal(store.listCards({q}).total,1);
      assert.equal(store.geography({q}).total,1);
    }
    const before=store.getCard(card.id);
    assert.throws(()=>store.updateCard(card.id,{version:card.version,title:'Do not persist',contacts:[{email:'invalid'}]}));
    assert.throws(()=>store.updateCard(card.id,{version:card.version,contacts:[{id:'duplicate',name:'A'},{id:'duplicate',name:'B'}]}));
    assert.throws(()=>store.updateCard(card.id,{version:card.version,contacts:Array.from({length:101},()=>({name:'A'}))}));
    assert.deepEqual(store.getCard(card.id),before);
    card=store.updateCard(card.id,{version:card.version,contactName:'Changed primary'});
    assert.equal(card.contacts[0].role,'Director');
    assert.equal(card.contacts[1].email,'second@demo.example');
    assert.throws(()=>store.updateCard(card.id,{version:before.version,contacts:[]}),e=>e.code==='VERSION_CONFLICT');
    restored.importData(store.exportData());
    assert.deepEqual(restored.getCard(card.id),card);
    card=store.updateCard(card.id,{version:card.version,contacts:[card.contacts[1]]});
    assert.equal(card.contactName,'Мария');
    assert.equal(card.email,'second@demo.example');
    card=store.updateCard(card.id,{version:card.version,contacts:[]});
    assert.equal(card.contactName,'');assert.equal(card.email,'');assert.deepEqual(card.contacts,[]);
  }finally{store.close();restored.close();}
});

test('v6 contact migration preserves revisions and timestamps and is repeatable', () => {
  const directory=mkdtempSync(join(tmpdir(),'leader-contacts-v7-'));
  const path=join(directory,'fixture.sqlite');
  let store=createStore({path,seed:false});
  try {
    const listId=store.createList({name:'Migration fixture'}).id;
    const before=store.createCard({title:'Legacy',listId,contactName:'Legacy person',email:'legacy@demo.example'});
    const empty=store.createCard({title:'No contacts',listId});
    store.close();store=null;
    const legacy=new DatabaseSync(path);
    legacy.exec('ALTER TABLE cards DROP COLUMN contacts; PRAGMA user_version=6;');legacy.close();
    store=createStore({path,seed:false});
    const migrated=store.getCard(before.id);
    assert.equal(migrated.version,before.version);assert.equal(migrated.updatedAt,before.updatedAt);
    assert.deepEqual(migrated.contacts.map(({id,...c})=>c),[{name:before.contactName,role:'',email:before.email}]);
    assert.deepEqual(store.getCard(empty.id).contacts,[]);
    store.close();store=createStore({path,seed:false});
    assert.deepEqual(store.getCard(before.id),migrated);
    const oldBundle=store.exportData();oldBundle.cards.forEach(c=>delete c.contacts);
    const imported=createStore({path:':memory:',seed:false});
    try {imported.importData(oldBundle);assert.equal(imported.getCard(before.id).contacts[0].email,before.email);}finally{imported.close();}
  }finally{store?.close();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));assert.ok(directory.includes('leader-contacts-v7-'));rmSync(directory,{recursive:true,force:true});}
});
