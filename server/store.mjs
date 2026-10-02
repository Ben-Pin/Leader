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

const stages = new Set(['lead', 'contacted', 'qualified', 'proposal', 'client']);
export const contactStatuses = ['active', 'main', 'inactive', 'disturbing', 'useful', 'decisions'];
export const flagKeys = ['inQuote', 'logisticsIssue', 'administrativeIssue', 'swIssue', 'hwIssue'];
const textFields = { title: 300, description: 50000, company: 300, country: 120, secondaryCountry: 120, contactName: 300, email: 320 };
const writableFields = new Set([...Object.keys(textFields), 'listId', 'lastContact', 'contactQuarter', 'dueDate', 'status', 'priority', 'completed', 'starred', 'archived', 'tagIds', 'checklist', 'contacts', 'flags', 'accountType', 'distributorIds']);
const requireObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new StoreError('Ожидается объект с полями.');
};
const string = (value, label, max = 300, required = false) => {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new StoreError(`Некорректное поле «${label}».`);
  return value.trim();
};
const date = (value, label) => {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) throw new StoreError(`«${label}»: ожидается дата ГГГГ-ММ-ДД.`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new StoreError(`«${label}»: такой даты не существует.`);
  return value;
};
export function quarterTag(lastContact) {
  if (!lastContact) return null;
  const year = Number(lastContact.slice(0, 4));
  const name = `${year}-${Math.ceil(Number(lastContact.slice(5, 7)) / 3)}`;
  return { id: `quarter:${name}`, name, color: year >= 2026 ? '#36c96b' : year === 2025 ? '#88b66d' : year === 2024 ? '#e6a64b' : '#e27370' };
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
    db.exec('PRAGMA user_version=8; COMMIT');
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
    if (!row) throw new StoreError('Карточка не найдена.', 404, 'NOT_FOUND');
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
      completed: Boolean(row.completed), starred: Boolean(row.starred), starredAt: row.starred_at, archived: Boolean(row.archived),
      version: row.version, createdAt: row.created_at, updatedAt: row.updated_at,
      tags: quarter ? [quarter, ...tags] : tags,
      flags: Object.fromEntries(flagKeys.map(kind => {
        const flag = sql('SELECT active,comment,activated_at FROM card_flags WHERE card_id=? AND kind=?').get(row.id, kind);
        return [kind, { active: Boolean(flag?.active), comment: flag?.comment || '', activatedAt: flag?.activated_at || null }];
      })),
      checklist: sql('SELECT id,text,done FROM checklist_items WHERE card_id=? ORDER BY position').all(row.id).map(item => ({ ...item, done: Boolean(item.done) })),
      activity: sql('SELECT id,text,created_at AS createdAt,contacts FROM activity WHERE card_id=? ORDER BY created_at DESC,id DESC').all(row.id).map(entry => ({...entry, contacts:JSON.parse(entry.contacts)})),
    };
  };
  const validate = (input, creating = false) => {
    requireObject(input);
    for (const key of Object.keys(input)) if (!writableFields.has(key) && !(key === 'version' && !creating)) throw new StoreError(`Неизвестное поле «${key}».`);
    const result = {};
    if ('contactQuarter' in input) {
      if (input.contactQuarter !== null && !/^[1-9]\d{3}-[1-4]$/.test(input.contactQuarter)) throw new StoreError('Contact quarter must be YYYY-Q or null.');
      result.contactQuarter = input.contactQuarter;
    }
    if ('accountType' in input) {
      if (!['unspecified', 'client', 'distributor', 'partner'].includes(input.accountType)) throw new StoreError('Invalid account type.');
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
    if (creating && (!('title' in input) || !('listId' in input))) throw new StoreError('Название и список обязательны.');
    for (const [key, max] of Object.entries(textFields)) if (key in input) result[key] = string(input[key], key, max, key === 'title');
    if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) throw new StoreError('Некорректный адрес электронной почты.');
    if ('contacts' in input) {
      if (!Array.isArray(input.contacts) || input.contacts.length > 100) throw new StoreError('Допустимо не более 100 контактов.');
      const seen = new Set();
      result.contacts = input.contacts.map(contact => {
        requireObject(contact);
        if (Object.keys(contact).some(key => !['id', 'name', 'role', 'email', 'status'].includes(key))) throw new StoreError('Неизвестное поле контакта.');
        const id = contact.id === undefined ? randomUUID() : string(contact.id, 'contact.id', 100, true);
        if (seen.has(id)) throw new StoreError('Идентификаторы контактов должны быть уникальны.');
        seen.add(id);
        const name = string(contact.name ?? '', 'contact.name', 300);
        const role = string(contact.role ?? '', 'contact.role', 500);
        const email = string(contact.email ?? '', 'contact.email', 320);
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new StoreError('Некорректный адрес электронной почты контакта.');
        const status = contact.status ?? 'active';
        if (!contactStatuses.includes(status)) throw new StoreError('Неизвестный статус контакта.');
        return { id, name, role, email, status };
      }).filter(contact => contact.name || contact.role || contact.email);
    }
    if ('listId' in input) {
      result.listId = string(input.listId, 'listId', 100, true);
      if (!sql('SELECT id FROM lists WHERE id=?').get(result.listId)) throw new StoreError('Список не найден.', 404, 'NOT_FOUND');
    }
    for (const key of ['lastContact', 'dueDate']) if (key in input) result[key] = date(input[key], key);
    if ('status' in input) {
      if (!stages.has(input.status)) throw new StoreError('Неизвестный этап клиента.');
      result.status = input.status;
    }
    if ('priority' in input) {
      if (!Number.isInteger(input.priority) || input.priority < 0 || input.priority > 3) throw new StoreError('Приоритет должен быть от 0 до 3.');
      result.priority = input.priority;
    }
    for (const key of ['completed', 'starred', 'archived']) if (key in input) {
      if (typeof input[key] !== 'boolean') throw new StoreError(`«${key}» должно быть логическим значением.`);
      result[key] = input[key];
    }
    if ('tagIds' in input) {
      if (!Array.isArray(input.tagIds) || input.tagIds.length > 50) throw new StoreError('Допустимо не более 50 тегов.');
      result.tagIds = [...new Set(input.tagIds.map(id => string(id, 'tagId', 100, true)))];
      for (const id of result.tagIds) if (!sql('SELECT id FROM tags WHERE id=?').get(id)) throw new StoreError('Тег не найден; квартальный тег рассчитывается автоматически.');
    }
    if ('checklist' in input) {
      if (!Array.isArray(input.checklist) || input.checklist.length > 100) throw new StoreError('Допустимо не более 100 пунктов чек-листа.');
      const seenIds = new Set();
      result.checklist = input.checklist.map(item => {
        requireObject(item);
        const id = item.id === undefined ? randomUUID() : string(item.id, 'checklist.id', 100, true);
        if (seenIds.has(id)) throw new StoreError('Идентификаторы пунктов чек-листа должны быть уникальны.');
        seenIds.add(id);
        if (item.done !== undefined && typeof item.done !== 'boolean') throw new StoreError('Состояние пункта чек-листа должно быть логическим.');
        return { id, text: string(item.text, 'checklist.text', 2000, true), done: item.done ?? false };
      });
    }
    if ('flags' in input) {
      requireObject(input.flags);
      result.flags = {};
      for (const [kind, flag] of Object.entries(input.flags)) {
        if (!flagKeys.includes(kind)) throw new StoreError('Неизвестный флаг.');
        requireObject(flag);
        if (Object.keys(flag).some(key => !['active', 'comment'].includes(key)) || typeof flag.active !== 'boolean') throw new StoreError('Некорректный флаг.');
        const comment = string(flag.comment ?? '', 'flag.comment', 300);
        if (/[\r\n]/.test(comment)) throw new StoreError('Комментарий флага должен занимать одну строку.');
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
        if (other && other.card_id !== id) throw new StoreError('Этот пункт чек-листа принадлежит другой карточке.');
      }
      sql('DELETE FROM checklist_items WHERE card_id=?').run(id);
      value.checklist.forEach((item, index) => sql('INSERT INTO checklist_items(id,card_id,text,done,position) VALUES(?,?,?,?,?)').run(item.id, id, item.text, Number(item.done), index));
    }
  };
  const checkVersion = (row, version) => {
    if (!Number.isInteger(version) || version < 1) throw new StoreError('Для изменения необходима текущая версия карточки.');
    if (version !== row.version) throw new StoreError('Карточка уже изменена. Обновите её и повторите действие.', 409, 'VERSION_CONFLICT');
  };
  const columns = { listId: 'list_id', title: 'title', description: 'description', company: 'company', country: 'country', secondaryCountry: 'secondary_country', contactName: 'contact_name', email: 'email', lastContact: 'last_contact', contactQuarter: 'contact_quarter', dueDate: 'due_date', status: 'status', priority: 'priority', completed: 'completed', starred: 'starred', archived: 'archived', accountType: 'account_type' };
  // Shared by paginated cards and full-result geography.
  const cardFilter = (query = {}) => {
    requireObject(query);
    const where = ['c.archived=0'];
    const args = [];
    const view = query.view || 'all';
    if (!['all', 'active', 'completed', 'starred', ...flagKeys].includes(view)) throw new StoreError('Неизвестный фильтр карточек.');
    if (view === 'active') where.push('EXISTS (SELECT 1 FROM card_flags f WHERE f.card_id=c.id AND f.active=1)');
    if (flagKeys.includes(view)) { where.push('EXISTS (SELECT 1 FROM card_flags f WHERE f.card_id=c.id AND f.kind=? AND f.active=1)'); args.push(view); }
    if (view === 'completed') where.push('c.completed=1');
    if (view === 'starred') where.push('c.starred=1');
    if (query.listId) { where.push('c.list_id=?'); args.push(string(query.listId, 'listId', 100, true)); }
    if (query.country) { where.push('(leader_lower(c.country)=? OR leader_lower(c.secondary_country)=?)'); const country=string(query.country,'country',120,true).toLocaleLowerCase('ru'); args.push(country,country); }
    if (query.distributorId) { where.push('EXISTS (SELECT 1 FROM card_distributors d WHERE d.client_id=c.id AND d.distributor_id=?)'); args.push(string(query.distributorId, 'distributorId', 100, true)); }
    if (query.accountType === 'channel') where.push("c.account_type IN ('distributor','partner')");
    else if (query.accountType) {
      if (!['client','distributor','partner','unspecified'].includes(query.accountType)) throw new StoreError('Invalid account type filter.');
      where.push('c.account_type=?'); args.push(query.accountType);
    }
    if (query.tag) {
      const tag = string(query.tag, 'tag', 100, true);
      if (tag.startsWith('quarter:')) {
        const match = /^quarter:([1-9]\d{3})-([1-4])$/.exec(tag);
        if (!match) throw new StoreError('Некорректный квартальный тег.');
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
        const id = restoredId === undefined ? randomUUID() : string(restoredId, 'card.id', 100, true);
        const now = new Date().toISOString();
        sql(`INSERT INTO cards(id,list_id,title,description,company,country,contact_name,email,last_contact,due_date,status,priority,completed,starred,archived,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, value.listId, value.title, value.description ?? '', value.company ?? '', value.country ?? '', value.contactName ?? '', value.email ?? '', value.lastContact ?? null, value.dueDate ?? null, value.status ?? 'lead', value.priority ?? 0, Number(value.completed ?? false), Number(value.starred ?? false), Number(value.archived ?? false), now, now);
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
        const value = validate(input);
        const entries = Object.entries(value).filter(([key]) => key in columns);
        const clause = entries.map(([key]) => `${columns[key]}=?`);
        const args = entries.map(([, val]) => typeof val === 'boolean' ? Number(val) : val);
        clause.push('version=version+1', 'updated_at=?');
        sql(`UPDATE cards SET ${clause.join(',')} WHERE id=?`).run(...args, new Date().toISOString(), id);
        if (value.starred === true && !row.starred) sql('UPDATE cards SET starred_at=? WHERE id=?').run(new Date().toISOString(), id);
        saveCollections(id, value);
        return service.getCard(id);
      });
    },
    addComment(id, input) {
      return transaction(() => {
        requireObject(input);
        const row = findCard(id);
        checkVersion(row, input.version);
        const text = string(input.text, 'text', 10000, true);
        const now = new Date().toISOString();
        if (!Array.isArray(input.contactIds) || !input.contactIds.length || input.contactIds.length > 100) throw new StoreError('Выберите хотя бы один контакт для записи истории.');
        const available = JSON.parse(row.contacts);
        const contacts = [...new Set(input.contactIds.map(value => string(value, 'contactId', 100, true)))].map(contactId => {
          const contact = available.find(person => person.id === contactId);
          if (!contact) throw new StoreError('Контакт не найден в этой карточке.');
          return contact;
        });
        sql('INSERT INTO activity(id,card_id,text,created_at,contacts) VALUES(?,?,?,?,?)').run(randomUUID(), id, text, now, JSON.stringify(contacts));
        sql('UPDATE cards SET version=version+1,updated_at=? WHERE id=?').run(now, id);
        return service.getCard(id);
      });
    },
    createList(input) { return createNamed('lists', input); },
    createTag(input) { return createNamed('tags', input); },
    listCards(query = {}) {
      requireObject(query);
      const integer = (value, fallback, min, max, label) => {
        if (value === undefined || value === '') return fallback;
        const result = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
        if (!Number.isSafeInteger(result) || result < min || result > max) throw new StoreError(`Некорректное значение ${label}.`);
        return result;
      };
      const limit = integer(query.limit, 100, 1, 200, 'limit');
      const offset = integer(query.offset, 0, 0, Number.MAX_SAFE_INTEGER, 'offset');
      const { condition, args } = cardFilter(query);
      const sorts = { updated: 'c.updated_at DESC,c.id', contact: "COALESCE(c.last_contact,substr(c.contact_quarter,1,4)||'-'||printf('%02d',CAST(substr(c.contact_quarter,-1) AS INTEGER)*3)||'-00') DESC,c.title COLLATE NOCASE,c.id", title: 'leader_lower(c.title),c.id', titleDesc: 'leader_lower(c.title) DESC,c.id' };
      const sort = query.sort || 'updated';
      if (!Object.hasOwn(sorts, sort)) throw new StoreError('Неизвестный порядок сортировки.');
      const total = sql(`SELECT COUNT(*) AS total FROM cards c WHERE ${condition}`).get(...args).total;
      const items = sql(`SELECT c.* FROM cards c WHERE ${condition} ORDER BY ${sorts[sort]} LIMIT ? OFFSET ?`).all(...args, limit, offset).map(hydrate);
      return { items, total, limit, offset };
    },
    bootstrap() {
      const lists = sql('SELECT l.id,l.name,l.color,COUNT(c.id) AS count FROM lists l LEFT JOIN cards c ON c.list_id=l.id AND c.archived=0 GROUP BY l.id ORDER BY l.rowid').all();
      const tags = sql('SELECT t.id,t.name,t.color,COUNT(c.id) AS count FROM tags t LEFT JOIN card_tags ct ON ct.tag_id=t.id LEFT JOIN cards c ON c.id=ct.card_id AND c.archived=0 GROUP BY t.id ORDER BY t.name COLLATE NOCASE').all();
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
        tags: sql('SELECT id,name,color FROM tags ORDER BY rowid').all(),
        cards: sql('SELECT * FROM cards ORDER BY rowid').all().map(hydrate) }));
    },
    importData(bundle) {
      requireObject(bundle);
      if (bundle.format !== 'leader-company' || bundle.version !== 1 || !Array.isArray(bundle.lists) || !Array.isArray(bundle.tags) || !Array.isArray(bundle.cards)) throw new StoreError('Неподдерживаемый формат базы Leader.');
      if (bundle.cards.length > 100000 || bundle.lists.length > 10000 || bundle.tags.length > 10000) throw new StoreError('Слишком большая база.');
      return transaction(() => {
        if (sql('SELECT COUNT(*) AS n FROM lists').get().n || sql('SELECT COUNT(*) AS n FROM cards').get().n) throw new StoreError('Импорт разрешён только в новую пустую базу.');
        for (const [table, rows] of [['lists', bundle.lists], ['tags', bundle.tags]]) {
          for (const row of rows) {
            const id = string(row.id, 'id', 100, true);
            const created = createNamed(table, row);
            sql(`UPDATE ${table} SET id=? WHERE id=?`).run(id, created.id);
          }
        }
        const timestamp = value => {
          const text = string(value, 'timestamp', 40, true);
          if (!/^\d{4}-\d\d-\d\dT/.test(text) || !Number.isFinite(Date.parse(text))) throw new StoreError('Некорректная дата истории.');
          return text;
        };
        for (const record of bundle.cards) {
          requireObject(record);
          const fields = Object.fromEntries(Object.entries(record).filter(([key]) => writableFields.has(key)));
          delete fields.distributorIds; // Restore links only after every endpoint exists.
          if (fields.flags) fields.flags = Object.fromEntries(Object.entries(fields.flags).map(([kind,flag]) => [kind,{active:flag.active,comment:flag.comment}]));
          if (!Array.isArray(record.tags) || !Array.isArray(record.activity)) throw new StoreError('Некорректные теги или история карточки.');
          fields.tagIds = record.tags.filter(tag => !String(tag.id).startsWith('quarter:')).map(tag => tag.id);
          const card = service.createCard(fields, record.id);
          if (!Number.isInteger(record.version) || record.version < 1) throw new StoreError('Некорректная версия карточки.');
          sql('UPDATE cards SET version=?,created_at=?,updated_at=? WHERE id=?').run(record.version, timestamp(record.createdAt), timestamp(record.updatedAt), card.id);
          sql('UPDATE cards SET starred_at=? WHERE id=?').run(record.starredAt ? timestamp(record.starredAt) : null, card.id);
          for (const [kind,flag] of Object.entries(record.flags || {})) sql('UPDATE card_flags SET activated_at=? WHERE card_id=? AND kind=?').run(flag.activatedAt ? timestamp(flag.activatedAt) : null,card.id,kind);
          for (const entry of record.activity) {
            requireObject(entry);
            const contacts = entry.contacts === undefined ? [] : validate({contacts:entry.contacts}).contacts;
            sql('INSERT INTO activity(id,card_id,text,created_at,contacts) VALUES(?,?,?,?,?)').run(string(entry.id, 'activity.id', 100, true), card.id, string(entry.text, 'activity.text', 10000, true), timestamp(entry.createdAt), JSON.stringify(contacts));
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
    if (table === 'tags' && (/^\d{4}-[1-4]$/.test(name) || name.startsWith('quarter:'))) throw new StoreError('Квартальные теги создаются автоматически.');
    const color = input.color ?? '#4779eb';
    if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) throw new StoreError('Цвет должен иметь формат #RRGGBB.');
    return transaction(() => {
      if (sql(`SELECT id FROM ${table} WHERE name=? COLLATE NOCASE`).get(name)) throw new StoreError('Такое название уже существует.', 409, 'DUPLICATE_NAME');
      const id = randomUUID();
      sql(`INSERT INTO ${table}(id,name,color) VALUES(?,?,?)`).run(id, name, color);
      return { id, name, color, count: 0 };
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
  return service;
}
