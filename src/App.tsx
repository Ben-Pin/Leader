import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import {
  Archive, ArrowDownWideNarrow, ArrowLeft, CalendarDays, Check, CheckCheck, ChevronDown,
  ChevronRight, Circle, CircleCheck, CircleHelp, CirclePlus, Clock3, Copy, Flag, Globe2,
  Hash, Inbox, LayoutList, LoaderCircle, Mail, MessageSquare, MoreHorizontal, Plus,
  Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Star, Tag as TagIcon, Trash2, UserRound,
  UsersRound, X, DollarSign, Truck, TriangleAlert, Undo2, Database, Download, Upload, Wrench,
} from 'lucide-react';
import { ApiError, request, selectCompany } from './api';
import { version as appVersion } from '../package.json';
import { Relationships } from './Relationships';
import { ClientGlobe } from './ClientGlobe';
import { GameTokenArt, GameTokenGallery, gameTokens, useGameTokenHold } from './GameTokens';
import { interleaveWisdom, wisdomThoughts } from './wisdom';
import { listExportStamp, prepareListCards } from './list-transfer';
import { countryNames,tagCategory } from './geography';
import { permanentListTypes, listNameForType, displayListName } from './account-lists';
import { UserSettings, type UserPreferences } from './UserSettings';
import { DEFAULT_MAP, DEFAULT_MOTTO, readCustomMap, writeCustomMap, type CustomMap } from './preferences';
import './workspaces.css';
import type { Bootstrap, Card, CardDraft, CardPage, ClientList, LeadStatus, Selection, Tag, FlagKey, CompanyDatabase, ContactStatus, AccountType } from './types';

const tagGroups = ['Countries', 'Time', 'Product', 'Stage', 'Application', 'Other'];

const workFlags: { key: FlagKey; label: string; Icon: typeof DollarSign | typeof TuxIcon }[] = [
  { key: 'inQuote', label: 'In quote', Icon: DollarSign },
  { key: 'logisticsIssue', label: 'Logistics issue', Icon: Truck },
  { key: 'administrativeIssue', label: 'Administrative issue', Icon: TriangleAlert },
  { key: 'swIssue', label: 'SW issue', Icon: TuxIcon },
  { key: 'hwIssue', label: 'HW issue', Icon: Wrench },
];

const statuses: { value: LeadStatus; label: string; color: string }[] = [
  { value: 'contact', label: 'Contact', color: '#5a82de' },
  { value: 'evaluation', label: 'Evaluation', color: '#9969cb' },
  { value: 'rampUp', label: 'Ramp Up', color: '#d99841' },
  { value: 'massProduction', label: 'Production', color: '#42a481' },
  { value: 'legacy', label: 'Legacy', color: '#8f97aa' },
];
const contactStatuses: ContactStatus[] = ['active', 'main', 'inactive', 'disturbing', 'useful', 'decisions'];
const priorityLabels = ['No priority', 'Low', 'Medium', 'High'];
const contactStatusLabel = (status: ContactStatus) => status === 'inactive' ? 'inactive (left company)' : status;
const palette = ['#5475d9', '#749ce8', '#36a885', '#9bb342', '#dca249', '#e97965', '#cc75a2', '#9671c8', '#8993a7'];
const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const fullDateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const PAGE_SIZE = 100;
type FlagTransition = { kind: FlagKey; active: boolean; comment: string; happenedAt: string };
type ListTransition = { fromListId: string; toListId: string; happenedAt: string };
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Could not complete the action.';
const colorStyle = (color: string): CSSProperties => ({ '--tag-color': /^#[0-9a-f]{6}$/i.test(color) ? color : '#5475d9' } as CSSProperties);
const formatDate = (date?: string | null, full = false) => {
  if (!date) return '';
  const d = new Date(date.length === 10 ? `${date}T12:00:00` : date);
  return Number.isNaN(d.getTime()) ? '' : (full ? fullDateFormat : dateFormat).format(d).replace('.', '');
};
function quarterTag(date: string): Tag | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const year = Number(date.slice(0, 4));
  const name = `${year}-${Math.ceil(Number(date.slice(5, 7)) / 3)}`;
  return { id: `quarter:${name}`, name, color: year >= 2026 ? '#36c96b' : year === 2025 ? '#88b66d' : year === 2024 ? '#e6a64b' : '#e27370', category: 'Time' };
}
function localToday(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function quarterForDate(date: string): string { return `${date.slice(0, 4)}-${Math.ceil(Number(date.slice(5, 7)) / 3)}`; }
function draftFrom(card: Card): CardDraft {
  return { title: card.title, listId: card.listId, description: card.description || '', company: card.company || '',
    country: card.country || '', secondaryCountry: card.secondaryCountry || '', contactQuarter: card.contactQuarter, contacts: card.contacts || [], lastContact: card.lastContact || '',
    dueDate: card.dueDate || '', status: card.status, priority: card.priority,
    tagIds: card.tags.filter(t => !t.id.startsWith('quarter:')).map(t => t.id), checklist: card.checklist || [], flags: Object.fromEntries(workFlags.map(({key})=>[key,{active:card.flags[key].active,comment:card.flags[key].comment}])) as CardDraft['flags'],
    accountType: card.accountType, distributorIds: card.distributorIds };
}
function completedFlagEvents(events: readonly FlagTransition[], draft: CardDraft): FlagTransition[] {
  const lastEventIndex = new Map<FlagKey, number>();
  events.forEach((event, index) => lastEventIndex.set(event.kind, index));
  return events.map((event, index) => lastEventIndex.get(event.kind) === index ? { ...event, comment: draft.flags[event.kind].comment } : event);
}
function Badge({ tag, onClick }: { tag: Tag; onClick?: () => void }) {
  const props = { className: `tag-badge ${tag.id.startsWith('quarter:') ? 'quarter-badge' : ''}`, style: colorStyle(tag.color), title: tag.id.startsWith('quarter:') ? `Last contact: Q${tag.name.split('-')[1]} ${tag.name.split('-')[0]}` : tag.name };
  return onClick ? <button {...props} onClick={onClick}>{tag.name}</button> : <span {...props}>{tag.name}</span>;
}
function IconButton({ label, children, className = '', ...props }: { label: string; children: ReactNode; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`icon-button ${className}`} aria-label={label} title={label} {...props}>{children}</button>;
}
function Modal({ title, children, onClose, className = '' }: { title: string; children: ReactNode; onClose: () => void; className?: string }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current!;
    ((dialog.querySelector('input, select, textarea') || dialog.querySelector('button')) as HTMLElement | null)?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]'));
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, []);
  return <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className={`modal ${className}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={dialogRef}>
      <div className="modal-heading"><h2 id="modal-title">{title}</h2><IconButton label="Close dialog" onClick={onClose}><X size={19}/></IconButton></div>
      {children}
    </div>
  </div>;
}

export default function App() {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [startupError, setStartupError] = useState('');
  const [selection, setSelection] = useState<Selection>({ kind: 'view', id: 'all' });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState('contact');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [showCardFilters, setShowCardFilters] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState('');
  const [selected, setSelected] = useState<Card | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [draft, setDraft] = useState<CardDraft | null>(null);
  const [pendingFlagEvents, setPendingFlagEvents] = useState<FlagTransition[]>([]);
  const [pendingListEvents, setPendingListEvents] = useState<ListTransition[]>([]);
  const [saving, setSaving] = useState(false);
  const [retagging, setRetagging] = useState(false);
  const [exportingList, setExportingList] = useState(false);
  const [wisdomEnabled, setWisdomEnabled] = useState(() => localStorage.getItem('leader.wisdomEnabled') === 'true');
  const [saveError, setSaveError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [aboutTokenId, setAboutTokenId] = useState('tux');
  const openAbout = () => { setAboutTokenId(gameTokens[Math.floor(Math.random() * gameTokens.length)].id); setModal('about'); };
  const [modal, setModal] = useState<'card' | 'list' | 'tag' | 'about' | 'archive' | 'companies' | 'globe' | 'profile' | 'gameTokens' | 'listExport' | 'listImport' | null>(null);
  const [userName,setUserName]=useState(()=>localStorage.getItem('leader.userName')||'Local user');
  const [motto, setMotto] = useState(() => localStorage.getItem('leader.motto') || DEFAULT_MOTTO);
  const [mapVisible, setMapVisible] = useState(() => localStorage.getItem('leader.mapVisible') !== 'false');
  const [hiddenLists, setHiddenLists] = useState<AccountType[]>(() => {
    try { const value = JSON.parse(localStorage.getItem('leader.hiddenLists') || '[]'); return Array.isArray(value) ? value.filter(type => Object.hasOwn(listNameForType, type)) : []; }
    catch { return []; }
  });
  const [customMap, setCustomMap] = useState<CustomMap | null>(null);
  const [mapUrl, setMapUrl] = useState(DEFAULT_MAP);
  useEffect(() => { void readCustomMap().then(setCustomMap).catch(() => setToast('Could not load the custom map. Using the default map.')); }, []);
  useEffect(() => {
    if (!customMap) { setMapUrl(DEFAULT_MAP); return; }
    const url = URL.createObjectURL(customMap.blob); setMapUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [customMap]);
  const [gameTokenId, setGameTokenId] = useState(() => {
    const stored = localStorage.getItem('leader.gameToken');
    return gameTokens.some(token => token.id === stored) ? stored! : 'tux';
  });
  const mascotHold = useGameTokenHold();
  const saveInFlight = useRef<Promise<Card | null> | null>(null);
  const [toast, setToast] = useState('');
  const [detailTab, setDetailTab] = useState<'card' | 'contacts' | 'activity'>('card');
  const [tagPicker, setTagPicker] = useState(false);
  const [showTags, setShowTags] = useState(true);
  const [showLists, setShowLists] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [checkText, setCheckText] = useState('');
  const [comment, setComment] = useState('');
  const [commentContacts, setCommentContacts] = useState<string[]>([]);
  const detailScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { detailScrollRef.current?.scrollTo({top:0}); }, [detailTab, selected?.id]);
  const eligibleContacts = draft?.contacts.filter(c => c.name.trim() || c.email.trim() || c.role.trim()) || [];
  const commentContactIds = commentContacts.filter(id => eligibleContacts.some(c => c.id === id));
  const searchRef = useRef<HTMLInputElement>(null);
  const detailRequest = useRef(0);
  const detailExitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (detailExitTimer.current) clearTimeout(detailExitTimer.current); }, []);
  const listRequest = useRef(0);
  const initialSelectionDone = useRef(false);
  const selectedRef = useRef<Card | null>(null);
  const dirtyRef = useRef(false);
  const discardPending = useRef(false);
  const bootstrapRef = useRef<Bootstrap | null>(null);
  const dirty = Boolean(selected && draft && (pendingFlagEvents.length > 0 || pendingListEvents.length > 0 || JSON.stringify(draft) !== JSON.stringify(draftFrom(selected))));
  selectedRef.current = selected; dirtyRef.current = dirty; bootstrapRef.current = bootstrap;
  const loadBootstrap = useCallback(async () => {
    const data = await request<Bootstrap>('/bootstrap');
    setBootstrap(data); setStartupError('');
    return data;
  }, []);
  useEffect(() => { loadBootstrap().catch(e => { setStartupError(errorText(e)); setLoading(false); }); }, [loadBootstrap]);
  useEffect(() => { const timer = window.setTimeout(() => setDebouncedSearch(search), 220); return () => clearTimeout(timer); }, [search]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, []);
  useEffect(() => {
    const onBlur = () => { if (dirtyRef.current && !saveInFlight.current && !discardPending.current) void saveDraft(); };
    const onHidden = () => { if (document.visibilityState === 'hidden') onBlur(); };
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onHidden);
    return () => { window.removeEventListener('blur', onBlur); document.removeEventListener('visibilitychange', onHidden); };
  });
  useEffect(() => {
    const onPageHide = () => {
      if (!dirty || !selected || !draft || !bootstrap) return;
      void fetch(`/api/cards/${encodeURIComponent(selected.id)}`, {
        method: 'PATCH', keepalive: true,
        headers: { 'Content-Type': 'application/json', 'X-Leader-Token': bootstrap.csrfToken, 'X-Leader-Company': bootstrap.company.id },
        body: JSON.stringify({ ...draft, title: draft.title.trim(), flagEvents: completedFlagEvents(pendingFlagEvents, draft), listEvents: pendingListEvents, version: selected.version }),
      });
    };
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, [dirty, selected, draft, pendingFlagEvents, pendingListEvents, bootstrap]);
  useEffect(() => {
    const warnBeforeLeave = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current && !saveInFlight.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeave);
    return () => window.removeEventListener('beforeunload', warnBeforeLeave);
  }, []);

  const queryString = useCallback((offset = 0) => {
    const query = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset), sort, q: debouncedSearch.trim() });
    if (priorityFilter !== '') query.set('priority', priorityFilter);
    if (stageFilter) query.set('status', stageFilter);
    if (debouncedSearch.trim()) query.set('view','all');
    else if (selection.kind === 'list') { query.set('listId', selection.id); query.set('view', 'all'); }
    else if (selection.kind === 'tag') { query.set('tag', selection.id); query.set('view', 'all'); }
    else query.set('view', selection.id);
    return query.toString();
  }, [selection, sort, debouncedSearch, priorityFilter, stageFilter]);
  useEffect(() => {
    if (!bootstrapRef.current) return;
    const sequence = ++listRequest.current;
    const controller = new AbortController();
    setLoading(true); setListError('');
    request<CardPage>(`/cards?${queryString()}`, { signal: controller.signal }).then(page => {
      if (sequence !== listRequest.current) return;
      setCards(page.items); setTotal(page.total); setLoading(false);
      if (!initialSelectionDone.current && page.items.length && window.innerWidth > 1000) {
        initialSelectionDone.current = true;
        setSelected(page.items[0]); setDraft(draftFrom(page.items[0]));
        setDetailVisible(true);
      }
    }).catch(e => { if (e.name !== 'AbortError' && sequence === listRequest.current) { setListError(errorText(e)); setLoading(false); } });
    return () => controller.abort();
  }, [queryString, refreshKey, Boolean(bootstrap)]);

  const guardChanges = async (): Promise<boolean> => {
    if (detailLoading) return false;
    if (!dirtyRef.current && !saveInFlight.current) return true;
    return Boolean(await saveDraft());
  };
  const hideDetail = () => {
    detailRequest.current++;
    setDetailVisible(false);
    if (detailExitTimer.current) clearTimeout(detailExitTimer.current);
    detailExitTimer.current = setTimeout(() => {
      setSelected(null); setDraft(null); detailExitTimer.current = null;
    }, 320);
  };
  const discardAndClose = () => {
    if (saveInFlight.current) return;
    dirtyRef.current = false;
    if (selected) setDraft(draftFrom(selected));
    setPendingFlagEvents([]); setPendingListEvents([]);
    hideDetail(); setSaveError(''); setConflict(false);
  };
  const switchCompany = async (id: string) => {
    if (!(await guardChanges())) return;
    selectCompany(id); window.location.reload();
  };
  const chooseSelection = async (next: Selection) => {
    if (!(await guardChanges())) return;
    setSelection(next); hideDetail(); setSearch(''); setSidebarOpen(false); setTagPicker(false);
  };
  const openCard = async (card: Card, skipGuard = false) => {
    if (!skipGuard && selected?.id === card.id && detailVisible) return;
    if (!skipGuard && !(await guardChanges())) return;
    discardPending.current = false;
    if (detailExitTimer.current) { clearTimeout(detailExitTimer.current); detailExitTimer.current = null; }
    setDetailVisible(true);
    const sequence = ++detailRequest.current;
    setSelected(card); setDraft(draftFrom(card)); setPendingFlagEvents([]); setPendingListEvents([]); setSaveError(''); setConflict(false); setDetailTab('card'); setTagPicker(false); setComment(''); setCommentContacts([]); setCheckText('');
    setDetailLoading(true);
    try {
      const fresh = await request<Card>(`/cards/${encodeURIComponent(card.id)}`);
      if (sequence === detailRequest.current) { setSelected(fresh); setDraft(draftFrom(fresh)); }
    } catch (e) { if (sequence === detailRequest.current) setSaveError(errorText(e)); }
    finally { if (sequence === detailRequest.current) setDetailLoading(false); }
  };
  const closeCard = async () => { if (!(await guardChanges())) return; hideDetail(); };
  const openRelated = async (id: string) => {
    if (!(await guardChanges())) return;
    try { const card = await request<Card>(`/cards/${encodeURIComponent(id)}`); await openCard(card, true); }
    catch (e) { setToast(errorText(e)); }
  };
  const updateDraft = <K extends keyof CardDraft>(key: K, value: CardDraft[K]) => setDraft(prev => prev ? { ...prev, [key]: value } : prev);
  const moveDraftToList = (listId: string) => {
    if (!draft || draft.listId === listId) return;
    const list = bootstrap?.lists.find(item => item.id === listId);
    if (!list) return;
    setPendingListEvents(events => [...events, { fromListId: draft.listId, toListId: listId, happenedAt: new Date().toISOString() }]);
    setDraft({ ...draft, listId, accountType: permanentListTypes[list.name] || draft.accountType });
  };
  const changeDraftType = (type: AccountType) => {
    const list = bootstrap?.lists.find(item => permanentListTypes[item.name] === type);
    if (list) moveDraftToList(list.id);
  };
  const savePreferences = async (settings: UserPreferences, map: CustomMap | null | undefined) => {
    if (map !== undefined) { await writeCustomMap(map); setCustomMap(map); }
    for (const [key, value] of Object.entries(settings)) localStorage.setItem(`leader.${key}`, typeof value === 'string' ? value : JSON.stringify(value));
    setUserName(settings.userName); setMotto(settings.motto); setWisdomEnabled(settings.wisdomEnabled);
    setMapVisible(settings.mapVisible); setHiddenLists(settings.hiddenLists);
    if (selection.kind === 'list' && settings.hiddenLists.includes(permanentListTypes[bootstrap?.lists.find(list => list.id === selection.id)?.name || ''])) {
      setSelection({ kind: 'view', id: 'all' });
    }
    setModal(null); setToast('Settings saved for this browser.');
  };
  const toggleDraftFlag = (key: FlagKey) => {
    if (!draft) return;
    const active = !draft.flags[key].active;
    setPendingFlagEvents(events => [...events, { kind: key, active, comment: draft.flags[key].comment, happenedAt: new Date().toISOString() }]);
    const today = localToday();
    setDraft(previous => previous ? { ...previous, lastContact: today, contactQuarter: quarterForDate(today), flags: { ...previous.flags, [key]: { ...previous.flags[key], active } } } : previous);
  };
  const reconcile = (card: Card) => {
    setCards(prev => prev.map(c => c.id === card.id ? card : c));
    if (selectedRef.current?.id === card.id) { selectedRef.current = card; dirtyRef.current = false; setSelected(card); setDraft(draftFrom(card)); setPendingFlagEvents([]); setPendingListEvents([]); }
    setRefreshKey(k => k + 1);
    loadBootstrap().catch(() => setToast('Changes saved. Counts will refresh after reload.'));
  };
  const writeCard = async (card: Card, fields: Record<string, unknown>) => {
    return request<Card>(`/cards/${encodeURIComponent(card.id)}`, { method: 'PATCH', body: { ...fields, version: card.version }, token: bootstrapRef.current?.csrfToken });
  };
  const deleteSelection = async () => {
    if (selection.kind !== 'list' && selection.kind !== 'tag') return;
    const item = selection.kind === 'list' ? bootstrap?.lists.find(x => x.id === selection.id) : bootstrap?.tags.find(x => x.id === selection.id);
    if (!item || !window.confirm(`Delete ${selection.kind === 'list' ? 'list' : 'tag'} «${item.name}»?`)) return;
    if (!(await guardChanges())) return;
    try {
      await request(`/${selection.kind === 'list' ? 'lists' : 'tags'}/${encodeURIComponent(selection.id)}`, { method: 'DELETE', body: {}, token: bootstrapRef.current?.csrfToken });
      setSelection({ kind: 'view', id: 'all' }); setRefreshKey(k => k + 1);
      await loadBootstrap(); setToast(selection.kind === 'list' ? 'List deleted' : 'Tag deleted');
    } catch (e) { setToast(errorText(e)); }
  };
  const changeTagGroup = async (id: string, category: string) => {
    try {
      await request(`/tags/${encodeURIComponent(id)}`, { method: 'PATCH', token: bootstrapRef.current?.csrfToken, body: { category } });
      await loadBootstrap(); setToast('Tag moved to ' + category);
    } catch (e) { setToast(errorText(e)); }
  };
  const saveDraft = (): Promise<Card | null> => {
    if (saveInFlight.current) return saveInFlight.current;
    if (!selected || !draft) return Promise.resolve(null);
    if (!dirtyRef.current) return Promise.resolve(selected);
    if (!draft.title.trim()) { setSaveError('Enter a card name.'); return Promise.resolve(null); }
    if (draft.contacts.some(contact => contact.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim()))) { setSaveError('Check the email address.'); return Promise.resolve(null); }
    const operation = (async () => {
      setSaving(true); setSaveError(''); setConflict(false);
      try {
        const result = await writeCard(selected, { ...draft, title: draft.title.trim(), flagEvents: completedFlagEvents(pendingFlagEvents, draft), listEvents: pendingListEvents });
        reconcile(result); return result;
      } catch (e) {
        setConflict(e instanceof ApiError && e.status === 409);
        setSaveError(e instanceof ApiError && e.status === 409 ? 'This card was changed in another window or connector. Reload it and try again.' : errorText(e));
        return null;
      } finally { setSaving(false); saveInFlight.current = null; }
    })();
    saveInFlight.current = operation;
    return operation;
  };
  const toggleCard = async (card: Card, key: 'starred') => {
    if (saving || detailLoading) return;
    if (selected?.id === card.id && dirty) {
      if (!(await guardChanges())) return;
      card = selectedRef.current || card;
    }
    setSaving(true);
    try { const result = await writeCard(card, { [key]: !card[key] }); reconcile(result); }
    catch (e) { setToast(e instanceof ApiError && e.status === 409 ? 'This card was changed. Reopen it and try again.' : errorText(e)); }
    finally { setSaving(false); }
  };
  const loadMore = async () => {
    if (loadingMore || loading) return;
    const sequence = listRequest.current;
    setLoadingMore(true);
    try {
      const page = await request<CardPage>(`/cards?${queryString(cards.length)}`);
      if (sequence === listRequest.current) { setCards(prev => [...prev, ...page.items.filter(c => !prev.some(p => p.id === c.id))]); setTotal(page.total); }
    } catch (e) { setToast(errorText(e)); }
    finally { setLoadingMore(false); }
  };
  const archiveCard = async () => {
    if (!selected || saving) return;
    if (modal !== 'archive') { if (await guardChanges()) setModal('archive'); return; }
    setModal(null);
    setSaving(true);
    try { await writeCard(selected, { archived: true }); hideDetail(); setRefreshKey(k => k + 1); await loadBootstrap(); setToast('Card archived'); }
    catch (e) { setSaveError(errorText(e)); }
    finally { setSaving(false); }
  };
  const addComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected || !comment.trim() || saving) return;
    if (!commentContactIds.length) { setSaveError('Select at least one contact for the history entry.'); return; }
    let current = selected;
    if (dirty) { const saved = await saveDraft(); if (!saved) return; current = saved; }
    setSaving(true); setSaveError('');
    try {
      const result = await request<Card>(`/cards/${current.id}/comments`, { method: 'POST', body: { text: comment.trim(), version: current.version, contactIds: commentContactIds }, token: bootstrap?.csrfToken });
      reconcile(result); setComment(''); setCommentContacts([]); setToast('Note added');
    } catch (e) { setSaveError(errorText(e)); }
    finally { setSaving(false); }
  };
  const title = selection.kind === 'list' ? bootstrap?.lists.find(l => l.id === selection.id)?.name || 'List'
    : selection.kind === 'tag' ? bootstrap?.tags.find(t => t.id === selection.id)?.name || selection.id.replace('quarter:', '')
    : ({ all: 'All cards', active: 'In work', starred: 'Important', inQuote: 'In quote', logisticsIssue: 'Logistics issue', administrativeIssue: 'Administrative issue', swIssue: 'SW issue', hwIssue: 'HW issue' })[selection.id];
  const selectedList = bootstrap?.lists.find(l => l.id === (draft?.listId || selected?.listId));
  const draftQuarter = draft ? quarterTag(draft.lastContact) || (!draft.lastContact && draft.contactQuarter ? quarterTag(`${draft.contactQuarter.slice(0,4)}-${String(Number(draft.contactQuarter.slice(-1))*3).padStart(2,'0')}-01`) : null) : null;
  const draftTags = draft ? [...(draftQuarter ? [draftQuarter] : []), ...draft.tagIds.map(id => bootstrap?.tags.find(tag => tag.id === id)).filter((tag): tag is Tag => Boolean(tag) && !tag!.id.startsWith('quarter:'))] : [];
  const ordinaryTags = bootstrap?.tags.filter(t => !t.id.startsWith('quarter:')) || [];
  const tags = bootstrap?.tags || [];
  const activeSidebar = (kind: Selection['kind'], id: string) => selection.kind === kind && selection.id === id;
  const openCreate = async () => { if (await guardChanges()) setModal('card'); };
  const openCompanies = async () => { if (await guardChanges()) setModal('companies'); };
  const openListAction = async (action: 'listExport' | 'listImport') => { if (await guardChanges()) setModal(action); };
  const exportCurrentList = async (options: { includeDescription: boolean; includeHistory: boolean }) => {
    if (!bootstrap || exportingList) return;
    const listName = debouncedSearch.trim() ? 'Search results' : displayListName(title || 'All cards');
    const fileName = (`Leader-${bootstrap.company.name}-${listName}-${listExportStamp(new Date())}`
      .replace(/[^\p{L}\p{N} _-]/gu, '_')) + '.json';
    type SaveHandle = { createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }> };
    const savePicker = (window as Window & { showSaveFilePicker?: (options: object) => Promise<SaveHandle> }).showSaveFilePicker;
    let saveHandle: SaveHandle | null = null;
    // Open the native picker before the first await so the browser keeps the user's click activation.
    if (savePicker) {
      try { saveHandle = await savePicker.call(window, { suggestedName: fileName, startIn: 'documents', types: [{ description: 'Leader JSON', accept: { 'application/json': ['.json'] } }] }); }
      catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setToast(errorText(error));
        return;
      }
    }
    setExportingList(true);
    try {
      const query = new URLSearchParams(queryString());
      query.set('limit', '200');
      const exported: Card[] = [];
      let expected = 0;
      do {
        query.set('offset', String(exported.length));
        const page = await request<CardPage>(`/cards?${query}`);
        expected = page.total;
        if (!page.items.length && exported.length < expected) throw new Error('Export stopped before all cards were loaded.');
        exported.push(...page.items);
      } while (exported.length < expected);
      const bundle = { format: 'leader-list', version: 1, exportedAt: new Date().toISOString(),
        company: bootstrap.company, selection: { ...selection, name: listName, search: debouncedSearch.trim(), sort },
        included: { description: options.includeDescription, history: options.includeHistory },
        total: exported.length, cards: prepareListCards(exported, options) };
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      if (saveHandle) {
        const writable = await saveHandle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor); anchor.click(); anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
      setToast(`Exported ${exported.length.toLocaleString('en-GB')} cards.`);
      setModal(null);
    } catch (error) { setToast(errorText(error)); }
    finally { setExportingList(false); }
  };
  const autoTagQuarters = async () => {
    if (retagging || !(await guardChanges())) return;
    setRetagging(true); setToast('Updating quarter tags…');
    try {
      let result: { updated: number; examined: number };
      try {
        result = await request<{ updated: number; examined: number }>('/cards/retag-quarters', { method: 'POST', body: {}, token: bootstrapRef.current?.csrfToken });
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 404) throw error;
        let offset = 0, updated = 0, examined = 0, total = 0;
        do {
          const page = await request<CardPage>(`/cards?view=all&sort=title&limit=200&offset=${offset}`);
          total = page.total; examined += page.items.filter(card => Boolean(card.lastContact)).length;
          for (const card of page.items) {
            if (!card.lastContact) continue;
            const quarter = quarterForDate(card.lastContact);
            if (card.contactQuarter === quarter) continue;
            await request<Card>(`/cards/${encodeURIComponent(card.id)}`, { method: 'PATCH', body: { version: card.version, contactQuarter: quarter }, token: bootstrapRef.current?.csrfToken });
            updated++;
          }
          offset += page.items.length;
          if (!page.items.length) break;
        } while (offset < total);
        result = { updated, examined };
      }
      const currentId = selectedRef.current?.id;
      if (currentId) {
        const current = await request<Card>(`/cards/${encodeURIComponent(currentId)}`);
        if (selectedRef.current?.id === currentId) { setSelected(current); setDraft(draftFrom(current)); }
      }
      setRefreshKey(key => key + 1);
      await loadBootstrap();
      setToast(`Quarter tags checked: ${result.examined} dated cards; ${result.updated} updated.`);
    } catch (error) { setToast(errorText(error)); }
    finally { setRetagging(false); }
  };
  useEffect(() => {
    const onSave = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); if (dirty) void saveDraft(); }
    };
    window.addEventListener('keydown', onSave);
    return () => window.removeEventListener('keydown', onSave);
  });

  if (!bootstrap) return <div className="startup"><div className="startup-logo"><LeaderLogo /></div><h1>Leader</h1>
    {startupError ? <><p className="error-message">{startupError}</p><button className="primary-button" onClick={() => { setStartupError(''); loadBootstrap().catch(e => setStartupError(errorText(e))); }}>Try again</button></>
      : <><LoaderCircle className="spin" size={22}/><p>Loading database…</p></>}
  </div>;

  return <div className={`app-shell ${selected ? 'detail-is-open' : ''} ${sidebarOpen ? 'sidebar-is-open' : ''}`}>
    <aside className="icon-rail" aria-label="Application">
      <button className="brand-mark" aria-label="About Leader" title="About Leader" onClick={openAbout}><LeaderLogo /></button>
      <div className="rail-group">
        <IconButton label="All cards" className={`rail-button ${activeSidebar('view','all')?'selected-rail':''}`} onClick={() => chooseSelection({ kind: 'view', id: 'all' })}><LayoutList size={23}/></IconButton>
        <IconButton label="In work — active flags" className={`rail-button ${activeSidebar('view','active')?'selected-rail':''}`} onClick={() => chooseSelection({kind:'view',id:'active'})}><SlidersHorizontal size={22}/></IconButton>
        <IconButton label="Important" className={`rail-button ${activeSidebar('view', 'starred') ? 'selected-rail' : ''}`} onClick={() => chooseSelection({ kind: 'view', id: 'starred' })}><Star size={22}/></IconButton>
        <IconButton label="Search cards" className="rail-button" onClick={() => searchRef.current?.focus()}><Search size={22}/></IconButton>
        <IconButton label="New card" className="rail-button" onClick={openCreate}><CirclePlus size={22}/></IconButton>
        <IconButton label="Customer globe" className="rail-button" onClick={()=>setModal('globe')}><Globe2 size={22}/></IconButton>
        <IconButton label="Auto-tag quarters from last contact dates" className="rail-button" onClick={autoTagQuarters} disabled={retagging}>{retagging ? <LoaderCircle size={22} className="spin"/> : <Sparkles size={22}/>}</IconButton>
      </div>
      <div className="rail-bottom"><IconButton label="Company databases" className="rail-button" onClick={openCompanies}><Database size={21}/></IconButton><button className="rail-avatar" onClick={async () => { if (await guardChanges()) setModal('profile'); }} aria-label="User settings" title={`Settings · ${userName}`}><UserRound size={22}/></button></div>
    </aside>

    {sidebarOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}/>}
    <aside className="sidebar" aria-label="Lists and tags">
      <div className="workspace-heading"><div><span className="brand-name">Leader<span className="brand-dot">.</span></span><span className="workspace-caption" title={motto}>{motto}</span></div><button type="button" className={`game-token-trigger ${mascotHold.heldId === gameTokenId ? 'is-held' : ''}`} style={mascotHold.heldId === gameTokenId ? mascotHold.wobbleStyle : undefined} aria-label={`Choose game piece, current: ${gameTokens.find(token => token.id === gameTokenId)?.name || 'Tux'}`} title="Choose game piece" onDragStart={event => event.preventDefault()} onPointerDown={event => { if (event.button === 0) mascotHold.press(gameTokenId); }} onClick={() => setModal('gameTokens')}><GameTokenArt id={gameTokenId} large/></button></div>
      <div className="company-switcher"><Database size={15}/><select aria-label="Connected company" value={bootstrap.company.id} onChange={e => switchCompany(e.target.value)} disabled={saving || detailLoading}>{bootstrap.companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select><IconButton label="Import and export company" onClick={openCompanies}><Settings2 size={15}/></IconButton></div>
      <nav className="smart-lists">
        <NavItem icon={<Inbox size={18}/>} label="All cards" count={bootstrap.stats.total} selected={activeSidebar('view', 'all')} onClick={() => chooseSelection({ kind: 'view', id: 'all' })}/>
        <NavItem icon={<UsersRound size={18}/>} label="In work" count={bootstrap.stats.active} selected={activeSidebar('view', 'active')} onClick={() => chooseSelection({ kind: 'view', id: 'active' })}/>
        <NavItem icon={<Star size={18}/>} label="Important" count={bootstrap.stats.starred} selected={activeSidebar('view', 'starred')} onClick={() => chooseSelection({ kind: 'view', id: 'starred' })}/>
      </nav>
      <div className="sidebar-scroll">
        <div className="section-heading"><button onClick={() => setShowLists(!showLists)} aria-expanded={showLists}>{showLists ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}<span>My lists</span></button><IconButton label="Create list" onClick={() => setModal('list')}><Plus size={16}/></IconButton></div>
        {showLists && <nav className="custom-lists">{bootstrap.lists.filter(list => !hiddenLists.includes(permanentListTypes[list.name])).map(list => <NavItem key={list.id} icon={<Hash size={18} style={{ color: list.color }}/>} label={displayListName(list.name)} count={list.count} selected={activeSidebar('list', list.id)} onClick={() => chooseSelection({ kind: 'list', id: list.id })}/>)}<button className="sidebar-add" onClick={() => setModal('list')}><Plus size={16}/>Add list</button></nav>}
        <ClientGlobe selected={selected} refresh={refreshKey} query={queryString()} onExpand={()=>setModal('globe')} onOpen={openRelated}/>
        <div className="section-heading tags-heading"><button onClick={() => setShowTags(!showTags)} aria-expanded={showTags}>{showTags ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}<span>Tags</span></button><IconButton label="Create tag" onClick={() => setModal('tag')}><Plus size={16}/></IconButton></div>
        {showTags && <nav className="tag-nav grouped-tags">{tagGroups.map(group=><details key={group}><summary>{group}<span>{tags.filter(t=>(t.category || tagCategory(t.name))===group).length}</span></summary>{tags.filter(t=>(t.category || tagCategory(t.name))===group).map(tag=><NavItem key={tag.id} icon={<TagIcon size={14} style={{color:tag.color}}/>} label={tag.name} count={tag.count||0} selected={activeSidebar('tag',tag.id)} onClick={()=>chooseSelection({kind:'tag',id:tag.id})}/>)}{!tags.some(t=>(t.category || tagCategory(t.name))===group)&&<small>No tags yet</small>}</details>)}</nav>}
      </div>
      <div className="sidebar-footer"><span className="connection-dot"/><span>Local workspace</span><IconButton label="Storage and connector information" onClick={openAbout}><ShieldCheck size={16}/></IconButton></div>
    </aside>

    <main className="main-pane">
      <div className="topbar"><IconButton label="Lists and tags" className="mobile-menu" onClick={() => setSidebarOpen(!sidebarOpen)}><LayoutList size={20}/></IconButton>
        <div className="search-box"><Search size={17}/><input ref={searchRef} maxLength={200} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search the entire database" aria-label="Search cards"/>{search ? <IconButton label="Clear search" onClick={() => setSearch('')}><X size={14}/></IconButton> : <kbd>Ctrl K</kbd>}</div>
        {bootstrap.demo && <span className="demo-pill"><span/>Demo</span>}
      </div>
      <div className="list-header">
        <div className="list-heading"><div className="eyebrow">{bootstrap.company.name}</div><h1>{selection.kind === 'tag' && !debouncedSearch && <TagIcon size={22}/>} {debouncedSearch.trim()?'Search database':displayListName(title || '')}</h1>{debouncedSearch && <p>{`Search results for “${debouncedSearch}”`}</p>}</div>
        <div className="list-header-actions">
          {selection.kind === 'tag' && !selection.id.startsWith('quarter:') && <select aria-label="Tag group" value={bootstrap.tags.find(tag => tag.id === selection.id)?.category || tagCategory(title || '')} onChange={event => void changeTagGroup(selection.id, event.target.value)}>{tagGroups.map(group => <option key={group} value={group}>{group}</option>)}</select>}
          {((selection.kind === 'tag' && !selection.id.startsWith('quarter:')) || (selection.kind === 'list' && !permanentListTypes[title || ''])) && <IconButton label={selection.kind === 'list' ? 'Delete list' : 'Delete tag'} onClick={deleteSelection}><Trash2 size={17}/></IconButton>}
        </div>
      </div>
      <div className="list-controls-row"><div className="flag-filters" aria-label="Flag filters">{workFlags.map(({ key, label, Icon }) => <button key={key} className={`signal-button ${key} ${activeSidebar('view', key) ? 'selected' : ''}`} aria-label={`${label}: ${bootstrap.stats[key]}`} title={label} aria-pressed={activeSidebar('view', key)} onClick={() => chooseSelection({ kind: 'view', id: key })}><Icon size={16}/>{bootstrap.stats[key] > 0 && <b className="signal-count">{bootstrap.stats[key]}</b>}</button>)}</div><div className="header-ticket-stack" aria-label="List actions">
        <button type="button" className="header-action-button" aria-label="Add card" title="Add card" onClick={openCreate}><Plus size={16}/></button>
        <button type="button" className="header-action-button" aria-label="List import" title="List import" onClick={() => void openListAction('listImport')}><Download size={16}/></button>
        <button type="button" className="header-action-button" aria-label="List export" title="List export" onClick={() => void openListAction('listExport')}><Upload size={16}/></button>
      </div></div>
      <div className="list-toolbar"><span className="cards-count">{loading ? 'Loading…' : `${total.toLocaleString('en-GB')} ${pluralCards(total)}`}</span><button className={`card-filter-toggle ${priorityFilter !== '' || stageFilter ? 'active' : ''}`} aria-label="Filter cards" aria-expanded={showCardFilters} onClick={() => setShowCardFilters(!showCardFilters)} title="Priority and project stage"><SlidersHorizontal size={14}/>{(priorityFilter !== '' || stageFilter) && <b>{Number(priorityFilter !== '') + Number(Boolean(stageFilter))}</b>}</button><div className="toolbar-controls"><ArrowDownWideNarrow size={16}/><select aria-label="Sort cards" value={sort} onChange={e => setSort(e.target.value)}><option value="contact">Last contact</option><option value="priority">Priority: high first</option><option value="updated">Recently updated</option><option value="title">Name A–Z</option><option value="titleDesc">Name Z–A</option></select><ChevronDown size={13}/></div></div>
      {showCardFilters && <div className="card-filter-panel"><label>Priority<select aria-label="Filter by priority" value={priorityFilter} onChange={event => setPriorityFilter(event.target.value)}><option value="">Any priority</option>{priorityLabels.map((label,value) => <option value={value} key={value}>{label}</option>)}</select></label><label>Stage<select aria-label="Filter by project stage" value={stageFilter} onChange={event => setStageFilter(event.target.value)}><option value="">Any step</option>{statuses.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label><button className="text-button" onClick={() => {setPriorityFilter('');setStageFilter('');}}>Clear filters</button></div>}
      <div className="cards-scroll" aria-busy={loading}>
        {loading ? <div className="skeleton-list" aria-label="Loading cards">{[0,1,2,3,4,5].map(i => <div className="skeleton-row" key={i}><span className="skeleton-circle"/><div><span/><span/></div></div>)}</div>
          : listError ? <div className="empty-state"><CircleHelp size={36}/><h2>Could not load cards</h2><p>{listError}</p><button className="secondary-button" onClick={() => setRefreshKey(k => k + 1)}>Retry</button></div>
          : cards.length === 0 ? <div className="empty-state"><div className="empty-icon">{debouncedSearch ? <Search size={32}/> : <Inbox size={34}/>}</div><h2>{debouncedSearch ? 'No results' : 'No cards'}</h2><p>{debouncedSearch ? 'Search by company, country, or contact.' : ''}</p><button className="secondary-button" onClick={() => debouncedSearch ? setSearch('') : openCreate()}>{debouncedSearch ? 'Clear search' : 'Add card'}</button></div>
          : <><div className="card-group-heading"><ChevronDown size={13}/><span>Cards</span><span>{total}</span></div>
            <div className="card-list">{interleaveWisdom(cards, wisdomThoughts, wisdomEnabled).map(item => {
              if (item.kind === 'thought') return <article key={`wisdom:${item.thought.id}`} className="wisdom-row" aria-label="Wisdom thought"><Sparkles size={17} aria-hidden="true"/><div><span className="wisdom-eyebrow">Wisdom</span><p>{item.thought.text}</p>{item.thought.attribution && <small>{item.thought.attribution}</small>}</div></article>;
              const card = item.card;
              return <div key={card.id} className={`card-row card-priority-${card.priority} ${selected?.id === card.id ? 'selected' : ''}`}>
              <button className="card-row-content" onClick={() => openCard(card)} aria-label={`Open ${card.title}`} aria-current={selected?.id === card.id ? 'true' : undefined}>
                <div className="card-title-line"><span className="card-title">{card.title}</span></div>
                <div className="card-subtitle">{card.country && <span>{[card.country,card.secondaryCountry].filter(Boolean).join(' / ')}</span>}{card.country && card.contactName && <span className="subtitle-dot">·</span>}{card.contactName && <span>{card.contactName}</span>}{!card.country && !card.contactName && <span>{card.company || 'Add customer details'}</span>}</div>
                <div className="row-tags">{card.tags.slice(0, 3).map(tag => <Badge tag={tag} key={tag.id}/>)}{card.importedPending && <span className="imported-badge">Imported</span>}{card.tags.length > 3 && <span className="more-tags">+{card.tags.length - 3}</span>}{card.checklist.length > 0 && <span className="checklist-count"><CheckCheck size={12}/>{card.checklist.filter(c => c.done).length}/{card.checklist.length}</span>}</div>
                <div className="row-flags">{workFlags.filter(flag => card.flags[flag.key].active).map(({ key, label, Icon }) => <span className={`row-attention ${key}`} key={key} title={`${label}: ${card.flags[key].comment}`}><span className={`signal-button signal-badge ${key} selected`} aria-label={label}><Icon size={11}/></span><span className="flag-comment-preview">{card.flags[key].comment || label}</span><time>{card.flags[key].activatedAt?formatDate(card.flags[key].activatedAt,true):'Date unknown'}</time></span>)}</div>
              </button>
              <div className="card-trailing"><span className="row-top-state"><button className={`row-star ${card.starred ? 'is-starred' : ''}`} aria-label={card.starred ? `Remove from important: ${card.title}` : `Mark important: ${card.title}`} title={card.starred ? 'Remove from important' : 'Mark important'} onClick={() => toggleCard(card, 'starred')} disabled={saving}><Star size={15} fill={card.starred ? 'currentColor' : 'none'}/></button>{card.priority > 0 && <span className={`row-priority priority-${card.priority}`} aria-label={`${priorityLabels[card.priority]} priority`} title={`${priorityLabels[card.priority]} priority`}><Flag size={10} fill="currentColor"/>{priorityLabels[card.priority]}</span>}</span>{card.starred&&<time className="starred-date" title="Marked important">★ {card.starredAt?formatDate(card.starredAt,true):'Date unknown'}</time>}<span className="contact-date" title={card.lastContact ? `Last contact: ${formatDate(card.lastContact, true)}` : 'Contact date not set'}><Clock3 size={10}/> {formatDate(card.lastContact) || '—'}</span><span className="row-work-state"><span className="row-stage" title="Project stage" style={{color:statuses.find(stage=>stage.value===card.status)?.color}}>{statuses.find(stage=>stage.value===card.status)?.label}</span></span></div>
            </div>})}</div>
            {cards.length < total && <button className="load-more" onClick={loadMore} disabled={loadingMore}>{loadingMore ? <LoaderCircle className="spin" size={16}/> : <ChevronDown size={16}/>}Show more · {Math.min(PAGE_SIZE, total - cards.length)}</button>}
            <div className="list-end"><span/>{`Showing ${cards.length} of ${total}`}<span/></div>
          </>}
      </div>
      <div className="main-footer"><span><ShieldCheck size={13}/>Saved on this computer</span><span>Leader</span></div>
    </main>

    {selected && draft ? <aside key={selected.id} className={`detail-pane ${detailVisible ? 'detail-entering' : 'detail-exiting'}`} aria-label="Customer card" aria-hidden={!detailVisible} inert={!detailVisible} onBlurCapture={event => { const pane = event.currentTarget; const next = event.relatedTarget as HTMLElement | null; if (discardPending.current || next?.closest('[data-discard]')) return; if (!next) { const request = detailRequest.current; queueMicrotask(() => { if (request === detailRequest.current && !discardPending.current && !pane.contains(document.activeElement) && dirtyRef.current) void saveDraft(); }); return; } if (!pane.contains(next) && dirtyRef.current) void saveDraft(); }}>
      <div className="detail-topbar"><button className="secondary-button save-button" data-discard onPointerDownCapture={() => { discardPending.current = true; }} onKeyDownCapture={event => { if (event.key === 'Enter' || event.key === ' ') discardPending.current = true; }} onClick={discardAndClose} disabled={saving || detailLoading}><Undo2 size={15}/>Undo</button><div className="detail-topbar-actions">
        <div className="traffic-lights" aria-label="Card flags">{workFlags.map(({ key, label, Icon }) => <button key={key} role="checkbox" className={`signal-button ${key} ${draft.flags[key].active ? 'selected' : ''}`} aria-label={`Flag ${label}`} title={`${label} · records a dated history event and updates last contact`} aria-checked={draft.flags[key].active} onClick={() => toggleDraftFlag(key)} disabled={saving || detailLoading}><Icon size={16}/></button>)}</div>
        <span className="toolbar-divider"/><IconButton label="Close card" onClick={closeCard}><X size={19}/></IconButton>
      </div></div>
      <div className="detail-scroll" ref={detailScrollRef} inert={saving}>
        {workFlags.some(({ key }) => draft.flags[key].active) && <div className="card-work-flags" aria-label="Flag comments">
          {workFlags.filter(({ key }) => draft.flags[key].active).map(({ key, label }) => <div className={`signal-comment ${key}`} key={key}><span className="signal-dot"/><input className="flag-comment" aria-label={`Comment ${label}`} title={label} placeholder="…" maxLength={300} value={draft.flags[key].comment} onChange={e => updateDraft('flags', { ...draft.flags, [key]: { ...draft.flags[key], comment: e.target.value } })} disabled={saving || detailLoading}/></div>)}
        </div>}
        <div className="detail-list-select"><Hash size={15} style={{ color: selectedList?.color }}/><select aria-label="Card list" value={draft.listId} onChange={e => moveDraftToList(e.target.value)} disabled={detailLoading}>{bootstrap.lists.map(list => <option key={list.id} value={list.id}>{displayListName(list.name)}</option>)}</select><ChevronDown size={13}/>{detailLoading && <LoaderCircle className="spin" size={14}/>}</div>
        <textarea className="detail-title" rows={2} value={draft.title} onChange={e => updateDraft('title', e.target.value)} aria-label="Card name" placeholder="Company name" disabled={detailLoading}/>
        <div className="detail-tag-row">{selected.importedPending && <span className="imported-badge" title="This marker clears after the first saved edit">Imported</span>}{draftTags.map(tag => <span className="removable-tag" key={tag.id}><Badge tag={tag}/><button aria-label={`Remove tag ${tag.name}`} title={tag.id.startsWith('quarter:')?'Clear contact date and quarter':'Remove from card'} disabled={detailLoading} onClick={()=>{if(tag.id.startsWith('quarter:')){setDraft(d=>d?{...d,lastContact:'',contactQuarter:null}:d);setToast('Date and quarter cleared in the draft. Changes save when you leave the card.');}else updateDraft('tagIds',draft.tagIds.filter(id=>id!==tag.id));}}><X size={11}/></button></span>)}<button className={`add-tag-button ${tagPicker ? 'active' : ''}`} aria-label="Edit tags" onClick={() => setTagPicker(!tagPicker)} disabled={detailLoading}><Plus size={13}/>{draftTags.length === 0 ? 'Add tags' : ''}</button></div>
        {tagPicker && <div className="tag-picker"><span className="picker-heading">Card tags</span>{ordinaryTags.length ? ordinaryTags.map(tag => <label key={tag.id}><input type="checkbox" checked={draft.tagIds.includes(tag.id)} onChange={e => updateDraft('tagIds', e.target.checked ? [...draft.tagIds, tag.id] : draft.tagIds.filter(id => id !== tag.id))}/><TagIcon size={14} style={{ color: tag.color }}/>{tag.name}</label>) : <p>Create a tag to group cards.</p>}<button className="text-button" onClick={() => setModal('tag')}><Plus size={14}/>Create tag</button><div className="picker-note">The quarter tag is generated from the last contact date.</div></div>}
        <div className="detail-tabs" role="tablist" aria-label="Card sections">
          <button role="tab" aria-selected={detailTab === 'card'} className={detailTab === 'card' ? 'active' : ''} onClick={() => setDetailTab('card')}>Card</button>
          <button role="tab" aria-selected={detailTab === 'contacts'} className={detailTab === 'contacts' ? 'active' : ''} onClick={() => setDetailTab('contacts')}>Contacts<span>{draft.contacts.length}</span></button>
          <button role="tab" aria-selected={detailTab === 'activity'} className={detailTab === 'activity' ? 'active' : ''} onClick={() => setDetailTab('activity')}>History<span>{selected.activity.length}</span></button>
        </div>
        {detailTab === 'card' ? <div className="detail-card-content">
          <div className="properties">
            <Property icon={<Globe2 size={15}/>} label="Country"><input list="country-options" value={draft.country} onChange={e => updateDraft('country', e.target.value)} placeholder="Not set" aria-label="Customer country" disabled={detailLoading}/></Property>
            <Property icon={<Globe2 size={15}/>} label="Second country"><input list="country-options" value={draft.secondaryCountry} onChange={e => updateDraft('secondaryCountry', e.target.value)} placeholder="Optional" aria-label="Second customer country" disabled={detailLoading}/></Property>
            <Property icon={<Circle size={15}/>} label="Stage"><div className="status-select" style={{ '--status-color': statuses.find(s => s.value === draft.status)?.color } as CSSProperties}><span/><select value={draft.status} onChange={e => updateDraft('status', e.target.value as LeadStatus)} aria-label="Stage" disabled={detailLoading}>{statuses.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}</select></div></Property>
            <Property icon={<Flag size={15}/>} label="Priority"><select value={draft.priority} onChange={e => updateDraft('priority', Number(e.target.value))} aria-label="Card priority" className={`priority-select priority-${draft.priority}`} disabled={detailLoading}><option value={0}>No priority</option><option value={1}>Low</option><option value={2}>Medium</option><option value={3}>High</option></select></Property>
            <Property icon={<Clock3 size={15}/>} label="Last contact"><input type="date" value={draft.lastContact} onChange={e => updateDraft('lastContact', e.target.value)} aria-label="Last contact date" disabled={detailLoading}/></Property>
            <Property icon={<CalendarDays size={15}/>} label="Next step"><input type="date" value={draft.dueDate} onChange={e => updateDraft('dueDate', e.target.value)} aria-label="Next step date" disabled={detailLoading}/></Property>
          </div>
          <Relationships key={selected.id} card={selected} accountType={draft.accountType} distributorIds={draft.distributorIds} disabled={saving || detailLoading} onType={changeDraftType} onLinks={ids => updateDraft('distributorIds', ids)} onOpen={openRelated}/>
          <section className="detail-section"><h3>About customer</h3><textarea className="description-input" value={draft.description} onChange={e => updateDraft('description', e.target.value)} placeholder="Key facts, requirements, and agreements…" aria-label="Customer description" rows={5} disabled={detailLoading}/></section>
          <section className="detail-section checklist-section"><div className="detail-section-heading"><h3>Next steps</h3><span>{draft.checklist.filter(item => item.done).length} / {draft.checklist.length}</span></div>
            {draft.checklist.length > 0 && <div className="checklist-progress"><span style={{ width: `${draft.checklist.filter(item => item.done).length / draft.checklist.length * 100}%` }}/></div>}
            {draft.checklist.map(item => <div className={`checklist-item ${item.done ? 'done' : ''}`} key={item.id}><button className={`completion-control ${item.done ? 'is-checked' : ''}`} aria-label={`${item.done ? 'Undo' : 'Complete'} step: ${item.text}`} onClick={() => updateDraft('checklist', draft.checklist.map(c => c.id === item.id ? { ...c, done: !c.done } : c))} disabled={detailLoading}>{item.done && <Check size={11}/>}</button><input aria-label="Next step text" value={item.text} onChange={e => updateDraft('checklist', draft.checklist.map(c => c.id === item.id ? { ...c, text: e.target.value } : c))} disabled={detailLoading}/><IconButton label={`Delete step: ${item.text}`} onClick={() => updateDraft('checklist', draft.checklist.filter(c => c.id !== item.id))} disabled={detailLoading}><X size={13}/></IconButton></div>)}
            <form className="add-checklist" onSubmit={e => { e.preventDefault(); if (!checkText.trim()) return; updateDraft('checklist', [...draft.checklist, { id: crypto.randomUUID(), text: checkText.trim(), done: false }]); setCheckText(''); }}><Plus size={15}/><input aria-label="Add next step" placeholder="Add step" value={checkText} onChange={e => setCheckText(e.target.value)} disabled={detailLoading}/>{checkText.trim() && <button type="submit">Add</button>}</form>
          </section>
          {selected.activity.length > 0 && <button className="last-activity" onClick={() => setDetailTab('activity')}><MessageSquare size={15}/><span><strong>Latest activity</strong><span>{selected.activity[0].text}</span></span><ChevronRight size={15}/></button>}
        </div> : detailTab === 'contacts' ? <div className="contacts-content">
          <section className="detail-section contacts-section" aria-label="Company contacts">
            <div className="detail-section-heading"><h3>Contacts</h3><span>{draft.contacts.length}</span></div>
            {draft.contacts.map((contact, index) => <div className="contact-row" key={contact.id}>
              <label>Name<input value={contact.name} maxLength={300} placeholder="Full name" aria-label={`Contact name ${index + 1}`} onChange={e => updateDraft('contacts', draft.contacts.map(c => c.id === contact.id ? {...c, name:e.target.value} : c))} disabled={detailLoading || saving}/></label>
              <label>Position<input value={contact.role} maxLength={500} placeholder="Position / role" aria-label={`Contact position ${index + 1}`} onChange={e => updateDraft('contacts', draft.contacts.map(c => c.id === contact.id ? {...c, role:e.target.value} : c))} disabled={detailLoading || saving}/></label>
              <label>Email<input type="email" value={contact.email} maxLength={320} placeholder="name@company.com" aria-label={`Contact email ${index + 1}`} onChange={e => updateDraft('contacts', draft.contacts.map(c => c.id === contact.id ? {...c, email:e.target.value} : c))} disabled={detailLoading || saving}/></label>
              <label className="contact-status">Status<select aria-label={`Contact status ${index + 1}`} value={contact.status} onChange={e => updateDraft('contacts', draft.contacts.map(c => c.id === contact.id ? {...c,status:e.target.value as ContactStatus} : c))} disabled={detailLoading || saving}>{contactStatuses.map(status => <option key={status} value={status}>{contactStatusLabel(status)}</option>)}</select></label>
              <IconButton label={`Delete contact ${index + 1}`} onClick={() => updateDraft('contacts', draft.contacts.filter(c => c.id !== contact.id))} disabled={detailLoading || saving}><X size={14}/></IconButton>
            </div>)}
            <button className="text-button add-contact" disabled={detailLoading || saving || draft.contacts.length >= 100} onClick={() => updateDraft('contacts', [...draft.contacts, {id:crypto.randomUUID(),name:'',role:'',email:'',status:'active'}])}><Plus size={15}/>Add contact</button>
          </section>
        </div> : <div className="activity-content"><p className="activity-description">Discussion context, agreements, flag changes, and list transitions.</p>{selected.activity.length ? <div className="activity-list">{selected.activity.map(item => <article className={`activity-item ${item.kind === 'flag' ? 'flag-history-item' : item.kind === 'list' ? 'list-history-item' : ''}`} key={item.id}><span className="activity-dot"/><div><time>{formatDate(item.createdAt, true)}{item.createdAt.includes('T') ? ` · ${new Date(item.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}</time><p>{item.text}</p><div className="activity-contacts">{item.kind === 'flag' ? <small>Flag change</small> : item.kind === 'list' ? <small>List change</small> : item.contacts.length ? item.contacts.map(contact => <span key={contact.id} title={[contact.role,contact.email,contactStatusLabel(contact.status)].filter(Boolean).join(' · ')}>{contact.name || contact.email || contact.role}</span>) : <small>Older entry without contacts</small>}</div></div></article>)}</div> : <div className="activity-empty"><MessageSquare size={25}/><p>No notes yet</p><span>Record the first conversation.</span></div>}
          <form className="comment-form" onSubmit={addComment}>
            <fieldset className="comment-contacts"><legend>Participants · select at least one</legend>{eligibleContacts.length ? eligibleContacts.map(contact => <label key={contact.id}><input type="checkbox" checked={commentContactIds.includes(contact.id)} onChange={e => setCommentContacts(ids => e.target.checked ? [...ids, contact.id] : ids.filter(id => id !== contact.id))} disabled={saving || detailLoading}/><span>{contact.name || contact.email || contact.role}<small>{[contact.role, contact.email, contactStatusLabel(contact.status)].filter(Boolean).join(' · ')}</small></span></label>) : <p>First <button type="button" className="text-button" onClick={() => setDetailTab('contacts')}>add a contact</button> in the «Contacts».</p>}</fieldset>
            <textarea aria-label="New note" placeholder="What was discussed?" value={comment} onChange={e => setComment(e.target.value)} rows={3}/><button type="submit" className="primary-button" disabled={!comment.trim() || !commentContactIds.length || saving || detailLoading}>{saving ? <LoaderCircle size={14} className="spin"/> : <Plus size={14}/>}Add note</button></form>
        </div>}
      </div>
      {saveError && <div className="save-error" role="alert">{saveError}{conflict && <button onClick={async () => { if (await guardChanges()) openCard(selected, true); }}>Reload current version</button>}</div>}
      <div className={`detail-footer ${dirty ? 'has-changes' : ''}`}>{dirty ? <span><span className="unsaved-dot"/>{saving ? 'Saving…' : 'Changes save when you leave the card'}</span> : <><span><CheckCheck size={14}/>All changes saved</span><span className="revision" title={`Card version ${selected.version}`}>v{selected.version}</span></>}</div>
    </aside> : <aside className={`detail-placeholder ${mapVisible ? '' : 'map-disabled'}`}>{mapVisible && <div className="workspace-map" aria-hidden="true" style={{ backgroundImage: `url("${mapUrl}")` }}/>}<LayoutList size={34}/><h2>Select a card</h2></aside>}

    <datalist id="country-options">{countryNames.map(name=><option key={name} value={name}/>)}</datalist>
    {modal==='globe'&&<Modal title={`Geography · ${bootstrap.company.name}`} className="globe-modal" onClose={()=>setModal(null)}><ClientGlobe expanded selected={selected} refresh={refreshKey} query={queryString()} onOpen={async id=>{setModal(null);await openRelated(id);}}/></Modal>}
    {modal==='profile'&&<Modal title="User settings" className="user-settings-modal" onClose={()=>setModal(null)}><UserSettings initial={{userName,motto,wisdomEnabled,mapVisible,hiddenLists}} customMap={customMap} onSave={savePreferences}/></Modal>}
    {modal==='gameTokens'&&<Modal title="Choose a game piece" className="game-token-modal" onClose={()=>setModal(null)}><GameTokenGallery selectedId={gameTokenId} onSelect={id=>{setGameTokenId(id);localStorage.setItem('leader.gameToken',id);setModal(null);}}/></Modal>}
    {modal==='listExport'&&<ListExportModal count={total} busy={exportingList} onClose={()=>setModal(null)} onExport={exportCurrentList}/>}
    {modal==='listImport'&&<ListImportModal lists={bootstrap.lists} token={bootstrap.csrfToken} company={bootstrap.company.name} onClose={()=>setModal(null)} onImported={result=>{setModal(null);setRefreshKey(k=>k+1);void loadBootstrap();setToast(`Imported ${result.created.toLocaleString('en-GB')} cards · ${result.skipped} already existed${result.omittedLinks ? ` · ${result.omittedLinks} unavailable links omitted` : ''}.`);}}/>}
    {modal === 'companies' && <CompaniesModal bootstrap={bootstrap} onClose={() => setModal(null)} onChanged={()=>loadBootstrap()} onConnected={company => switchCompany(company.id)}/>}

    {modal === 'archive' && selected && <Modal title="Move to archive?" onClose={() => setModal(null)}><p>Card «{selected.title}» will remain in the local database. It can be restored through the connector.</p>{dirty && <p className="error-message">Unsaved card changes will be discarded.</p>}<div className="modal-actions"><button className="secondary-button" onClick={() => setModal(null)}>Cancel</button><button className="primary-button" onClick={archiveCard}>Archive</button></div></Modal>}
    {modal === 'card' && <CreateCardModal lists={bootstrap.lists} initialList={selection.kind === 'list' ? selection.id : bootstrap.lists[0]?.id || ''} token={bootstrap.csrfToken} onClose={() => setModal(null)} onCreated={card => { setModal(null); setSelection({ kind: 'list', id: card.listId }); setSearch(''); setRefreshKey(k => k + 1); loadBootstrap().catch(() => {}); openCard(card, true); setToast('New card created'); }}/>}
    {(modal === 'list' || modal === 'tag') && <CreateLabelModal kind={modal} token={bootstrap.csrfToken} onClose={() => setModal(null)} onCreated={item => { const kind = modal; setModal(null); loadBootstrap().catch(() => {}); setToast(kind === 'list' ? 'List created' : 'Tag created'); if (kind === 'list') chooseSelection({ kind: 'list', id: item.id }); else if (draft) updateDraft('tagIds', [...draft.tagIds, item.id]); }}/>}
    {modal === 'about' && <Modal title="About Leader" onClose={() => setModal(null)} className="about-modal"><div className="about-summary"><div className="about-details"><div className="about-brand"><div className="about-logo"><LeaderLogo /></div><div><strong>Leader<span>.</span></strong><p>{motto}</p></div></div><dl className="about-version"><dt>Version</dt><dd>{appVersion}</dd><dt>Concept and Product</dt><dd>Benjamin Pinkas</dd><dt>Development</dt><dd>With OpenAI Codex</dd></dl></div><div className="about-token" aria-hidden="true"><GameTokenArt id={aboutTokenId} large/></div></div><p className="about-purpose">A local workspace for researching companies and leads, managing contacts, and tracking follow-up - for business development, sales, partnerships, or job searching.</p><a className="manual-link" href="/Leader-User-Manual.pdf" target="_blank" rel="noopener noreferrer"><Download size={17}/>Open user manual (PDF)</a>{bootstrap.demo && <div className="demo-notice">Demo companies and contacts are fictional.</div>}<button className="primary-button about-close" onClick={() => setModal(null)}>Close</button></Modal>}
    {toast && <div className="toast" role="status"><Check size={16}/><span>{toast}</span><IconButton label="Dismiss notification" onClick={() => setToast('')}><X size={14}/></IconButton></div>}
  </div>;
}

function ListExportModal({count,busy,onClose,onExport}:{count:number;busy:boolean;onClose:()=>void;onExport:(options:{includeDescription:boolean;includeHistory:boolean})=>Promise<void>}) {
  const [includeDescription,setIncludeDescription]=useState(true);
  const [includeHistory,setIncludeHistory]=useState(true);
  const hasSavePicker = typeof (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function';
  return <Modal title="List export" onClose={()=>{if(!busy)onClose();}}><form className="create-form" onSubmit={event=>{event.preventDefault();void onExport({includeDescription,includeHistory});}}>
    <p className="form-intro">Export every card in the current list, filter, or search result ({count.toLocaleString('en-GB')} cards) as a Leader JSON file.</p>
    <label className="list-transfer-check"><input type="checkbox" checked={includeDescription} onChange={event=>setIncludeDescription(event.target.checked)} disabled={busy}/> Include “About customer”</label>
    <label className="list-transfer-check"><input type="checkbox" checked={includeHistory} onChange={event=>setIncludeHistory(event.target.checked)} disabled={busy}/> Include conversation history</label>
    <p className="form-hint">With both unchecked, the file contains company and contact details without these internal notes.</p>
    <p className="form-hint">{hasSavePicker ? 'The save dialog opens in Documents. You can choose another folder.' : 'This browser uses its download settings. Open Leader in Chrome or Edge to save in Documents or choose another folder.'}</p>
    <div className="modal-actions"><button type="button" className="secondary-button" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={busy}>{busy?<LoaderCircle size={15} className="spin"/>:<Download size={15}/>}Export JSON</button></div>
  </form></Modal>;
}

function ListImportModal({lists,token,company,onClose,onImported}:{lists:ClientList[];token:string;company:string;onClose:()=>void;onImported:(result:{created:number;skipped:number;omittedLinks:number})=>void}) {
  const [bundle,setBundle]=useState<{format:string;version:number;cards:unknown[];included?:{description?:boolean;history?:boolean}}|null>(null);
  const [fileName,setFileName]=useState('');
  const [mode,setMode]=useState<'preserve'|'target'>('preserve');
  const [targetListId,setTargetListId]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const permanentLists=lists.filter(list=>Boolean(permanentListTypes[list.name]));
  const selectFile=async(file?:File)=>{
    setBundle(null);setFileName('');setError('');
    if(!file)return;
    try{
      if(file.size>100*1024*1024)throw new Error('Maximum file size is 100 MB.');
      const data=JSON.parse(await file.text());
      if(data.format!=='leader-list'||data.version!==1||!Array.isArray(data.cards)||data.cards.length>10000)throw new Error('Select a Leader list export with up to 10,000 cards.');
      setBundle(data);setFileName(file.name);
    }catch(cause){setError(errorText(cause));}
  };
  const submit=async(event:FormEvent)=>{
    event.preventDefault();if(!bundle||busy||mode==='target'&&!targetListId)return;
    setBusy(true);setError('');
    try{const result=await request<{created:number;skipped:number;omittedLinks:number}>('/lists/import',{method:'POST',token,body:{bundle,mode,targetListId:mode==='target'?targetListId:undefined}});onImported(result);}
    catch(cause){setError(errorText(cause));setBusy(false);}
  };
  return <Modal title="List import" onClose={()=>{if(!busy)onClose();}}><form className="create-form" onSubmit={submit}>
    <p className="form-intro">Import a Leader list JSON file into {company}. Existing card IDs will be skipped; new cards keep an Imported marker until their first saved edit.</p>
    <label className="import-file"><span><Upload size={16}/>Leader list JSON</span><input type="file" accept=".json,application/json" disabled={busy} onChange={event=>void selectFile(event.target.files?.[0])}/></label>
    {bundle&&<div className="import-preview"><strong>{fileName}</strong><br/>{bundle.cards.length.toLocaleString('en-GB')} cards{bundle.included?.description===false?' · About customer excluded':''}{bundle.included?.history===false?' · History excluded':''}</div>}
    <fieldset className="list-transfer-mode"><legend>Where should cards go?</legend><label><input type="radio" name="importMode" checked={mode==='preserve'} onChange={()=>setMode('preserve')}/> Use each card’s category and distribute among the six permanent lists</label><label><input type="radio" name="importMode" checked={mode==='target'} onChange={()=>setMode('target')}/> Set every card’s category from one target list</label></fieldset>
    {mode==='target'&&<label>Target list<select value={targetListId} required onChange={event=>setTargetListId(event.target.value)}><option value="">Choose a permanent list</option>{permanentLists.map(list=><option key={list.id} value={list.id}>{displayListName(list.name)}</option>)}</select></label>}
    {error&&<p className="error-message" role="alert">{error}</p>}
    <div className="modal-actions"><button type="button" className="secondary-button" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={!bundle||busy||mode==='target'&&!targetListId}>{busy?<LoaderCircle size={15} className="spin"/>:<Upload size={15}/>}Import cards</button></div>
  </form></Modal>;
}

function TuxIcon({size=16}:{size?:number}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 10c0-5 1.5-8 5-8s5 3 5 8c1 2 2 4 2 6 0 3-3 5-7 5s-7-2-7-5c0-2 1-4 2-6Z"/>
    <ellipse cx="12" cy="14.5" rx="3.8" ry="5"/>
    <path d="m10 7 2-1 2 1-2 2Zm-3 4-4 5m14-5 4 5M8 19l-4 2 5 1 2-2m2 0 2 2 5-1-4-2"/>
    <circle cx="10" cy="5" r=".6" fill="currentColor" stroke="none"/><circle cx="14" cy="5" r=".6" fill="currentColor" stroke="none"/>
  </svg>;
}
function LeaderLogo() {
  return <img className="leader-logo" src="/leader-logo.png" alt="" aria-hidden="true" draggable={false}/>;
}
function pluralCards(count: number) { return count === 1 ? 'card' : 'cards'; }
function NavItem({ icon, label, count, selected, onClick }: { icon: ReactNode; label: string; count: number; selected: boolean; onClick: () => void }) {
  return <button className={`nav-item ${selected ? 'selected' : ''}`} onClick={onClick} title={label} aria-current={selected ? 'page' : undefined}>{icon}<span>{label}</span><span className="nav-count">{count > 0 ? count.toLocaleString('en-GB') : ''}</span></button>;
}
function Property({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) { return <div className="property-row"><span className="property-label">{icon}<span>{label}</span></span><div className="property-value">{children}</div></div>; }

function CreateCardModal({ lists, initialList, token, onClose, onCreated }: { lists: ClientList[]; initialList: string; token: string; onClose: () => void; onCreated: (card: Card) => void }) {
  const [title, setTitle] = useState(''), [listId, setListId] = useState(initialList), [country, setCountry] = useState(''), [lastContact, setLastContact] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (!title.trim() || !listId || busy) return; setBusy(true); setError('');
    try { const card = await request<Card>('/cards', { method: 'POST', token, body: { title: title.trim(), company: title.trim(), listId, accountType: permanentListTypes[lists.find(x => x.id === listId)?.name || ''] || 'unspecified', country: country.trim(), lastContact, status: 'contact' } }); onCreated(card); }
    catch (e) { setError(errorText(e)); setBusy(false); }
  };
  return <Modal title="New card" onClose={() => { if (!busy) onClose(); }}><form onSubmit={submit} className="create-form"><label>Company or name<input autoFocus required maxLength={240} placeholder="Company name" value={title} onChange={e => setTitle(e.target.value)}/></label><label>List<select value={listId} onChange={e => setListId(e.target.value)} required>{lists.map(list => <option key={list.id} value={list.id}>{displayListName(list.name)}</option>)}</select></label><div className="form-two-columns"><label>Primary country<input placeholder="Country" value={country} onChange={e => setCountry(e.target.value)}/></label><label>Last contact<input type="date" value={lastContact} onChange={e => setLastContact(e.target.value)}/></label></div>{lastContact && <div className="form-hint"><Badge tag={quarterTag(lastContact)!}/>The quarter tag will be added automatically</div>}{error && <p className="error-message" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Cancel</button><button className="primary-button" type="submit" disabled={busy || !title.trim() || !listId}>{busy ? <LoaderCircle size={15} className="spin"/> : <Plus size={15}/>}Create card</button></div></form></Modal>;
}

function CompaniesModal({ bootstrap, onClose, onConnected,onChanged }: { bootstrap: Bootstrap; onClose: () => void; onConnected: (company: CompanyDatabase) => void;onChanged:()=>Promise<unknown> }) {
  const [name, setName] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [bundle, setBundle] = useState<{ format: string; version: number; company?: CompanyDatabase; cards: unknown[]; lists: unknown[]; tags: unknown[] } | null>(null);
  const [disconnect,setDisconnect]=useState<CompanyDatabase|null>(null);
  const [disconnected,setDisconnected]=useState<CompanyDatabase[]>([]);
  const refreshDisconnected=()=>request<{companies:CompanyDatabase[]}>('/companies/disconnected').then(data=>setDisconnected(data.companies));
  useEffect(()=>{refreshDisconnected().catch(e=>setError(errorText(e)));},[]);
  const remove=async()=>{if(!disconnect)return;setBusy(true);setError('');try{await request(`/companies/${disconnect.id}/disconnect`,{method:'POST',body:{},token:bootstrap.csrfToken});if(disconnect.id===bootstrap.company.id){const next=bootstrap.companies.find(c=>c.id!==disconnect.id)!;selectCompany(next.id);window.location.reload();return;}setDisconnect(null);await onChanged();await refreshDisconnected();}catch(e){setError(errorText(e));}finally{setBusy(false);}};
  const restore=async(id:string)=>{setBusy(true);try{await request(`/companies/${id}/reconnect`,{method:'POST',body:{},token:bootstrap.csrfToken});await onChanged();await refreshDisconnected();}catch(e){setError(errorText(e));}finally{setBusy(false);}};
  const connect = async (event: FormEvent) => {
    event.preventDefault(); if (!name.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const company = await request<CompanyDatabase>(bundle ? '/companies/import' : '/companies', { method: 'POST', token: bootstrap.csrfToken, body: bundle ? { name: name.trim(), bundle } : { name: name.trim() } });
      onConnected(company);
    } catch (e) { setError(errorText(e)); setBusy(false); }
  };
  const exportCompany = async () => {
    setBusy(true); setError('');
    try {
      const data = await request(`/companies/${bootstrap.company.id}/export`);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `Leader-${bootstrap.company.name.replace(/[^\p{L}\p{N} _-]/gu, '_')}.json`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  };
  return <Modal title="Company databases" onClose={() => { if (!busy) onClose(); }} className="companies-modal">
    <div className="connected-companies">{bootstrap.companies.map(company => <div className={`company-row ${company.id===bootstrap.company.id?'current':''}`} key={company.id}><button disabled={busy} onClick={() => onConnected(company)}><Database size={16}/><span>{company.name}</span>{company.id === bootstrap.company.id && <Check size={15}/>}</button><IconButton label={`Remove database ${company.name} from the list`} disabled={busy||bootstrap.companies.length<=1} onClick={()=>setDisconnect(company)}><Trash2 size={15}/></IconButton></div>)}</div>
    {disconnect&&<div className="disconnect-confirm" role="alert"><strong>Remove {disconnect.name} from the list?</strong><p>The database file and cards will remain on this computer. You can reconnect it below.</p><button className="secondary-button" disabled={busy} onClick={()=>setDisconnect(null)}>Cancel</button> <button className="primary-button" disabled={busy} onClick={remove}>Remove from list</button></div>}
    {disconnected.length>0&&<details className="disconnected-companies"><summary>Disconnected databases · {disconnected.length}</summary>{disconnected.map(c=><div key={c.id}><span>{c.name}</span><button className="text-button" disabled={busy} onClick={()=>restore(c.id)}>Reconnect</button></div>)}</details>}
    <button className="secondary-button export-company" disabled={busy} onClick={exportCompany}><Download size={16}/>Export {bootstrap.company.name}</button>
    <form className="create-form company-form" onSubmit={connect}>
      <label className="import-file"><span><Upload size={16}/>Connect from Leader JSON file</span><input type="file" accept=".json,application/json" disabled={busy} onChange={async e => {
        const file = e.target.files?.[0]; if (!file) return; setError('');
        try {
          if (file.size > 128 * 1024 * 1024) throw new Error('Maximum file size is 128 MB.');
          const data = JSON.parse(await file.text());
          if (data.format !== 'leader-company' || data.version !== 1 || !Array.isArray(data.cards) || !Array.isArray(data.lists) || !Array.isArray(data.tags)) throw new Error('Select a Leader database export.');
          setBundle(data); const originalName = data.company?.name || 'Import';
          setName(bootstrap.companies.some(company => company.name.toLowerCase() === originalName.toLowerCase()) ? `${originalName} (import)` : originalName);
        } catch (e) { setBundle(null); setError(errorText(e)); }
      }}/></label>
      {bundle && <div className="import-preview">{bundle.cards.length.toLocaleString('en-GB')} cards · {bundle.lists.length} lists · {bundle.tags.length} tags<button type="button" className="text-button" onClick={() => { setBundle(null); setName(''); }}>Clear selected file</button></div>}
      <label>{bundle ? 'Connected company name' : 'New company'}<input value={name} onChange={e => setName(e.target.value)} required maxLength={100} placeholder="Company name" disabled={busy}/></label>
      {error && <p className="error-message" role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" className="secondary-button" disabled={busy} onClick={onClose}>Close</button><button className="primary-button" disabled={busy || !name.trim()}>{busy && <LoaderCircle className="spin" size={14}/>} {bundle ? 'Import and connect' : 'Create database'}</button></div>
    </form>
  </Modal>;
}
function CreateLabelModal({ kind, token, onClose, onCreated }: { kind: 'list' | 'tag'; token: string; onClose: () => void; onCreated: (item: ClientList | Tag) => void }) {
  const [name, setName] = useState(''), [color, setColor] = useState(palette[0]), [category, setCategory] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (!name.trim() || busy) return; setBusy(true); setError('');
    try { const item = await request<ClientList | Tag>(kind === 'list' ? '/lists' : '/tags', { method: 'POST', token, body: { name: name.trim(), color, ...(kind === 'tag' ? { category: category || tagCategory(name.trim()) } : {}) } }); onCreated(item); }
    catch (e) { setError(errorText(e)); setBusy(false); }
  };
  return <Modal title={kind === 'list' ? 'New list' : 'New tag'} onClose={() => { if (!busy) onClose(); }}><form onSubmit={submit} className="create-form"><p className="form-intro">{kind === 'list' ? 'Group customers by segment, region, or project.' : 'Tag cards to find related contacts.'}</p><label>Name<input autoFocus required maxLength={100} placeholder={kind === 'list' ? 'For example, European customers' : 'For example, Robotics'} value={name} onChange={e => setName(e.target.value)}/></label>{kind === 'tag' && <label>Group<select value={category || tagCategory(name)} onChange={e => setCategory(e.target.value)}>{tagGroups.map(group => <option key={group} value={group}>{group}</option>)}</select></label>}<div className="color-picker"><span>Color</span><div>{palette.map(item => <button type="button" key={item} style={{ background: item }} className={color === item ? 'selected' : ''} aria-label={`Color ${item}`} aria-pressed={color === item} onClick={() => setColor(item)}>{color === item && <Check size={16}/>}</button>)}</div></div>{error && <p className="error-message" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" className="primary-button" disabled={busy || !name.trim()}>{busy ? <LoaderCircle size={15} className="spin"/> : <Plus size={15}/>}Create {kind === 'list' ? 'list' : 'tag'}</button></div></form></Modal>;
}
