# Product brief — Leader prototype

## User intent

An independent local client-card application for Windows, usable in a browser, visually and behaviorally close to TickTick. It must avoid small list limits (target: 10,000 cards in one list) and expose a connector that lets an assistant perform the same card/list/tag operations as the user interface.

## Prototype

- Three-pane layout: icon rail and lists/tags, task-style card list, editable details.
- Russian UI. Blue accent, pale sidebar, white work area, fine separators, compact row typography.
- Several fictional companies with country, contact, description, checklist, and contact history.
- Create/edit/search/move cards; toggle completion and star; set priority and lead stage.
- Create lists and color tags. Filter by list and tag; sort by recent contact or title.
- Derive YYYY-Q tag from last contact. Display it first. 2026 bright green, 2025 muted green, 2024 amber, 2023 and older red.
- Persist data in local SQLite. Refreshing or restarting must preserve edits.
- Use pagination; no application-level cap of 100/500 cards per list.
- MCP tools to list/search/read/create/update cards and manage lists/tags, backed by the same service.

## Explicit boundaries

Prototype is single-user on loopback. Cloud synchronization, multi-user permissions, mobile apps, email sending, recurring reminders, file attachments and an exact reproduction of every TickTick feature are later work. Existing JSON is an eventual migration input, not automatically imported during demo.

## Definition of success

The user opens Leader in a Windows browser, sees a polished populated interface, edits and creates a card, refreshes and retains changes. MCP can discover tools, read cards and create/update a test card. The private GitHub repository contains source and architecture documents, with a separate prototype branch.
