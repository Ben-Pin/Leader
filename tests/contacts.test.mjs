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
    assert.deepEqual(migrated.contacts.map(({id,...c})=>c),[{name:before.contactName,role:'',email:before.email,status:'active'}]);
    assert.deepEqual(store.getCard(empty.id).contacts,[]);
    store.close();store=createStore({path,seed:false});
    assert.deepEqual(store.getCard(before.id),migrated);
    const oldBundle=store.exportData();oldBundle.cards.forEach(c=>delete c.contacts);
    const imported=createStore({path:':memory:',seed:false});
    try {imported.importData(oldBundle);assert.equal(imported.getCard(before.id).contacts[0].email,before.email);}finally{imported.close();}
  }finally{store?.close();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));assert.ok(directory.includes('leader-contacts-v7-'));rmSync(directory,{recursive:true,force:true});}
});

test('contact statuses and required history participants preserve snapshots and old history', () => {
  const store=createStore({path:':memory:',seed:false});
  const restored=createStore({path:':memory:',seed:false});
  try {
    const listId=store.createList({name:'Contacts and history'}).id;
    let card=store.createCard({title:'History fixture',listId,contacts:[{name:'Buyer'},{name:'Engineer',status:'useful'}]});
    assert.equal(card.contacts[0].status,'active');
    for(const status of ['main','inactive','disturbing','useful','decisions','active']) {
      card=store.updateCard(card.id,{version:card.version,contacts:card.contacts.map((c,i)=>i ? c : {...c,status})});
      assert.equal(card.contacts[0].status,status);
    }
    assert.throws(()=>store.updateCard(card.id,{version:card.version,contacts:[{name:'Wrong',status:'unknown'}]}));
    const another=store.createCard({title:'Another fixture',listId,contacts:[{name:'Other'}]});
    for(const contactIds of [undefined,[],['missing'],[another.contacts[0].id]]) {
      assert.throws(()=>store.addComment(card.id,{version:card.version,text:'Should not save',contactIds}));
      assert.deepEqual(store.getCard(card.id),card);
    }
    const participants=card.contacts;
    card=store.addComment(card.id,{version:card.version,text:'Joint meeting',contactIds:participants.map(c=>c.id)});
    assert.deepEqual(card.activity[0].contacts,participants);
    card=store.updateCard(card.id,{version:card.version,contacts:[]});
    assert.deepEqual(card.activity[0].contacts,participants,'removing a contact must not erase who attended');
    restored.importData(store.exportData());
    assert.deepEqual(restored.getCard(card.id),card);
  }finally{store.close();restored.close();}
});

test('v7 migration preserves all card fields and old unlinked activity', () => {
  const directory=mkdtempSync(join(tmpdir(),'leader-history-v8-'));
  const path=join(directory,'fixture.sqlite');let store=createStore({path,seed:false});
  try {
    const listId=store.createList({name:'Legacy history'}).id;
    const before=store.createCard({title:'Legacy fields',listId,country:'Germany',secondaryCountry:'Japan',status:'proposal',priority:3,lastContact:'2025-12-09',dueDate:'2026-10-20',description:'Keep description',contactName:'Legacy person',email:'legacy@demo.example',checklist:[{text:'Keep next step'}]});
    store.close();store=null;
    const legacy=new DatabaseSync(path);
    legacy.exec("ALTER TABLE activity DROP COLUMN contacts; PRAGMA user_version=7;");
    legacy.prepare('UPDATE cards SET contacts=? WHERE id=?').run(JSON.stringify(before.contacts.map(({status,...c})=>c)),before.id);
    legacy.prepare('INSERT INTO activity(id,card_id,text,created_at) VALUES(?,?,?,?)').run('old-note',before.id,'Existing history',before.createdAt);legacy.close();
    store=createStore({path,seed:false});
    const after=store.getCard(before.id);
    const {activity,...other}=after;const {activity:oldActivity,...oldOther}=before;
    assert.deepEqual(other,oldOther);
    assert.equal(activity[0].text,'Existing history');assert.deepEqual(activity[0].contacts,[]);
    store.close();store=createStore({path,seed:false});assert.deepEqual(store.getCard(before.id),after);
  }finally{store?.close();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));assert.ok(directory.includes('leader-history-v8-'));rmSync(directory,{recursive:true,force:true});}
});
