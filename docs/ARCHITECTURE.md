# Architecture — Astra implementation brief

Status: accepted for the first prototype. Architectural decisions and their validation belong here; visual polish must not compromise persistence or connector consistency.

## Components

1. React + TypeScript browser UI, bundled with Vite. Localized Russian labels and Lucide icons. No remote fonts or CDN assets are required at runtime.
2. Node.js 24 HTTP API. Serves built UI and JSON API at 127.0.0.1:4177. Development UI proxies `/api` to this server.
3. Shared JavaScript service backed by Node's built-in SQLite driver, with WAL, foreign keys, indexed list/status/date queries, revision checks, and bounded pagination.
4. MCP stdio entrypoint using the official TypeScript/JavaScript SDK. It uses the same service/database as HTTP. Standard output is reserved for MCP messages.

Browser -> HTTP -> shared service -> SQLite <- shared service <- MCP <- agent.

## Data

Tables: lists, cards, tags, card_tags, checklist_items, activity, card_flags. Stable random IDs. Cards retain legacy completed for export compatibility, but the UI uses independent inQuote/logisticsIssue/administrativeIssue/swIssue/hwIssue flags instead. Each flag has active and a single-line comment; flag writes participate in the same card revision and transaction.

Company registry: `data/companies.sqlite`. The legacy `data/leader.sqlite` remains connected as Demo, preserving existing edits. Clab and BrothersInArms use their own files under `data/companies/`. Additional companies use generated UUID filenames; imports never choose a filesystem path. HTTP selects a company per request with X-Leader-Company; MCP requires companyId per operation. There is no process-global active company, so two windows/agents cannot redirect each other's writes.

Portable format `leader-company`, version 1: named company metadata, all lists, custom tags and all cards (including archived), IDs, versions, dates, checklist, flags and history. Import creates a fresh company database and validates/restores in a single transaction. Existing company names/databases are not overwritten. Limit: 128 MB per HTTP import, 100,000 cards per package. Failed imports are not registered.

Optimistic concurrency: PATCH must include expected `version`. Concurrent stale updates return conflict. All multi-table changes are transactional. Soft archive is reversible.

## Scale

Additive schema v4 adds `account_type`, `contact_quarter`, and `card_distributors`. Client-to-partner links use foreign keys, shared role/cycle validation and card revisions. Reverse client lists are derived and paginated. Portable import creates all endpoints before links; invalid links roll back the entire import. Migration batches use stable source IDs and the same service transaction layer; private migration inputs/reports remain outside the repository.

Page sizes: default 100, maximum 200. Filter and search happen server-side; the browser never loads 10,000 cards just to show one page. Count summaries come from SQL. Validate 10,000 inserts and bounded list/search queries in a disposable database and report actual measurements.

## Local operation and privacy

Listen on loopback. Browser writes require a session token supplied by bootstrap plus same-origin checks. CLI/MCP uses local filesystem access; no cloud connector is installed automatically. Database, logs and .env are ignored by Git. Demo seed is fictional and idempotent. Back up the database before future real JSON migration.

## Connector deployment

First deliver a tested local stdio MCP server. The plugin package points to its built source using PLUGIN_ROOT. Remote ChatGPT access is a separate deployment decision requiring an authenticated endpoint or secure tunnel. A working MCP SDK test does not imply that a user's host has installed the plugin.

## Later milestones

Import preview with deduplication/provenance; managed backup/restore; stronger full-text search; bulk edits; optional calendar and board modes; opt-in remote access; Windows packaging.

Globe queries and card pagination share one SQL filter builder. Geography aggregates all matching rows on the server without hydrating the entire card collection. The frontend passes the list's query to both globe views, aborts obsolete geography/directory requests, and ignores stale pagination responses. Dot geometry is memoized while the projection animates with requestAnimationFrame along a shortest great-circle path.

Schema v6 adds swIssue and hwIssue. Existing card_flags tables are rebuilt inside one immediate transaction, retaining comments, activation timestamps and card revisions. The flag index and foreign-key constraint are recreated. Older exports import with new flags inactive. HTTP, MCP, filtering, statistics and geography share the same five flag keys.
