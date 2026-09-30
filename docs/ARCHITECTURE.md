# Architecture — Astra implementation brief

Status: accepted for the first prototype. Architectural decisions and their validation belong here; visual polish must not compromise persistence or connector consistency.

## Components

1. React + TypeScript browser UI, bundled with Vite. Localized Russian labels and Lucide icons. No remote fonts or CDN assets are required at runtime.
2. Node.js 24 HTTP API. Serves built UI and JSON API at 127.0.0.1:4177. Development UI proxies `/api` to this server.
3. Shared JavaScript service backed by Node's built-in SQLite driver, with WAL, foreign keys, indexed list/status/date queries, revision checks, and bounded pagination.
4. MCP stdio entrypoint using the official TypeScript/JavaScript SDK. It uses the same service/database as HTTP. Standard output is reserved for MCP messages.

Browser -> HTTP -> shared service -> SQLite <- shared service <- MCP <- agent.

## Data

Tables: lists, cards, tags, card_tags, checklist_items, activity. Stable random IDs. Cards have title, description, country, company, contactName, email, lastContact, dueDate, status, priority, completed, starred, archived, version, createdAt, updatedAt. Tags are ordered; quarter tag is derived by the service and prepended in responses.

Optimistic concurrency: PATCH must include expected `version`. Concurrent stale updates return conflict. All multi-table changes are transactional. Soft archive is reversible.

## Scale

Page sizes: default 100, maximum 200. Filter and search happen server-side; the browser never loads 10,000 cards just to show one page. Count summaries come from SQL. Validate 10,000 inserts and bounded list/search queries in a disposable database and report actual measurements.

## Local operation and privacy

Listen on loopback. Browser writes require a session token supplied by bootstrap plus same-origin checks. CLI/MCP uses local filesystem access; no cloud connector is installed automatically. Database, logs and .env are ignored by Git. Demo seed is fictional and idempotent. Back up the database before future real JSON migration.

## Connector deployment

First deliver a tested local stdio MCP server. The plugin package points to its built source using PLUGIN_ROOT. Remote ChatGPT access is a separate deployment decision requiring an authenticated endpoint or secure tunnel. A working MCP SDK test does not imply that a user's host has installed the plugin.

## Later milestones

Import preview with deduplication/provenance; managed backup/restore; stronger full-text search; bulk edits; optional calendar and board modes; opt-in remote access; Windows packaging.
