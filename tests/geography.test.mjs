import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createStore } from '../server/store.mjs';
import { createHttpApp } from '../server/http.mjs';

test('geography matches list, flag, tag, quarter, country and search intersections', () => {
  const store = createStore({ path: ':memory:', seed: false });
  try {
    const listId = store.createList({name:'Fictional clients'}).id;
    const otherList = store.createList({name:'Other fictional clients'}).id;
    const tag = store.createTag({name:'IoT'}).id;
    const partner = store.createCard({title:'Demo partner', listId:otherList, country:'Japan', accountType:'partner'});
    const a = store.createCard({title:'Alpha 100%', listId, country:'Germany', secondaryCountry:'Japan', starred:true, tagIds:[tag], contactQuarter:'2026-3', accountType:'client', distributorIds:[partner.id], flags:{inQuote:{active:true,comment:'Waiting'}}});
    store.createCard({title:'Beta',listId,country:'Germany',secondaryCountry:'Germany',lastContact:'2025-01-03'});
    store.createCard({title:'Gamma',listId:otherList,country:'Canada',flags:{logisticsIssue:{active:true,comment:'Tracking'}}});
    store.createCard({title:'Unknown location',listId,country:''});
    const queries = [{}, {listId}, {listId:otherList}, {view:'active'}, {view:'inQuote'}, {view:'logisticsIssue'}, {view:'administrativeIssue'}, {view:'starred'}, {tag}, {tag:'quarter:2026-3'}, {tag:'quarter:2025-1'}, {country:'Japan'}, {q:'IoT'}, {q:'waiting'}, {q:'%'}, {q:'no match'}, {q:'Alpha',view:'inQuote',listId,tag}, {q:'Gamma',listId}, {accountType:'channel'}, {distributorId:partner.id}];
    for (const query of queries) {
      const cards = store.listCards(query);
      const result = store.geography({...query,limit:1,offset:999});
      assert.equal(result.total,cards.total,JSON.stringify(query));
      const counts = new Map();
      for (const card of cards.items) for (const country of new Set([card.country,card.secondaryCountry].filter(Boolean))) counts.set(country,(counts.get(country)||0)+1);
      assert.deepEqual(Object.fromEntries(result.countries.map(c=>[c.country,c.count])),Object.fromEntries(counts),JSON.stringify(query));
    }
    store.updateCard(a.id,{version:a.version,archived:true});
    assert.equal(store.geography({view:'inQuote'}).total,0);
    for (const query of [{view:'invalid'},{tag:'quarter:2026-5'},{accountType:'invalid'},{q:['Alpha']}]) assert.throws(()=>store.geography(query));
  } finally { store.close(); }
});

test('HTTP geography forwards current filters and scoped country directory agrees', async () => {
  const store = createStore({path:':memory:',seed:false});
  const listId=store.createList({name:'Fictional HTTP clients'}).id;
  store.createCard({title:'Alpha test',listId,country:'Germany',secondaryCountry:'Japan',starred:true});
  store.createCard({title:'Beta test',listId,country:'Canada'});
  const server=createHttpApp({store}).listen(0,'127.0.0.1');
  await once(server,'listening');
  const origin=`http://127.0.0.1:${server.address().port}`;
  try {
    const query=new URLSearchParams({listId,view:'starred',q:'test'});
    const response=await fetch(`${origin}/api/geography?${query}`);
    assert.equal(response.status,200);
    assert.deepEqual(await response.json(),{total:1,countries:[{country:'Germany',count:1},{country:'Japan',count:1}]});
    const directory=await (await fetch(`${origin}/api/cards?${query}&country=Japan`)).json();
    assert.equal(directory.total,1); assert.equal(directory.items[0].title,'Alpha test');
    const invalid=await fetch(`${origin}/api/geography?view=invalid`);
    assert.equal(invalid.status,400);
  } finally { await new Promise(resolve=>server.close(resolve));store.close(); }
});
