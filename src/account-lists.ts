import type { AccountType } from './types';

export const permanentListDefinitions: { name: string; type: AccountType; color: string }[] = [
  { name: 'Leads', type: 'lead', color: '#D65C59' },
  { name: 'Prospects', type: 'unspecified', color: '#DC913D' },
  { name: 'Opportunities', type: 'opportunity', color: '#C4AA35' },
  { name: 'Customers', type: 'client', color: '#4E9F69' },
  { name: 'Partners', type: 'partner', color: '#4C83CB' },
  { name: 'Agents', type: 'distributor', color: '#9765CE' },
];
export const permanentListTypes: Record<string, AccountType> = Object.fromEntries([
  ...permanentListDefinitions.map(list => [list.name, list.type]),
  ['Distributors', 'distributor'], ['Клиенты', 'client'], ['Потенциальные', 'unspecified'],
  ['Партнеры', 'partner'], ['Дистрибьюторы', 'distributor'],
]);
export const listNameForType = Object.fromEntries(permanentListDefinitions.map(list => [list.type, list.name])) as Record<AccountType, string>;
export const displayListName = (name: string): string => permanentListTypes[name] ? listNameForType[permanentListTypes[name]] : name;
