export interface Tag { id: string; name: string; color: string; category?: string | null; count?: number }
export interface ClientList { id: string; name: string; color: string; count: number }
export interface ChecklistItem { id: string; text: string; done: boolean }
export interface Activity { id: string; text: string; createdAt: string; contacts: Contact[]; kind: 'note' | 'flag' }
export type LeadStatus = 'lead' | 'contacted' | 'qualified' | 'proposal' | 'client';
export type FlagKey = 'inQuote' | 'logisticsIssue' | 'administrativeIssue' | 'swIssue' | 'hwIssue';
export type CardFlags = Record<FlagKey, { active: boolean; comment: string; activatedAt?: string | null }>;
export interface CompanyDatabase { id: string; name: string }
export type AccountType = 'unspecified' | 'client' | 'distributor' | 'partner';
export interface RelatedCard { id: string; title: string; country: string; archived: boolean }
export type ContactStatus = 'active' | 'main' | 'inactive' | 'disturbing' | 'useful' | 'decisions';
export interface Contact { id: string; name: string; role: string; email: string; status: ContactStatus }
export interface Card {
  id: string; listId: string; title: string; description: string; company: string;
  country: string; secondaryCountry: string; contactName: string; email: string; lastContact: string | null;
  contacts: Contact[];
  contactQuarter: string | null;
  dueDate: string | null; status: LeadStatus; priority: number; completed: boolean;
  starred: boolean; starredAt: string | null; archived: boolean; importedPending: boolean; version: number; createdAt: string; updatedAt: string;
  tags: Tag[]; checklist: ChecklistItem[]; activity: Activity[];
  flags: CardFlags;
  accountType: AccountType; distributorIds: string[]; distributors: RelatedCard[]; clientCount: number;
}
export interface Bootstrap {
  lists: ClientList[]; tags: Tag[];
  stats: { total: number; active: number; completed: number; starred: number } & Record<FlagKey, number>;
  csrfToken: string; demo: boolean;
  company: CompanyDatabase; companies: CompanyDatabase[];
}
export interface CardPage { items: Card[]; total: number; limit: number; offset: number }
export interface CardDraft {
  title: string; listId: string; description: string; company: string; country: string; secondaryCountry: string; contactQuarter: string | null;
  contacts: Contact[]; lastContact: string; dueDate: string;
  status: LeadStatus; priority: number; tagIds: string[]; checklist: ChecklistItem[];
  flags: CardFlags;
  accountType: AccountType; distributorIds: string[];
}
export type Selection = { kind: 'view'; id: 'all' | 'active' | 'starred' | FlagKey } | { kind: 'list' | 'tag'; id: string };
