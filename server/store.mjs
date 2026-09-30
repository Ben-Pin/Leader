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
const textFields = { title: 300, description: 50000, company: 300, country: 120, contactName: 300, email: 320 };
const writableFields = new Set([...Object.keys(textFields), 'listId', 'lastContact', 'dueDate', 'status', 'priority', 'completed', 'starred', 'archived', 'tagIds', 'checklist']);
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
    CREATE INDEX IF NOT EXISTS idx_cards_list_active_updated ON cards(list_id, archived, completed, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_cards_contact ON cards(archived, last_contact DESC);
    CREATE INDEX IF NOT EXISTS idx_cards_starred ON cards(archived, starred, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_cards_title ON cards(archived, title COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_tags_card ON card_tags(tag_id, card_id);
    CREATE INDEX IF NOT EXISTS idx_checklist_card ON checklist_items(card_id, position);
    CREATE INDEX IF NOT EXISTS idx_activity_card ON activity(card_id, created_at DESC);
    PRAGMA user_version=1;
  `);
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
    const quarter = quarterTag(row.last_contact);
    return {
      id: row.id, listId: row.list_id, title: row.title, description: row.description,
      company: row.company, country: row.country, contactName: row.contact_name, email: row.email,
      lastContact: row.last_contact, dueDate: row.due_date, status: row.status, priority: row.priority,
      completed: Boolean(row.completed), starred: Boolean(row.starred), archived: Boolean(row.archived),
      version: row.version, createdAt: row.created_at, updatedAt: row.updated_at,
      tags: quarter ? [quarter, ...tags] : tags,
      checklist: sql('SELECT id,text,done FROM checklist_items WHERE card_id=? ORDER BY position').all(row.id).map(item => ({ ...item, done: Boolean(item.done) })),
      activity: sql('SELECT id,text,created_at AS createdAt FROM activity WHERE card_id=? ORDER BY created_at DESC,id DESC').all(row.id),
    };
  };
  const validate = (input, creating = false) => {
    requireObject(input);
    for (const key of Object.keys(input)) if (!writableFields.has(key) && !(key === 'version' && !creating)) throw new StoreError(`Неизвестное поле «${key}».`);
    const result = {};
    if (creating && (!('title' in input) || !('listId' in input))) throw new StoreError('Название и список обязательны.');
    for (const [key, max] of Object.entries(textFields)) if (key in input) result[key] = string(input[key], key, max, key === 'title');
    if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) throw new StoreError('Некорректный адрес электронной почты.');
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
    return result;
  };
  const saveCollections = (id, value) => {
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
  const columns = { listId: 'list_id', title: 'title', description: 'description', company: 'company', country: 'country', contactName: 'contact_name', email: 'email', lastContact: 'last_contact', dueDate: 'due_date', status: 'status', priority: 'priority', completed: 'completed', starred: 'starred', archived: 'archived' };
  const service = {
    getCard(id) { return hydrate(findCard(id)); },
    createCard(input) {
      return transaction(() => {
        const value = validate(input, true);
        const id = randomUUID();
        const now = new Date().toISOString();
        sql(`INSERT INTO cards(id,list_id,title,description,company,country,contact_name,email,last_contact,due_date,status,priority,completed,starred,archived,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, value.listId, value.title, value.description ?? '', value.company ?? '', value.country ?? '', value.contactName ?? '', value.email ?? '', value.lastContact ?? null, value.dueDate ?? null, value.status ?? 'lead', value.priority ?? 0, Number(value.completed ?? false), Number(value.starred ?? false), Number(value.archived ?? false), now, now);
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
        sql('INSERT INTO activity(id,card_id,text,created_at) VALUES(?,?,?,?)').run(randomUUID(), id, text, now);
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
      const where = ['c.archived=0'];
      const args = [];
      const view = query.view || 'all';
      if (!['all', 'active', 'completed', 'starred'].includes(view)) throw new StoreError('Неизвестный фильтр карточек.');
      if (view === 'active') where.push('c.completed=0');
      if (view === 'completed') where.push('c.completed=1');
      if (view === 'starred') where.push('c.starred=1');
      if (query.listId) { where.push('c.list_id=?'); args.push(string(query.listId, 'listId', 100, true)); }
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
          where.push('c.last_contact>=? AND c.last_contact<=?'); args.push(start, end);
        } else { where.push('EXISTS (SELECT 1 FROM card_tags ct WHERE ct.card_id=c.id AND ct.tag_id=?)'); args.push(tag); }
      }
      if (query.q) {
        const search = string(query.q, 'q', 200).toLocaleLowerCase('ru').replace(/[\\%_]/g, '\\$&');
        where.push(`(leader_lower(c.title) LIKE ? ESCAPE '\\' OR leader_lower(c.company) LIKE ? ESCAPE '\\' OR leader_lower(c.country) LIKE ? ESCAPE '\\' OR leader_lower(c.contact_name) LIKE ? ESCAPE '\\' OR leader_lower(c.email) LIKE ? ESCAPE '\\' OR leader_lower(c.description) LIKE ? ESCAPE '\\')`);
        for (let i = 0; i < 6; i++) args.push(`%${search}%`);
      }
      const sorts = { updated: 'c.updated_at DESC,c.id', contact: 'c.last_contact DESC,c.title COLLATE NOCASE,c.id', title: 'c.title COLLATE NOCASE,c.id' };
      const sort = query.sort || 'updated';
      if (!Object.hasOwn(sorts, sort)) throw new StoreError('Неизвестный порядок сортировки.');
      const condition = where.join(' AND ');
      const total = sql(`SELECT COUNT(*) AS total FROM cards c WHERE ${condition}`).get(...args).total;
      const items = sql(`SELECT c.* FROM cards c WHERE ${condition} ORDER BY ${sorts[sort]} LIMIT ? OFFSET ?`).all(...args, limit, offset).map(hydrate);
      return { items, total, limit, offset };
    },
    bootstrap() {
      const lists = sql('SELECT l.id,l.name,l.color,COUNT(c.id) AS count FROM lists l LEFT JOIN cards c ON c.list_id=l.id AND c.archived=0 AND c.completed=0 GROUP BY l.id ORDER BY l.rowid').all();
      const tags = sql('SELECT t.id,t.name,t.color,COUNT(c.id) AS count FROM tags t LEFT JOIN card_tags ct ON ct.tag_id=t.id LEFT JOIN cards c ON c.id=ct.card_id AND c.archived=0 AND c.completed=0 GROUP BY t.id ORDER BY t.name COLLATE NOCASE').all();
      const quarters = sql("SELECT substr(last_contact,1,4) || '-' || ((CAST(substr(last_contact,6,2) AS INTEGER)+2)/3) AS quarter, COUNT(*) AS count FROM cards WHERE archived=0 AND completed=0 AND last_contact IS NOT NULL GROUP BY quarter ORDER BY quarter DESC").all().map(row => ({ ...quarterTag(`${row.quarter.slice(0, 4)}-${String((Number(row.quarter.slice(-1)) - 1) * 3 + 1).padStart(2, '0')}-01`), count: row.count }));
      const stats = sql('SELECT COUNT(*) AS total,COALESCE(SUM(completed=0),0) AS active,COALESCE(SUM(completed=1),0) AS completed,COALESCE(SUM(starred=1),0) AS starred FROM cards WHERE archived=0').get();
      return { lists, tags: [...quarters, ...tags], stats, demo: sql("SELECT value FROM metadata WHERE key='demo'").get()?.value === 'true' };
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
