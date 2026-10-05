import { createCompanyManager } from '../server/companies.mjs';
import { resolve } from 'node:path';

const directory = process.env.LEADER_DATA_DIR || resolve('data');
const companyId = process.argv[2] || 'demo';
const manager = createCompanyManager({ directory, seed: false });
try {
  const bundle = manager.exportCompany(companyId);
  const cards = bundle.cards;
  const listNames = new Map(bundle.lists.map(list => [list.id, list.name]));
  const counts = Object.fromEntries(bundle.lists.map(list => [list.name, cards.filter(card => card.listId === list.id).length]));
  const unverifiedCountries = cards.filter(card => !card.country?.trim() || card.country === 'Not verified');
  const missingDate = cards.filter(card => !card.lastContact);
  const missingContacts = cards.filter(card => !card.contacts?.some(contact => contact.name?.trim() || contact.email?.trim() || contact.role?.trim()));
  const missingDescription = cards.filter(card => !card.description?.trim());
  const noEmail = cards.filter(card => !card.contacts?.some(contact => contact.email?.trim()));
  const misplaced = cards.filter(card => {
    const expected = { lead: 'Leads', unspecified: 'Prospects', opportunity: 'Opportunities', client: 'Customers', partner: 'Partners', distributor: 'Agents' }[card.accountType];
    return expected && listNames.get(card.listId) !== expected;
  });
  console.log(JSON.stringify({ company: bundle.company.name, cards: cards.length, lists: counts,
    unverifiedCountries: unverifiedCountries.length, missingLastContact: missingDate.length,
    missingContacts: missingContacts.length, missingEmail: noEmail.length,
    missingDescription: missingDescription.length, statusListMismatch: misplaced.length,
    historyEntries: cards.reduce((total, card) => total + card.activity.length, 0) }, null, 2));
} finally { manager.close(); }
