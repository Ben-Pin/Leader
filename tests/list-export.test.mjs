import test from 'node:test';
import assert from 'node:assert/strict';
import { companyExportFileName, listExportStamp, prepareListCards } from '../src/list-transfer.ts';

test('list export uses the requested local ddmmhh-hhmm suffix', () => {
  assert.equal(listExportStamp(new Date(2026, 9, 4, 13, 7)), '041013-1307');
  assert.equal(companyExportFileName('Forest: Demo/woodland', new Date(2026, 9, 5, 0, 4)), 'Leader-Forest_ Demo_woodland-051000-0004.json');
});

test('list export choices omit only internal notes requested by the user', () => {
  const original = { id: 'card-1', title: 'Company', description: 'Private context', activity: [{ id: 'note-1', text: 'Negotiation' }], contacts: [{ id: 'contact-1', email: 'buyer@example.test' }], flags: { swIssue: { active: true, comment: 'Needs a fix' } } };
  const [clean] = prepareListCards([original], { includeDescription: false, includeHistory: false });
  assert.equal(clean.description, '');
  assert.deepEqual(clean.activity, []);
  assert.deepEqual(clean.contacts, original.contacts);
  assert.deepEqual(clean.flags, original.flags);
  assert.equal(original.description, 'Private context');
  const [full] = prepareListCards([original], { includeDescription: true, includeHistory: true });
  assert.equal(full.description, 'Private context');
  assert.deepEqual(full.activity, original.activity);
});
