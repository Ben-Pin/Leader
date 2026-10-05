import type { Card } from './types';

export interface ListExportOptions { includeDescription: boolean; includeHistory: boolean }

export function listExportStamp(date: Date): string {
  const two = (value: number) => String(value).padStart(2, '0');
  const hour = two(date.getHours());
  return `${two(date.getDate())}${two(date.getMonth() + 1)}${hour}-${hour}${two(date.getMinutes())}`;
}

export function companyExportFileName(companyName: string, date: Date): string {
  return `Leader-${companyName}-${listExportStamp(date)}`.replace(/[^\p{L}\p{N} _-]/gu, '_') + '.json';
}

export function prepareListCards(cards: readonly Card[], options: ListExportOptions): Card[] {
  return cards.map(card => ({ ...card,
    description: options.includeDescription ? card.description : '',
    activity: options.includeHistory ? card.activity : [],
  }));
}
