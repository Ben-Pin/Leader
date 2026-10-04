import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DEMO_CARDS, DEMO_LISTS, DEMO_TAGS } from './demo.mjs';

export class StoreError extends Error {
  constructor(message, status = 400, code = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'StoreError';
    this.status = status;
    this.code = code;
  }
}

const stages = new Set(['contact', 'evaluation', 'rampUp', 'massProduction', 'legacy']);
// Old "client" describes an account relationship, not confirmed production.
const legacyStages = { lead: 'contact', contacted: 'contact', qualified: 'evaluation', proposal: 'evaluation', client: 'contact' };
const normalizeStage = value => legacyStages[value] || value;
const listByAccountType = { lead: ['Leads'], unspecified: ['Prospects', 'Потенциальные'], opportunity: ['Opportunities'], client: ['Customers', 'Клиенты'], partner: ['Partners', 'Партнеры'], distributor: ['Agents', 'Distributors', 'Дистрибьюторы'] };
const permanentOrder = ['Leads', 'Prospects', 'Opportunities', 'Customers', 'Partners', 'Agents'];
const permanentColors = ['#D65C59', '#DC913D', '#C4AA35', '#4E9F69', '#4C83CB', '#9765CE'];
const permanentLists = new Set(Object.values(listByAccountType).flat());
const typeForList = name => Object.entries(listByAccountType).find(([, names]) => names.includes(name))?.[0];
const canonicalListName = name => listByAccountType[typeForList(name)]?.[0] || name;
const tagCategories = new Set(['Countries', 'Time', 'Product', 'Stage', 'Application', 'Other']);
export const contactStatuses = ['active', 'main', 'inactive', 'disturbing', 'useful', 'decisions'];
export const flagKeys = ['inQuote', 'logisticsIssue', 'administrativeIssue', 'swIssue', 'hwIssue'];
const flagLabels = { inQuote: 'In quote', logisticsIssue: 'Logistics issue', administrativeIssue: 'Administrative issue', swIssue: 'SW issue', hwIssue: 'HW issue' };
const textFields = { title: 300, description: 50000, company: 300, country: 120, secondaryCountry: 120, contactName: 300, email: 320 };
const writableFields = new Set([...Object.keys(textFields), 'listId', 'lastContact', 'contactQuarter', 'dueDate', 'status', 'priority', 'completed', 'starred', 'archived', 'tagIds', 'checklist', 'contacts', 'flags', 'accountType', 'distributorIds']);
const requireObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new StoreError('Expected an object with fields.');
};
const string = (value, label, max = 300, required = false) => {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new StoreError(`Invalid field “${label}”.`);
  return value.trim();
};
const date = (value, label) => {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) throw new StoreError(`«${label}»: expected a date in YYYY-MM-DD format.`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new StoreError(`«${label}»: this date does not exist.`);
  return value;
};
export function quarterTag(lastContact) {
  if (!lastContact) return null;
  const year = Number(lastContact.slice(0, 4));
  const name = `${year}-${Math.ceil(Number(lastContact.slice(5, 7)) / 3)}`;
  return { id: `quarter:${name}`, name, color: year >= 2026 ? '#36c96b' : year === 2025 ? '#88b66d' : year === 2024 ? '#e6a64b' : '#e27370', category: 'Time' };
}

export function createStore({ path = resolve('data/leader.sqlite'), seed = true } = {}) {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new DatabaseSync(path);
  db.function('leader_lower', { deterministic: true }, value => String(value ?? '').toLocaleLowerCase('ru'));
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS lists (id TEXT PRIMARY KEY, name TEXT NOT NULL COLLATE NOCASE UNIQUE, color TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS tags (id TEXT PRIMARY KEY, name TEXT NOT NULL COLLATE NOCASE UNIQUE, color TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY, list_id TEXT NOT NULL REFERENCES lists(id), title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '', company TEXT NOT NULL DEFAULT '', country TEXT NOT NULL DEFAULT '',
      contact_name TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', last_contact TEXT, due_date TEXT,
      status TEXT NOT NULL DEFAULT 'lead' CHECK(status IN ('lead','contacted','qualified','proposal','client')),
      priority INTEGER NOT NULL DEFAULT 0 CHECK(priority BETWEEN 0 AND 3),
      completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)), starred INTEGER NOT NULL DEFAULT 0 CHECK(starred IN (0,1)),
      archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)), version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS card_tags (card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE, tag_id TEXT NOT NULL REFERENCES tags(id), position INTEGER NOT NULL, PRIMARY KEY(card_id, tag_id));
    CREATE TABLE IF NOT EXISTS checklist_items (id TEXT PRIMARY KEY, card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE, text TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, position INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS activity (id TEXT PRIMARY KEY, card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE, text TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS card_flags (card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE, kind TEXT NOT NULL CHECK(kind IN ('inQuote','logisticsIssue','administrativeIssue','swIssue','hwIssue')), active INTEGER NOT NULL CHECK(active IN (0,1)), comment TEXT NOT NULL DEFAULT '', activated_at TEXT, PRIMARY KEY(card_id,kind));
    CREATE INDEX IF NOT EXISTS idx_flags_active ON card_flags(kind,active,card_id);
    CREATE INDEX IF NOT EXISTS idx_cards_list_active_updated ON cards(list_id, archived, completed, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_cards_contact ON cards(archived, last_contact DESC);
    CREATE INDEX IF NOT EXISTS idx_cards_starred ON cards(archived, starred, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_cards_title ON cards(archived, title COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_tags_card ON card_tags(tag_id, card_id);
    CREATE INDEX IF NOT EXISTS idx_checklist_card ON checklist_items(card_id, position);
    CREATE INDEX IF NOT EXISTS idx_activity_card ON activity(card_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS card_distributors (client_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE, distributor_id TEXT NOT NULL REFERENCES cards(id), PRIMARY KEY(client_id,distributor_id), CHECK(client_id<>distributor_id));
    CREATE INDEX IF NOT EXISTS idx_distributor_clients ON card_distributors(distributor_id,client_id);
  `);
  if (!db.prepare('PRAGMA table_info(tags)').all().some(column => column.name === 'category')) db.exec('ALTER TABLE tags ADD COLUMN category TEXT');
  if (!db.prepare('PRAGMA table_info(cards)').all().some(column => column.name === 'account_type')) db.exec("ALTER TABLE cards ADD COLUMN account_type TEXT NOT NULL DEFAULT 'unspecified' CHECK(account_type IN ('unspecified','client','distributor','partner'))");
  if (!db.prepare('PRAGMA table_info(cards)').all().some(column => column.name === 'contact_quarter')) db.exec('ALTER TABLE cards ADD COLUMN contact_quarter TEXT');
  const cardColumns = db.prepare('PRAGMA table_info(cards)').all().map(c => c.name);
  if (!cardColumns.includes('secondary_country')) db.exec("ALTER TABLE cards ADD COLUMN secondary_country TEXT NOT NULL DEFAULT ''");
  if (!cardColumns.includes('starred_at')) db.exec('ALTER TABLE cards ADD COLUMN starred_at TEXT');
  if (!db.prepare('PRAGMA table_info(card_flags)').all().some(c => c.name === 'activated_at')) db.exec('ALTER TABLE card_flags ADD COLUMN activated_at TEXT');
  // SQLite CHECK constraints require rebuilding this child table. Keep all flag
  // values and activation dates, and commit the schema change atomically.
  db.exec('BEGIN IMMEDIATE');
  try {
    const flagSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='card_flags'").get().sql;
    if (!flagSchema.includes("'swIssue'")) {
      db.exec(`CREATE TABLE card_flags_v6 (
        card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK(kind IN ('inQuote','logisticsIssue','administrativeIssue','swIssue','hwIssue')),
        active INTEGER NOT NULL CHECK(active IN (0,1)), comment TEXT NOT NULL DEFAULT '', activated_at TEXT,
        PRIMARY KEY(card_id,kind));
        INSERT INTO card_flags_v6(card_id,kind,active,comment,activated_at)
          SELECT card_id,kind,active,comment,activated_at FROM card_flags;
        DROP TABLE card_flags;
        ALTER TABLE card_flags_v6 RENAME TO card_flags;
        CREATE INDEX idx_flags_active ON card_flags(kind,active,card_id);`);
    }
    if (!cardColumns.includes('contacts')) {
      db.exec(`ALTER TABLE cards ADD COLUMN contacts TEXT NOT NULL DEFAULT '[]';
        UPDATE cards SET contacts=json_array(json_object('id',lower(hex(randomblob(16))), 'name',contact_name,'role','','email',email,'status','active'))
        WHERE contact_name<>'' OR email<>'';`);
    }
    if (!db.prepare('PRAGMA table_info(activity)').all().some(c => c.name === 'contacts')) {
      db.exec("ALTER TABLE activity ADD COLUMN contacts TEXT NOT NULL DEFAULT '[]'");
      const migrate = db.prepare('UPDATE cards SET contacts=? WHERE id=?');
      for (const row of db.prepare('SELECT id,contacts FROM cards').all()) {
        migrate.run(JSON.stringify(JSON.parse(row.contacts).map(contact => ({...contact, status:contact.status || 'active'}))), row.id);
      }
    }
    if (!db.prepare('PRAGMA table_info(cards)').all().some(c => c.name === 'imported_pending')) {
      db.exec('ALTER TABLE cards ADD COLUMN imported_pending INTEGER NOT NULL DEFAULT 0 CHECK(imported_pending IN (0,1))');
    }
    if (!db.prepare('PRAGMA table_info(activity)').all().some(c => c.name === 'kind')) {
      db.exec("ALTER TABLE activity ADD COLUMN kind TEXT NOT NULL DEFAULT 'note' CHECK(kind IN ('note','flag'))");
    }
    const cardSchema = db.prepare("SELECT sql FROM sqlite_master WHERE name='cards'").get().sql;
    if (!cardSchema.includes("'opportunity'")) {
      // Add a new constrained column without rebuilding the referenced parent table.
      db.exec(`ALTER TABLE cards RENAME COLUMN account_type TO legacy_account_type;
        ALTER TABLE cards ADD COLUMN account_type TEXT NOT NULL DEFAULT 'unspecified'
          CHECK(account_type IN ('lead','unspecified','opportunity','client','partner','distributor'));
        UPDATE cards SET account_type=legacy_account_type;`);
    }
    const activitySchema = db.prepare("SELECT sql FROM sqlite_master WHERE name='activity'").get().sql;
    if (!activitySchema.includes("'list'")) {
      db.exec(`CREATE TABLE activity_v11 (id TEXT PRIMARY KEY, card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        text TEXT NOT NULL, created_at TEXT NOT NULL, contacts TEXT NOT NULL DEFAULT '[]',
        kind TEXT NOT NULL DEFAULT 'note' CHECK(kind IN ('note','flag','list')));
        INSERT INTO activity_v11 SELECT id,card_id,text,created_at,contacts,kind FROM activity;
        DROP TABLE activity; ALTER TABLE activity_v11 RENAME TO activity;
        CREATE INDEX idx_activity_card ON activity(card_id,created_at DESC);`);
    }
    if (!cardSchema.includes("'massProduction'")) {
      db.exec(`ALTER TABLE cards RENAME COLUMN status TO legacy_status;
        ALTER TABLE cards ADD COLUMN status TEXT NOT NULL DEFAULT 'contact'
          CHECK(status IN ('contact','evaluation','rampUp','massProduction','legacy'));
        UPDATE cards SET status=CASE legacy_status WHEN 'qualified' THEN 'evaluation' WHEN 'proposal' THEN 'evaluation' ELSE 'contact' END;`);
    }
    db.exec('PRAGMA user_version=12; COMMIT');
  } catch (error) { db.exec('ROLLBACK'); db.close(); throw error; }
  const statements = new Map();
  const sql = (query) => {
    if (!statements.has(query)) statements.set(query, db.prepare(query));
    return statements.get(query);
  };
  let transactionDepth = 0;
  const transaction = (operation) => {
    if (transactionDepth) return operation();
    db.exec('BEGIN IMMEDIATE');
    transactionDepth++;
    try { const result = operation(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
    finally { transactionDepth--; }
  };
  const findCard = (id) => {
    string(id, 'id', 100, true);
    const row = sql('SELECT * FROM cards WHERE id=?').get(id);
    if (!row) throw new StoreError('Card not found.', 404, 'NOT_FOUND');
    return row;
  };
  const hydrate = (row) => {
    const tags = sql('SELECT t.id,t.name,t.color FROM card_tags ct JOIN tags t ON t.id=ct.tag_id WHERE ct.card_id=? ORDER BY ct.position').all(row.id);
    const quarter = quarterTag(row.last_contact || (row.contact_quarter ? `${row.contact_quarter.slice(0,4)}-${String(Number(row.contact_quarter.slice(-1))*3).padStart(2,'0')}-01` : null));
    return {
      id: row.id, listId: row.list_id, title: row.title, description: row.description,
      company: row.company, country: row.country, secondaryCountry: row.secondary_country, contactName: row.contact_name, email: row.email,
      contacts: JSON.parse(row.contacts),
      accountType: row.account_type,
      distributorIds: sql('SELECT distributor_id AS id FROM card_distributors WHERE client_id=? ORDER BY distributor_id').all(row.id).map(x => x.id),
      distributors: sql('SELECT c.id,c.title,c.country,c.archived FROM card_distributors d JOIN cards c ON c.id=d.distributor_id WHERE d.client_id=? ORDER BY c.title').all(row.id).map(c => ({ ...c, archived: Boolean(c.archived) })),
      clientCount: sql('SELECT COUNT(*) AS n FROM card_distributors d JOIN cards c ON c.id=d.client_id WHERE d.distributor_id=? AND c.archived=0').get(row.id).n,
      lastContact: row.last_contact, contactQuarter: row.contact_quarter, dueDate: row.due_date, status: row.status, priority: row.priority,
      completed: Boolean(row.completed), starred: Boolean(row.starred), starredAt: row.starred_at, archived: Boolean(row.archived), importedPending: Boolean(row.imported_pending),
      version: row.version, createdAt: row.created_at, updatedAt: row.updated_at,
      tags: quarter ? [quarter, ...tags] : tags,
      flags: Object.fromEntries(flagKeys.map(kind => {
        const flag = sql('SELECT active,comment,activated_at FROM card_flags WHERE card_id=? AND kind=?').get(row.id, kind);
        return [kind, { active: Boolean(flag?.active), comment: flag?.comment || '', activatedAt: flag?.activated_at || null }];
      })),
      checklist: sql('SELECT id,text,done FROM checklist_items WHERE card_id=? ORDER BY position').all(row.id).map(item => ({ ...item, done: Boolean(item.done) })),
      activity: sql('SELECT id,text,created_at AS createdAt,contacts,kind FROM activity WHERE card_id=? ORDER BY created_at DESC,id DESC').all(row.id).map(entry => ({...entry, contacts:JSON.parse(entry.contacts)})),
    };
  };
  const validate = (input, creating = false) => {
    requireObject(input);
    for (const key of Object.keys(input)) if (!writableFields.has(key) && !(key === 'version' && !creating)) throw new StoreError(`Unknown field “${key}”.`);
    const result = {};
    if ('contactQuarter' in input) {
      if (input.contactQuarter !== null && !/^[1-9]\d{3}-[1-4]$/.test(input.contactQuarter)) throw new StoreError('Contact quarter must be YYYY-Q or null.');
      result.contactQuarter = input.contactQuarter;
    }
    if ('accountType' in input) {
      if (!Object.hasOwn(listByAccountType, input.accountType)) throw new StoreError('Invalid account type.');
      result.accountType = input.accountType;
    }
    if ('distributorIds' in input) {
      if (!Array.isArray(input.distributorIds) || input.distributorIds.length > 20) throw new StoreError('At most 20 distributor links are allowed.');
      result.distributorIds = [...new Set(input.distributorIds.map(id => string(id, 'distributorId', 100, true)))];
      for (const id of result.distributorIds) {
        const target = findCard(id);
        if (!['distributor', 'partner'].includes(target.account_type)) throw new StoreError('The linked card must be a distributor or partner.');
      }
    }
    if (creating && (!('title' in input) || !('listId' in input))) throw new StoreError('A name and list are required.');
    for (const [key, max] of Object.entries(textFields)) if (key in input) result[key] = string(input[key], key, max, key === 'title');
    if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) throw new StoreError('Invalid email address.');
    if ('contacts' in input) {
      if (!Array.isArray(input.contacts) || input.contacts.length > 100) throw new StoreError('Up to 100 contacts are allowed.');
      const seen = new Set();
      result.contacts = input.contacts.map(contact => {
        requireObject(contact);
        if (Object.keys(contact).some(key => !['id', 'name', 'role', 'email', 'status'].includes(key))) throw new StoreError('Unknown contact field.');
        const id = contact.id === undefined ? randomUUID() : string(contact.id, 'contact.id', 100, true);
        if (seen.has(id)) throw new StoreError('Contact IDs must be unique.');
        seen.add(id);
        const name = string(contact.name ?? '', 'contact.name', 300);
        const role = string(contact.role ?? '', 'contact.role', 500);
        const email = string(contact.email ?? '', 'contact.email', 320);
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new StoreError('Invalid contact email address.');
        const status = contact.status ?? 'active';
        if (!contactStatuses.includes(status)) throw new StoreError('Unknown contact status.');
        return { id, name, role, email, status };
      }).filter(contact => contact.name || contact.role || contact.email);
    }
    if ('listId' in input) {
      result.listId = string(input.listId, 'listId', 100, true);
      if (!sql('SELECT id FROM lists WHERE id=?').get(result.listId)) throw new StoreError('List not found.', 404, 'NOT_FOUND');
    }
    for (const key of ['lastContact', 'dueDate']) if (key in input) result[key] = date(input[key], key);
    if ('status' in input) {
      if (!stages.has(normalizeStage(input.status))) throw new StoreError('Unknown project stage.');
      result.status = normalizeStage(input.status);
    }
    if ('priority' in input) {
      if (!Number.isInteger(input.priority) || input.priority < 0 || input.priority > 3) throw new StoreError('Priority must be between 0 and 3.');
      result.priority = input.priority;
    }
    for (const key of ['completed', 'starred', 'archived']) if (key in input) {
      if (typeof input[key] !== 'boolean') throw new StoreError(`«${key}» must be a boolean.`);
      result[key] = input[key];
    }
    if ('tagIds' in input) {
      if (!Array.isArray(input.tagIds) || input.tagIds.length > 50) throw new StoreError('Up to 50 tags are allowed.');
      result.tagIds = [...new Set(input.tagIds.map(id => string(id, 'tagId', 100, true)))];
      for (const id of result.tagIds) if (!sql('SELECT id FROM tags WHERE id=?').get(id)) throw new StoreError('Tag not found; quarter tags are calculated automatically.');
    }
    if ('checklist' in input) {
      if (!Array.isArray(input.checklist) || input.checklist.length > 100) throw new StoreError('Up to 100 checklist items are allowed.');
      const seenIds = new Set();
      result.checklist = input.checklist.map(item => {
        requireObject(item);
        const id = item.id === undefined ? randomUUID() : string(item.id, 'checklist.id', 100, true);
        if (seenIds.has(id)) throw new StoreError('Checklist item IDs must be unique.');
        seenIds.add(id);
        if (item.done !== undefined && typeof item.done !== 'boolean') throw new StoreError('Checklist item state must be a boolean.');
        return { id, text: string(item.text, 'checklist.text', 2000, true), done: item.done ?? false };
      });
    }
    if ('flags' in input) {
      requireObject(input.flags);
      result.flags = {};
      for (const [kind, flag] of Object.entries(input.flags)) {
        if (!flagKeys.includes(kind)) throw new StoreError('Unknown flag.');
        requireObject(flag);
        if (Object.keys(flag).some(key => !['active', 'comment'].includes(key)) || typeof flag.active !== 'boolean') throw new StoreError('Invalid flag.');
        const comment = string(flag.comment ?? '', 'flag.comment', 300);
        if (/[\r\n]/.test(comment)) throw new StoreError('Flag comment must be one line.');
        result.flags[kind] = { active: flag.active, comment };
      }
    }
    return result;
  };
  const saveCollections = (id, value) => {
    if ('contacts' in value || 'contactName' in value || 'email' in value) {
      const row = findCard(id);
      let contacts = value.contacts;
      if (!contacts) {
        contacts = JSON.parse(row.contacts);
        const first = contacts[0] || { id: randomUUID(), name: '', role: '', email: '', status: 'active' };
        contacts = [{ ...first, name: row.contact_name, email: row.email }, ...contacts.slice(1)]
          .filter(contact => contact.name || contact.role || contact.email);
      }
      sql('UPDATE cards SET contacts=?,contact_name=?,email=? WHERE id=?')
        .run(JSON.stringify(contacts), contacts[0]?.name || '', contacts[0]?.email || '', id);
    }
    if (value.accountType && !['distributor', 'partner'].includes(value.accountType) && sql('SELECT 1 FROM card_distributors WHERE distributor_id=? LIMIT 1').get(id)) throw new StoreError('Remove linked clients before changing this partner account type.');
    if (value.distributorIds) {
      for (const target of value.distributorIds) {
        if (id === target || sql('WITH RECURSIVE upstream(id) AS (SELECT distributor_id FROM card_distributors WHERE client_id=? UNION SELECT d.distributor_id FROM card_distributors d JOIN upstream u ON d.client_id=u.id) SELECT 1 FROM upstream WHERE id=? LIMIT 1').get(target, id)) throw new StoreError('Distributor links cannot form a cycle.');
      }
      sql('DELETE FROM card_distributors WHERE client_id=?').run(id);
      for (const target of value.distributorIds) sql('INSERT INTO card_distributors(client_id,distributor_id) VALUES(?,?)').run(id, target);
    }
    if (value.flags) for (const [kind, flag] of Object.entries(value.flags)) {
      const previous = sql('SELECT active,activated_at FROM card_flags WHERE card_id=? AND kind=?').get(id, kind);
      const activatedAt = flag.active && !previous?.active ? new Date().toISOString() : previous?.activated_at || null;
      sql('INSERT INTO card_flags(card_id,kind,active,comment,activated_at) VALUES(?,?,?,?,?) ON CONFLICT(card_id,kind) DO UPDATE SET active=excluded.active,comment=excluded.comment,activated_at=excluded.activated_at').run(id, kind, Number(flag.active), flag.comment, activatedAt);
    }
    if (value.tagIds) {
      sql('DELETE FROM card_tags WHERE card_id=?').run(id);
      value.tagIds.forEach((tagId, index) => sql('INSERT INTO card_tags(card_id,tag_id,position) VALUES(?,?,?)').run(id, tagId, index));
    }
    if (value.checklist) {
      // Reject foreign checklist IDs before replacing any collection.
      for (const item of value.checklist) {
        const other = sql('SELECT card_id FROM checklist_items WHERE id=?').get(item.id);
        if (other && other.card_id !== id) throw new StoreError('This checklist item belongs to another card.');
      }
      sql('DELETE FROM checklist_items WHERE card_id=?').run(id);
      value.checklist.forEach((item, index) => sql('INSERT INTO checklist_items(id,card_id,text,done,position) VALUES(?,?,?,?,?)').run(item.id, id, item.text, Number(item.done), index));
    }
  };
  const checkVersion = (row, version) => {
    if (!Number.isInteger(version) || version < 1) throw new StoreError('The current card version is required for changes.');
    if (version !== row.version) throw new StoreError('This card has changed. Refresh it and try again.', 409, 'VERSION_CONFLICT');
  };
  const columns = { listId: 'list_id', title: 'title', description: 'description', company: 'company', country: 'country', secondaryCountry: 'secondary_country', contactName: 'contact_name', email: 'email', lastContact: 'last_contact', contactQuarter: 'contact_quarter', dueDate: 'due_date', status: 'status', priority: 'priority', completed: 'completed', starred: 'starred', archived: 'archived', accountType: 'account_type' };
  // Shared by paginated cards and full-result geography.
  const cardFilter = (query = {}) => {
    requireObject(query);
    const where = ['c.archived=0'];
    const args = [];
    const view = query.view || 'all';
    if (!['all', 'active', 'completed', 'starred', ...flagKeys].includes(view)) throw new StoreError('Unknown card filter.');
    if (view === 'active') where.push('EXISTS (SELECT 1 FROM card_flags f WHERE f.card_id=c.id AND f.active=1)');
    if (flagKeys.includes(view)) { where.push('EXISTS (SELECT 1 FROM card_flags f WHERE f.card_id=c.id AND f.kind=? AND f.active=1)'); args.push(view); }
    if (view === 'completed') where.push('c.completed=1');
    if (view === 'starred') where.push('c.starred=1');
    if (query.status !== undefined && query.status !== '') {
      if (!stages.has(normalizeStage(query.status))) throw new StoreError('Unknown project stage.');
      where.push('c.status=?'); args.push(normalizeStage(query.status));
    }
    if (query.priority !== undefined && query.priority !== '') {
      const priority = typeof query.priority === 'string' && /^[0-3]$/.test(query.priority) ? Number(query.priority) : query.priority;
      if (!Number.isInteger(priority) || priority < 0 || priority > 3) throw new StoreError('Invalid priority filter.');
      where.push('c.priority=?'); args.push(priority);
    }
    if (query.listId) { where.push('c.list_id=?'); args.push(string(query.listId, 'listId', 100, true)); }
    if (query.country) { where.push('(leader_lower(c.country)=? OR leader_lower(c.secondary_country)=?)'); const country=string(query.country,'country',120,true).toLocaleLowerCase('ru'); args.push(country,country); }
    if (query.distributorId) { where.push('EXISTS (SELECT 1 FROM card_distributors d WHERE d.client_id=c.id AND d.distributor_id=?)'); args.push(string(query.distributorId, 'distributorId', 100, true)); }
    if (query.accountType === 'channel') where.push("c.account_type IN ('distributor','partner')");
    else if (query.accountType) {
      if (!Object.hasOwn(listByAccountType, query.accountType)) throw new StoreError('Invalid account type filter.');
      where.push('c.account_type=?'); args.push(query.accountType);
    }
    if (query.tag) {
      const tag = string(query.tag, 'tag', 100, true);
      if (tag.startsWith('quarter:')) {
        const match = /^quarter:([1-9]\d{3})-([1-4])$/.exec(tag);
        if (!match) throw new StoreError('Invalid quarter tag.');
        const startMonth = (Number(match[2]) - 1) * 3 + 1;
        const start = `${match[1]}-${String(startMonth).padStart(2, '0')}-01`;
        const lastMonth = startMonth + 2;
        const lastDay = lastMonth === 3 || lastMonth === 12 ? 31 : 30;
        const end = `${match[1]}-${String(lastMonth).padStart(2, '0')}-${lastDay}`;
        where.push('((c.last_contact>=? AND c.last_contact<=?) OR (c.last_contact IS NULL AND c.contact_quarter=?))'); args.push(start, end, `${match[1]}-${match[2]}`);
      } else { where.push('EXISTS (SELECT 1 FROM card_tags ct WHERE ct.card_id=c.id AND ct.tag_id=?)'); args.push(tag); }
    }
    if (query.q) {
      const search = string(query.q, 'q', 200).toLocaleLowerCase('ru').replace(/[\\%_]/g, '\\$&');
      where.push(`(leader_lower(c.title) LIKE ? ESCAPE '\\' OR leader_lower(c.company) LIKE ? ESCAPE '\\' OR leader_lower(c.country) LIKE ? ESCAPE '\\' OR leader_lower(c.secondary_country) LIKE ? ESCAPE '\\' OR leader_lower(c.contact_name) LIKE ? ESCAPE '\\' OR leader_lower(c.email) LIKE ? ESCAPE '\\' OR leader_lower(c.description) LIKE ? ESCAPE '\\' OR EXISTS(SELECT 1 FROM card_flags f WHERE f.card_id=c.id AND leader_lower(f.comment) LIKE ? ESCAPE '\\') OR EXISTS(SELECT 1 FROM card_tags ct JOIN tags t ON t.id=ct.tag_id WHERE ct.card_id=c.id AND leader_lower(t.name) LIKE ? ESCAPE '\\') OR EXISTS(SELECT 1 FROM json_each(c.contacts) person WHERE leader_lower(json_extract(person.value,'$.name')) LIKE ? ESCAPE '\\' OR leader_lower(json_extract(person.value,'$.role')) LIKE ? ESCAPE '\\' OR leader_lower(json_extract(person.value,'$.email')) LIKE ? ESCAPE '\\'))`);
      for (let i = 0; i < 12; i++) args.push(`%${search}%`);
    }
    return { condition: where.join(' AND '), args };
  };
  const service = {
    // Local migration scripts use the same validation and one atomic transaction.
    transaction(operation) { return transaction(operation); },
    getCard(id) { return hydrate(findCard(id)); },
    createCard(input, restoredId) {
      return transaction(() => {
        const value = validate(input, true);
        value.accountType ??= typeForList(sql('SELECT name FROM lists WHERE id=?').get(value.listId).name);
        const id = restoredId === undefined ? randomUUID() : string(restoredId, 'card.id', 100, true);
        const now = new Date().toISOString();
        sql(`INSERT INTO cards(id,list_id,title,description,company,country,contact_name,email,last_contact,due_date,status,priority,completed,starred,archived,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, value.listId, value.title, value.description ?? '', value.company ?? '', value.country ?? '', value.contactName ?? '', value.email ?? '', value.lastContact ?? null, value.dueDate ?? null, value.status ?? 'contact', value.priority ?? 0, Number(value.completed ?? false), Number(value.starred ?? false), Number(value.archived ?? false), now, now);
        if (value.accountType) sql('UPDATE cards SET account_type=? WHERE id=?').run(value.accountType, id);
        if (value.contactQuarter) sql('UPDATE cards SET contact_quarter=? WHERE id=?').run(value.contactQuarter, id);
        if (value.secondaryCountry) sql('UPDATE cards SET secondary_country=? WHERE id=?').run(value.secondaryCountry, id);
        if (value.starred) sql('UPDATE cards SET starred_at=? WHERE id=?').run(now, id);
        saveCollections(id, value);
        return service.getCard(id);
      });
    },
    updateCard(id, input) {
      return transaction(() => {
        requireObject(input);
        const row = findCard(id);
        checkVersion(row, input.version);
        const { flagEvents, listEvents, ...cardInput } = input;
        const value = validate(cardInput);
        const previousFlags = Object.fromEntries(flagKeys.map(kind => [kind, Boolean(sql('SELECT active FROM card_flags WHERE card_id=? AND kind=?').get(id, kind)?.active)]));
        const transitions = [];
        if (flagEvents !== undefined) {
          if (!Array.isArray(flagEvents) || flagEvents.length > 100) throw new StoreError('Invalid flag history.');
          const states = { ...previousFlags };
          for (const event of flagEvents) {
            requireObject(event);
            if (!flagKeys.includes(event.kind) || typeof event.active !== 'boolean' || states[event.kind] === event.active) throw new StoreError('Invalid flag transition.');
            const comment = string(event.comment ?? '', 'flag comment', 300);
            if (/[\r\n]/.test(comment)) throw new StoreError('Flag comment must be one line.');
            const happenedAt = string(event.happenedAt, 'flag date', 40, true);
            if (!/^\d{4}-\d\d-\d\dT/.test(happenedAt) || !Number.isFinite(Date.parse(happenedAt))) throw new StoreError('Invalid flag date.');
            transitions.push({ kind: event.kind, active: event.active, comment, happenedAt });
            states[event.kind] = event.active;
          }
          for (const kind of flagKeys) if (states[kind] !== (value.flags?.[kind]?.active ?? previousFlags[kind])) throw new StoreError('Flag history does not match the saved flags.');
        } else if (value.flags) {
          for (const [kind, flag] of Object.entries(value.flags)) if (flag.active !== previousFlags[kind]) transitions.push({ kind, active: flag.active, comment: flag.comment, happenedAt: new Date().toISOString() });
        }
        if (value.listId && (value.listId !== row.list_id || (Array.isArray(listEvents) && listEvents.length))) {
          const targetType = typeForList(sql('SELECT name FROM lists WHERE id=?').get(value.listId).name);
          if (targetType && value.accountType && value.accountType !== row.account_type && value.accountType !== targetType) throw new StoreError('Account category does not match the target list.');
          value.accountType = targetType || value.accountType || row.account_type;
        } else if (value.accountType && value.accountType !== row.account_type) {
          const target = listByAccountType[value.accountType].map(name => sql('SELECT id FROM lists WHERE name=? COLLATE NOCASE').get(name)).find(Boolean);
          if (target) value.listId = target.id;
        }
        const moves = [];
        const finalList = value.listId || row.list_id;
        if (listEvents !== undefined) {
          if (!Array.isArray(listEvents) || listEvents.length > 100) throw new StoreError('Invalid list history.');
          let current = row.list_id;
          for (const event of listEvents) {
            requireObject(event);
            if (event.fromListId !== current || event.toListId === current || !sql('SELECT id FROM lists WHERE id=?').get(string(event.toListId, 'toListId', 100, true))) throw new StoreError('Invalid list transition.');
            const happenedAt = string(event.happenedAt, 'list date', 40, true);
            if (!/^\d{4}-\d\d-\d\dT/.test(happenedAt) || !Number.isFinite(Date.parse(happenedAt))) throw new StoreError('Invalid list date.');
            moves.push({ fromListId: current, toListId: event.toListId, happenedAt });
            current = event.toListId;
          }
          if (current !== finalList) throw new StoreError('List history does not match the saved list.');
        } else if (finalList !== row.list_id) moves.push({ fromListId: row.list_id, toListId: finalList, happenedAt: new Date().toISOString() });
        const entries = Object.entries(value).filter(([key]) => key in columns);
        const clause = entries.map(([key]) => `${columns[key]}=?`);
        const args = entries.map(([, val]) => typeof val === 'boolean' ? Number(val) : val);
        clause.push('version=version+1', 'imported_pending=0', 'updated_at=?');
        sql(`UPDATE cards SET ${clause.join(',')} WHERE id=?`).run(...args, new Date().toISOString(), id);
        if (value.starred === true && !row.starred) sql('UPDATE cards SET starred_at=? WHERE id=?').run(new Date().toISOString(), id);
        saveCollections(id, value);
        for (const event of transitions) {
          const text = `${flagLabels[event.kind]} ${event.active ? 'enabled' : 'disabled'}\nComment: ${event.comment || '—'}`;
          sql("INSERT INTO activity(id,card_id,text,created_at,contacts,kind) VALUES(?,?,?,?,'[]','flag')").run(randomUUID(), id, text, event.happenedAt);
        }
        for (const event of moves) {
          const from = canonicalListName(sql('SELECT name FROM lists WHERE id=?').get(event.fromListId).name);
          const to = canonicalListName(sql('SELECT name FROM lists WHERE id=?').get(event.toListId).name);
          sql("INSERT INTO activity(id,card_id,text,created_at,contacts,kind) VALUES(?,?,?,?,'[]','list')")
            .run(randomUUID(), id, `${from} → ${to}`, event.happenedAt);
        }
        return service.getCard(id);
      });
    },
    syncContactQuarters() {
      return transaction(() => {
        const rows = sql("SELECT id,last_contact AS lastContact,contact_quarter AS contactQuarter FROM cards WHERE last_contact IS NOT NULL AND last_contact<>''").all();
        const update = sql('UPDATE cards SET contact_quarter=?,version=version+1,updated_at=? WHERE id=?');
        const now = new Date().toISOString();
        let updated = 0;
        for (const row of rows) {
          const quarter = `${row.lastContact.slice(0, 4)}-${Math.ceil(Number(row.lastContact.slice(5, 7)) / 3)}`;
          if (row.contactQuarter !== quarter) { update.run(quarter, now, row.id); updated++; }
        }
        return { updated, examined: rows.length };
      });
    },
    addComment(id, input) {
      return transaction(() => {
        requireObject(input);
        const row = findCard(id);
        checkVersion(row, input.version);
        const text = string(input.text, 'text', 10000, true);
        const now = new Date().toISOString();
        if (!Array.isArray(input.contactIds) || !input.contactIds.length || input.contactIds.length > 100) throw new StoreError('Select at least one contact for the history entry.');
        const available = JSON.parse(row.contacts);
        const contacts = [...new Set(input.contactIds.map(value => string(value, 'contactId', 100, true)))].map(contactId => {
          const contact = available.find(person => person.id === contactId);
          if (!contact) throw new StoreError('Contact not found on this card.');
          return contact;
        });
        sql('INSERT INTO activity(id,card_id,text,created_at,contacts) VALUES(?,?,?,?,?)').run(randomUUID(), id, text, now, JSON.stringify(contacts));
        sql('UPDATE cards SET version=version+1,imported_pending=0,updated_at=? WHERE id=?').run(now, id);
        return service.getCard(id);
      });
    },
    createList(input) { return createNamed('lists', input); },
    ensurePermanentLists() {
      return transaction(() => {
        for (const [type, names] of Object.entries(listByAccountType)) {
          let canonical = sql('SELECT id,name FROM lists WHERE name=? COLLATE NOCASE').get(names[0]);
          for (const alias of names.slice(1)) {
            const old = sql('SELECT id FROM lists WHERE name=? COLLATE NOCASE').get(alias);
            if (!old) continue;
            if (canonical) {
              sql('UPDATE cards SET list_id=? WHERE list_id=?').run(canonical.id, old.id);
              sql('DELETE FROM lists WHERE id=?').run(old.id);
            } else {
              sql('UPDATE lists SET name=? WHERE id=?').run(names[0], old.id);
              canonical = { id: old.id, name: names[0] };
            }
          }
          const index = permanentOrder.indexOf(names[0]);
          canonical ||= service.createList({ name: names[0], color: permanentColors[index] });
          sql('UPDATE lists SET color=? WHERE id=?').run(permanentColors[index], canonical.id);
          sql('UPDATE cards SET account_type=? WHERE list_id=? AND account_type<>?').run(type, canonical.id, type);
        }
      });
    },
    createTag(input) { return createNamed('tags', input); },
    updateTag(id, input) {
      requireObject(input);
      if (!tagCategories.has(input.category)) throw new StoreError('Unknown tag group.');
      return transaction(() => {
        if (!sql('SELECT id FROM tags WHERE id=?').get(id)) throw new StoreError('Tag not found.', 404, 'NOT_FOUND');
        sql('UPDATE tags SET category=? WHERE id=?').run(input.category, id);
        return sql('SELECT id,name,color,category FROM tags WHERE id=?').get(id);
      });
    },
    deleteList(id) {
      return transaction(() => {
        const list = sql('SELECT id,name FROM lists WHERE id=?').get(id);
        if (!list) throw new StoreError('List not found.', 404, 'NOT_FOUND');
        if (permanentLists.has(list.name)) throw new StoreError('This permanent list cannot be deleted.', 409, 'PERMANENT_LIST');
        if (sql('SELECT 1 FROM cards WHERE list_id=? LIMIT 1').get(id)) throw new StoreError('Move the cards out of this list first.', 409, 'LIST_NOT_EMPTY');
        sql('DELETE FROM lists WHERE id=?').run(id);
        return { id };
      });
    },
    deleteTag(id) {
      return transaction(() => {
        if (!sql('SELECT id FROM tags WHERE id=?').get(id)) throw new StoreError('Tag not found.', 404, 'NOT_FOUND');
        sql('DELETE FROM card_tags WHERE tag_id=?').run(id);
        sql('DELETE FROM tags WHERE id=?').run(id);
        return { id };
      });
    },
    listCards(query = {}) {
      requireObject(query);
      const integer = (value, fallback, min, max, label) => {
        if (value === undefined || value === '') return fallback;
        const result = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
        if (!Number.isSafeInteger(result) || result < min || result > max) throw new StoreError(`Invalid value ${label}.`);
        return result;
      };
      const limit = integer(query.limit, 100, 1, 200, 'limit');
      const offset = integer(query.offset, 0, 0, Number.MAX_SAFE_INTEGER, 'offset');
      const { condition, args } = cardFilter(query);
      const sorts = { priority: 'c.priority DESC,leader_lower(c.title),c.id', updated: 'c.updated_at DESC,c.id', contact: "COALESCE(c.last_contact,substr(c.contact_quarter,1,4)||'-'||printf('%02d',CAST(substr(c.contact_quarter,-1) AS INTEGER)*3)||'-00') DESC,c.title COLLATE NOCASE,c.id", title: 'leader_lower(c.title),c.id', titleDesc: 'leader_lower(c.title) DESC,c.id' };
      const sort = query.sort || 'updated';
      if (!Object.hasOwn(sorts, sort)) throw new StoreError('Unknown sort order.');
      const total = sql(`SELECT COUNT(*) AS total FROM cards c WHERE ${condition}`).get(...args).total;
      const items = sql(`SELECT c.* FROM cards c WHERE ${condition} ORDER BY ${sorts[sort]} LIMIT ? OFFSET ?`).all(...args, limit, offset).map(hydrate);
      return { items, total, limit, offset };
    },
    bootstrap() {
      const lists = sql('SELECT l.id,l.name,l.color,COUNT(c.id) AS count FROM lists l LEFT JOIN cards c ON c.list_id=l.id AND c.archived=0 GROUP BY l.id ORDER BY l.rowid').all();
      lists.sort((a,b) => (permanentOrder.indexOf(canonicalListName(a.name)) + 1 || 100) - (permanentOrder.indexOf(canonicalListName(b.name)) + 1 || 100));
      const tags = sql('SELECT t.id,t.name,t.color,t.category,COUNT(c.id) AS count FROM tags t LEFT JOIN card_tags ct ON ct.tag_id=t.id LEFT JOIN cards c ON c.id=ct.card_id AND c.archived=0 GROUP BY t.id ORDER BY t.name COLLATE NOCASE').all();
      const quarters = sql("SELECT CASE WHEN last_contact IS NOT NULL THEN substr(last_contact,1,4) || '-' || ((CAST(substr(last_contact,6,2) AS INTEGER)+2)/3) ELSE contact_quarter END AS quarter, COUNT(*) AS count FROM cards WHERE archived=0 AND (last_contact IS NOT NULL OR contact_quarter IS NOT NULL) GROUP BY quarter ORDER BY quarter DESC").all().map(row => ({ ...quarterTag(`${row.quarter.slice(0, 4)}-${String((Number(row.quarter.slice(-1)) - 1) * 3 + 1).padStart(2, '0')}-01`), count: row.count }));
      const stats = sql('SELECT COUNT(*) AS total,COALESCE(SUM(completed=0),0) AS active,COALESCE(SUM(completed=1),0) AS completed,COALESCE(SUM(starred=1),0) AS starred FROM cards WHERE archived=0').get();
      stats.active = sql('SELECT COUNT(*) AS n FROM cards c WHERE archived=0 AND EXISTS (SELECT 1 FROM card_flags f WHERE f.card_id=c.id AND f.active=1)').get().n;
      for (const kind of flagKeys) stats[kind] = sql('SELECT COUNT(*) AS n FROM cards c JOIN card_flags f ON f.card_id=c.id WHERE c.archived=0 AND f.kind=? AND f.active=1').get(kind).n;
      return { lists, tags: [...quarters, ...tags], stats, demo: sql("SELECT value FROM metadata WHERE key='demo'").get()?.value === 'true' };
    },
    geography(query = {}) {
      const { condition, args } = cardFilter(query);
      const countries = sql(`WITH matched AS (SELECT c.id,c.country,c.secondary_country FROM cards c WHERE ${condition}) SELECT country,COUNT(*) AS count FROM (SELECT id,trim(country) AS country FROM matched UNION SELECT id,trim(secondary_country) AS country FROM matched) WHERE country<>'' GROUP BY country ORDER BY count DESC,country`).all(...args);
      return { countries, total: sql(`SELECT COUNT(*) AS n FROM cards c WHERE ${condition}`).get(...args).n };
    },
    exportData() {
      return transaction(() => ({ format: 'leader-company', version: 1, demo: service.bootstrap().demo,
        lists: sql('SELECT id,name,color FROM lists ORDER BY rowid').all(),
        tags: sql('SELECT id,name,color,category FROM tags ORDER BY rowid').all(),
        cards: sql('SELECT * FROM cards ORDER BY rowid').all().map(hydrate) }));
    },
    importList({ bundle, mode, targetListId }) {
      requireObject(bundle);
      if (bundle.format !== 'leader-list' || bundle.version !== 1 || !Array.isArray(bundle.cards)) throw new StoreError('Select a Leader list export.');
      if (bundle.cards.length > 10000) throw new StoreError('A list import can contain at most 10,000 cards.');
      if (!['preserve', 'target'].includes(mode)) throw new StoreError('Choose how imported card categories are assigned.');
      const target = mode === 'target' ? sql('SELECT id,name FROM lists WHERE id=?').get(string(targetListId, 'targetListId', 100, true)) : null;
      const targetType = target && Object.entries(listByAccountType).find(([, names]) => names.includes(target.name))?.[0];
      if (mode === 'target' && !targetType) throw new StoreError('Choose one of the six permanent lists as the target.');
      const timestamp = value => {
        const text = string(value, 'timestamp', 40, true);
        if (!/^\d{4}-\d\d-\d\dT/.test(text) || !Number.isFinite(Date.parse(text))) throw new StoreError('Invalid history date.');
        return text;
      };
      return transaction(() => {
        let created = 0, skipped = 0, omittedLinks = 0;
        const inserted = [];
        for (const record of bundle.cards) {
          requireObject(record);
          const sourceId = string(record.id, 'card.id', 100, true);
          if (sql('SELECT 1 FROM cards WHERE id=?').get(sourceId)) { skipped++; continue; }
          const accountType = mode === 'target' ? targetType : record.accountType;
          if (!Object.hasOwn(listByAccountType, accountType)) throw new StoreError('An imported card has an unknown category.');
          const list = mode === 'target' ? target : listByAccountType[accountType].map(name => sql('SELECT id,name FROM lists WHERE name=? COLLATE NOCASE').get(name)).find(Boolean);
          if (!list) throw new StoreError('A permanent list required by an imported card is missing.');
          if (!Array.isArray(record.tags) || !Array.isArray(record.activity)) throw new StoreError('Invalid imported tags or history.');
          const tagIds = [];
          for (const tag of record.tags) {
            requireObject(tag);
            if (String(tag.id).startsWith('quarter:')) continue;
            const name = string(tag.name, 'tag.name', 100, true);
            const existing = sql('SELECT id FROM tags WHERE name=? COLLATE NOCASE').get(name);
            tagIds.push(existing?.id || service.createTag({ name, color: tag.color, category: tag.category ?? null }).id);
          }
          const fields = Object.fromEntries(Object.entries(record).filter(([key]) => writableFields.has(key)));
          delete fields.distributorIds;
          fields.listId = list.id;
          fields.accountType = accountType;
          fields.archived = false;
          fields.tagIds = [...new Set(tagIds)];
          if (fields.flags) fields.flags = Object.fromEntries(Object.entries(fields.flags).map(([kind, flag]) => [kind, { active: flag.active, comment: flag.comment }]));
          const card = service.createCard(fields, sourceId);
          if (!Number.isInteger(record.version) || record.version < 1) throw new StoreError('Invalid card version.');
          sql('UPDATE cards SET version=?,created_at=?,updated_at=?,starred_at=?,imported_pending=1 WHERE id=?')
            .run(record.version, timestamp(record.createdAt), timestamp(record.updatedAt), record.starredAt ? timestamp(record.starredAt) : null, card.id);
          for (const [kind, flag] of Object.entries(record.flags || {})) {
            sql('UPDATE card_flags SET activated_at=? WHERE card_id=? AND kind=?').run(flag.activatedAt ? timestamp(flag.activatedAt) : null, card.id, kind);
          }
          for (const entry of record.activity) {
            requireObject(entry);
            const contacts = entry.contacts === undefined ? [] : validate({ contacts: entry.contacts }).contacts;
            const kind = entry.kind ?? 'note';
            if (!['note', 'flag', 'list'].includes(kind)) throw new StoreError('Invalid history event kind.');
            sql('INSERT INTO activity(id,card_id,text,created_at,contacts,kind) VALUES(?,?,?,?,?,?)')
              .run(string(entry.id, 'activity.id', 100, true), card.id, string(entry.text, 'activity.text', 10000, true), timestamp(entry.createdAt), JSON.stringify(contacts), kind);
          }
          inserted.push({ id: card.id, distributorIds: record.distributorIds });
          created++;
        }
        for (const record of inserted) {
          if (record.distributorIds === undefined) continue;
          if (!Array.isArray(record.distributorIds) || record.distributorIds.length > 20) throw new StoreError('Invalid distributor links.');
          const available = record.distributorIds.map(id => string(id, 'distributorId', 100, true)).filter(id => {
            const linked = sql('SELECT account_type FROM cards WHERE id=?').get(id);
            if (linked && ['distributor', 'partner'].includes(linked.account_type)) return true;
            omittedLinks++;
            return false;
          });
          saveCollections(record.id, validate({ distributorIds: available }));
        }
        return { created, skipped, omittedLinks };
      });
    },
    importData(bundle) {
      requireObject(bundle);
      if (bundle.format !== 'leader-company' || bundle.version !== 1 || !Array.isArray(bundle.lists) || !Array.isArray(bundle.tags) || !Array.isArray(bundle.cards)) throw new StoreError('Unsupported Leader database format.');
      if (bundle.cards.length > 100000 || bundle.lists.length > 10000 || bundle.tags.length > 10000) throw new StoreError('Database is too large.');
      return transaction(() => {
        if (sql('SELECT COUNT(*) AS n FROM lists').get().n || sql('SELECT COUNT(*) AS n FROM cards').get().n) throw new StoreError('Import is allowed only into a new empty database.');
        for (const [table, rows] of [['lists', bundle.lists], ['tags', bundle.tags]]) {
          for (const row of rows) {
            const id = string(row.id, 'id', 100, true);
            const created = createNamed(table, row);
            sql(`UPDATE ${table} SET id=? WHERE id=?`).run(id, created.id);
          }
        }
        const timestamp = value => {
          const text = string(value, 'timestamp', 40, true);
          if (!/^\d{4}-\d\d-\d\dT/.test(text) || !Number.isFinite(Date.parse(text))) throw new StoreError('Invalid history date.');
          return text;
        };
        for (const record of bundle.cards) {
          requireObject(record);
          const fields = Object.fromEntries(Object.entries(record).filter(([key]) => writableFields.has(key)));
          delete fields.distributorIds; // Restore links only after every endpoint exists.
          if (fields.flags) fields.flags = Object.fromEntries(Object.entries(fields.flags).map(([kind,flag]) => [kind,{active:flag.active,comment:flag.comment}]));
          if (!Array.isArray(record.tags) || !Array.isArray(record.activity)) throw new StoreError('Invalid card tags or history.');
          fields.tagIds = record.tags.filter(tag => !String(tag.id).startsWith('quarter:')).map(tag => tag.id);
          const card = service.createCard(fields, record.id);
          if (!Number.isInteger(record.version) || record.version < 1) throw new StoreError('Invalid card version.');
          if (record.importedPending !== undefined && typeof record.importedPending !== 'boolean') throw new StoreError('Invalid imported marker.');
          sql('UPDATE cards SET version=?,created_at=?,updated_at=?,imported_pending=? WHERE id=?').run(record.version, timestamp(record.createdAt), timestamp(record.updatedAt), Number(record.importedPending === true), card.id);
          sql('UPDATE cards SET starred_at=? WHERE id=?').run(record.starredAt ? timestamp(record.starredAt) : null, card.id);
          for (const [kind,flag] of Object.entries(record.flags || {})) sql('UPDATE card_flags SET activated_at=? WHERE card_id=? AND kind=?').run(flag.activatedAt ? timestamp(flag.activatedAt) : null,card.id,kind);
          for (const entry of record.activity) {
            requireObject(entry);
            const contacts = entry.contacts === undefined ? [] : validate({contacts:entry.contacts}).contacts;
            const kind = entry.kind ?? 'note';
            if (!['note', 'flag', 'list'].includes(kind)) throw new StoreError('Invalid history event kind.');
            sql('INSERT INTO activity(id,card_id,text,created_at,contacts,kind) VALUES(?,?,?,?,?,?)').run(string(entry.id, 'activity.id', 100, true), card.id, string(entry.text, 'activity.text', 10000, true), timestamp(entry.createdAt), JSON.stringify(contacts), kind);
          }
        }
        for (const record of bundle.cards) if (record.distributorIds) saveCollections(record.id, validate({ distributorIds: record.distributorIds }));
        sql("INSERT OR REPLACE INTO metadata(key,value) VALUES('initialized','true')").run();
        sql("INSERT OR REPLACE INTO metadata(key,value) VALUES('demo',?)").run(bundle.demo === true ? 'true' : 'false');
        return { cards: bundle.cards.length, lists: bundle.lists.length, tags: bundle.tags.length };
      });
    },
    close() { db.close(); },
  };
  function createNamed(table, input) {
    requireObject(input);
    const name = string(input.name, 'name', 100, true);
    if (table === 'tags' && (/^\d{4}-[1-4]$/.test(name) || name.startsWith('quarter:'))) throw new StoreError('Quarter tags are created automatically.');
    const color = input.color ?? '#4779eb';
    if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) throw new StoreError('Color must use #RRGGBB format.');
    const category = table === 'tags' ? input.category ?? null : null;
    if (category !== null && !tagCategories.has(category)) throw new StoreError('Unknown tag group.');
    return transaction(() => {
      if (sql(`SELECT id FROM ${table} WHERE name=? COLLATE NOCASE`).get(name)) throw new StoreError('That name already exists.', 409, 'DUPLICATE_NAME');
      const id = randomUUID();
      if (table === 'tags') sql('INSERT INTO tags(id,name,color,category) VALUES(?,?,?,?)').run(id, name, color, category);
      else sql('INSERT INTO lists(id,name,color) VALUES(?,?,?)').run(id, name, color);
      return { id, name, color, ...(table === 'tags' ? { category } : {}), count: 0 };
    });
  }
  if (seed && !sql("SELECT value FROM metadata WHERE key='initialized'").get()) {
    transaction(() => {
      // Only a pristine database receives demo records; existing user data is preserved.
      if (sql('SELECT COUNT(*) AS n FROM lists').get().n === 0 && sql('SELECT COUNT(*) AS n FROM cards').get().n === 0) {
        for (const list of DEMO_LISTS) sql('INSERT INTO lists(id,name,color) VALUES(?,?,?)').run(list.id, list.name, list.color);
        for (const tag of DEMO_TAGS) sql('INSERT INTO tags(id,name,color) VALUES(?,?,?)').run(tag.id, tag.name, tag.color);
        for (const record of DEMO_CARDS) {
          const { activity = [], ...input } = record;
          const card = service.createCard(input);
          for (const event of activity) sql('INSERT INTO activity(id,card_id,text,created_at) VALUES(?,?,?,?)').run(randomUUID(), card.id, event.text, event.createdAt);
        }
        sql("INSERT OR REPLACE INTO metadata(key,value) VALUES('demo','true')").run();
      }
      sql("INSERT INTO metadata(key,value) VALUES('initialized','true')").run();
    });
  }
  if (seed || sql('SELECT name FROM lists').all().some(list => permanentLists.has(list.name))) service.ensurePermanentLists();
  return service;
}
