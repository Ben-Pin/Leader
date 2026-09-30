export interface Tag { id: string; name: string; color: string; count?: number }
export interface ClientList { id: string; name: string; color: string; count: number }
export interface ChecklistItem { id: string; text: string; done: boolean }
export interface Activity { id: string; text: string; createdAt: string }
export type LeadStatus = 'lead' | 'contacted' | 'qualified' | 'proposal' | 'client';
export interface Card {
  id: string; listId: string; title: string; description: string; company: string;
  country: string; contactName: string; email: string; lastContact: string | null;
  dueDate: string | null; status: LeadStatus; priority: number; completed: boolean;
  starred: boolean; archived: boolean; version: number; createdAt: string; updatedAt: string;
  tags: Tag[]; checklist: ChecklistItem[]; activity: Activity[];
}
export interface Bootstrap {
  lists: ClientList[]; tags: Tag[];
  stats: { total: number; active: number; completed: number; starred: number };
  csrfToken: string; demo: boolean;
}
export interface CardPage { items: Card[]; total: number; limit: number; offset: number }
export interface CardDraft {
  title: string; listId: string; description: string; company: string; country: string;
  contactName: string; email: string; lastContact: string; dueDate: string;
  status: LeadStatus; priority: number; tagIds: string[]; checklist: ChecklistItem[];
}
export type Selection = { kind: 'view'; id: 'all' | 'active' | 'completed' | 'starred' } | { kind: 'list' | 'tag'; id: string };
