import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createStore } from '../server/store.mjs';

test('v5 flags migrate without losing card revisions, comments or activation dates', () => {
  const directory=mkdtempSync(join(tmpdir(),'leader-flags-v6-'));
  const path=join(directory,'fixture.sqlite');
  let store=createStore({path,seed:false});
  try {
    const listId=store.createList({name:'Fictional migration fixture'}).id;
    const before=store.createCard({title:'Migration fixture',listId,country:'Germany',flags:{inQuote:{active:true,comment:'Keep quote'},administrativeIssue:{active:false,comment:'Keep resolved note'}}});
    store.close();store=null;
    const legacy=new DatabaseSync(path);
    legacy.exec(`BEGIN;
      CREATE TABLE legacy_flags(card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,kind TEXT NOT NULL CHECK(kind IN ('inQuote','logisticsIssue','administrativeIssue')),active INTEGER NOT NULL CHECK(active IN (0,1)),comment TEXT NOT NULL DEFAULT '',activated_at TEXT,PRIMARY KEY(card_id,kind));
      INSERT INTO legacy_flags SELECT * FROM card_flags;
      DROP TABLE card_flags; ALTER TABLE legacy_flags RENAME TO card_flags;
      CREATE INDEX idx_flags_active ON card_flags(kind,active,card_id);
      PRAGMA user_version=5; COMMIT;`);
    legacy.close();
    store=createStore({path,seed:false});
    assert.deepEqual(store.getCard(before.id),before);
    let card=store.updateCard(before.id,{version:before.version,flags:{swIssue:{active:true,comment:'Kernel regression'},hwIssue:{active:true,comment:'Connector failure'}}});
    assert.equal(card.flags.inQuote.comment,'Keep quote');
    for(const kind of ['swIssue','hwIssue']) {
      assert.equal(store.listCards({view:kind}).total,1);
      assert.equal(store.bootstrap().stats[kind],1);
      assert.equal(store.geography({view:kind}).total,1);
      assert.ok(card.flags[kind].activatedAt);
    }
    const activated=card.flags.swIssue.activatedAt;
    card=store.updateCard(card.id,{version:card.version,flags:{swIssue:{active:false,comment:card.flags.swIssue.comment}}});
    assert.equal(store.listCards({view:'swIssue'}).total,0);
    assert.equal(store.listCards({view:'hwIssue'}).total,1);
    assert.equal(card.flags.swIssue.comment,'Kernel regression');
    assert.equal(card.flags.swIssue.activatedAt,activated);
    assert.throws(()=>store.updateCard(card.id,{version:before.version,flags:{hwIssue:{active:false}}}),e=>e.code==='VERSION_CONFLICT');
    const restored=createStore({path:':memory:',seed:false});
    try { restored.importData(store.exportData()); assert.deepEqual(restored.getCard(card.id),card); } finally {restored.close();}
    store.close();store=createStore({path,seed:false});
    assert.deepEqual(store.getCard(card.id),card);
    const check=new DatabaseSync(path,{readOnly:true});
    try {assert.equal(check.prepare('PRAGMA user_version').get().user_version,6);assert.deepEqual(check.prepare('PRAGMA foreign_key_check').all(),[]);}finally{check.close();}
  } finally {store?.close();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));assert.ok(directory.includes('leader-flags-v6-'));rmSync(directory,{recursive:true,force:true});}
});
