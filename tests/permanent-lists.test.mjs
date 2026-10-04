import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createStore } from '../server/store.mjs';

const names = ['Leads','Prospects','Opportunities','Customers','Partners','Agents'];
test('v10 migrates to six permanent lists preserving card identities, relations and history', () => {
  const directory = mkdtempSync(join(tmpdir(), 'leader-six-lists-'));
  const path = join(directory, 'test.sqlite');
  let store = createStore({path,seed:false});
  try {
    const ids = Object.fromEntries(['Customers','Prospects','Partners','Distributors'].map(name => [name,store.createList({name}).id]));
    const agent = store.createCard({title:'Fictional agent',listId:ids.Distributors,accountType:'distributor'});
    let customer = store.createCard({title:'Fictional customer',listId:ids.Customers,accountType:'client',distributorIds:[agent.id],contacts:[{name:'Buyer',email:'buyer@demo.example'}],lastContact:'2026-09-30',flags:{swIssue:{active:true,comment:'Preserve this'}}});
    customer = store.addComment(customer.id,{version:customer.version,text:'Preserve discussion',contactIds:[customer.contacts[0].id]});
    store.close(); store=null;
    const old = new DatabaseSync(path);
    old.exec(`BEGIN;
      ALTER TABLE cards DROP COLUMN account_type;
      ALTER TABLE cards RENAME COLUMN legacy_account_type TO account_type;
      ALTER TABLE cards DROP COLUMN status;
      ALTER TABLE cards RENAME COLUMN legacy_status TO status;
      UPDATE cards SET account_type=CASE list_id WHEN '${ids.Customers}' THEN 'client' WHEN '${ids.Distributors}' THEN 'distributor' ELSE 'unspecified' END;
      CREATE TABLE activity_old(id TEXT PRIMARY KEY,card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,text TEXT NOT NULL,created_at TEXT NOT NULL,contacts TEXT NOT NULL DEFAULT '[]',kind TEXT NOT NULL DEFAULT 'note' CHECK(kind IN ('note','flag')));
      INSERT INTO activity_old SELECT * FROM activity; DROP TABLE activity; ALTER TABLE activity_old RENAME TO activity;
      PRAGMA user_version=10; COMMIT;`);
    old.close();
    store=createStore({path,seed:false});
    assert.deepEqual(store.bootstrap().lists.map(list=>list.name),names);
    assert.equal(store.bootstrap().lists.find(list=>list.name==='Agents').id,ids.Distributors);
    assert.deepEqual(store.getCard(customer.id),customer);
    const schemaCheck=new DatabaseSync(path,{readOnly:true});
    assert.equal(schemaCheck.prepare('PRAGMA user_version').get().user_version,12);schemaCheck.close();
    assert.equal(store.getCard(agent.id).clientCount,1);
    for(const list of store.bootstrap().lists) assert.throws(()=>store.deleteList(list.id),e=>e.code==='PERMANENT_LIST');
    const snapshot=store.exportData(); store.close();store=createStore({path,seed:false});
    assert.deepEqual(store.exportData(),snapshot);
    const check=new DatabaseSync(path,{readOnly:true});
    assert.deepEqual(check.prepare('PRAGMA foreign_key_check').all(),[]);check.close();
  } finally {store?.close();rmSync(directory,{recursive:true,force:true});}
});

test('five project stages are independent of list membership; priority and stage filters share geography and pagination', () => {
  const store=createStore({path:':memory:',seed:false});
  try {
    store.ensurePermanentLists();
    const listId=store.bootstrap().lists.find(list=>list.name==='Customers').id;
    for(const [index,status] of ['contact','evaluation','rampUp','massProduction','legacy'].entries()) {
      const card=store.createCard({title:`Fixture ${index}`,listId,status,priority:index%4,country:'Germany'});
      assert.equal(card.status,status);assert.equal(card.accountType,'client');
    }
    const page=store.listCards({sort:'priority',limit:2});
    assert.deepEqual(page.items.map(card=>card.priority),[3,2]);
    assert.equal(store.listCards({sort:'priority',limit:2,offset:2}).items[0].priority,1);
    for(const query of [{priority:0},{priority:'3',status:'massProduction'},{status:'legacy',listId},{status:'evaluation',priority:1},{status:'evaluation',priority:3}]) {
      const cards=store.listCards(query);
      assert.equal(store.geography(query).total,cards.total);
      assert.ok(cards.items.every(card=>query.priority===undefined||card.priority===Number(query.priority)));
      assert.ok(cards.items.every(card=>!query.status||card.status===query.status));
    }
    const card=store.listCards({status:'contact'}).items[0];
    const updated=store.updateCard(card.id,{version:card.version,status:'massProduction'});
    assert.equal(updated.listId,card.listId);assert.equal(updated.activity.length,0);
    assert.equal(store.createCard({title:'Old client export',listId,status:'client'}).status,'contact');
    assert.equal(store.createCard({title:'Old proposal export',listId,status:'proposal'}).status,'evaluation');
    for(const query of [{priority:'NaN'},{priority:4},{priority:false},{priority:-1},{status:'unknown'}]) {
      assert.throws(()=>store.listCards(query));assert.throws(()=>store.geography(query));
    }
  } finally {store.close();}
});

test('list and category changes record every transition atomically and survive portable export', () => {
  const store=createStore({path:':memory:',seed:false});
  const restored=createStore({path:':memory:',seed:false});
  try {
    store.ensurePermanentLists();
    const ids=Object.fromEntries(store.bootstrap().lists.map(list=>[list.name,list.id]));
    let card=store.createCard({title:'Fictional lead',listId:ids.Leads});
    assert.equal(card.accountType,'lead');
    card=store.updateCard(card.id,{version:card.version,accountType:'opportunity'});
    assert.equal(card.listId,ids.Opportunities);
    assert.equal(card.activity[0].text,'Leads → Opportunities');
    assert.equal(store.listCards({accountType:'opportunity'}).total,1);
    card=store.updateCard(card.id,{version:card.version,listId:ids.Customers});
    assert.equal(card.accountType,'client');
    const events=[{fromListId:ids.Customers,toListId:ids.Partners,happenedAt:'2026-10-04T10:00:00.000Z'},{fromListId:ids.Partners,toListId:ids.Agents,happenedAt:'2026-10-04T10:01:00.000Z'},{fromListId:ids.Agents,toListId:ids.Customers,happenedAt:'2026-10-04T10:02:00.000Z'}];
    card=store.updateCard(card.id,{version:card.version,listId:ids.Customers,listEvents:events});
    assert.equal(card.activity.length,5);
    assert.ok(card.activity.some(item=>item.kind==='list'&&item.text==='Partners → Agents'&&item.createdAt===events[1].happenedAt));
    assert.throws(()=>store.updateCard(card.id,{version:card.version,listId:ids.Leads,listEvents:events}));
    assert.deepEqual(store.getCard(card.id),card);
    assert.throws(()=>store.updateCard(card.id,{version:1,listId:ids.Leads}),e=>e.code==='VERSION_CONFLICT');
    card=store.updateCard(card.id,{version:card.version,priority:3,listEvents:[]});
    assert.equal(card.activity.length,5);
    restored.importData(store.exportData());
    assert.deepEqual(restored.getCard(card.id),card);
    const imported=createStore({path:':memory:',seed:false});
    try {imported.ensurePermanentLists();imported.importList({bundle:{format:'leader-list',version:1,cards:[card]},mode:'preserve'});assert.deepEqual(imported.getCard(card.id).activity,card.activity);}finally{imported.close();}
    const custom=store.createList({name:'Custom queue'});
    card=store.updateCard(card.id,{version:card.version,listId:custom.id,accountType:'partner',listEvents:[{fromListId:ids.Customers,toListId:ids.Partners,happenedAt:'2026-10-04T11:00:00Z'},{fromListId:ids.Partners,toListId:custom.id,happenedAt:'2026-10-04T11:01:00Z'}]});
    assert.equal(card.listId,custom.id);assert.equal(card.accountType,'partner');
    const before=card;
    assert.throws(()=>store.updateCard(card.id,{version:card.version,listId:ids.Leads,accountType:'client'}));
    assert.deepEqual(store.getCard(card.id),before);
  } finally {store.close();restored.close();}
});
