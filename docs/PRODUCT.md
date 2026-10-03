# Product brief — Leader prototype

## User intent

An independent local client-card application for Windows, usable in a browser, visually and behaviorally close to TickTick. It must avoid small list limits (target: 10,000 cards in one list) and expose a connector that lets an assistant perform the same card/list/tag operations as the user interface.

## Prototype

- Three-pane layout: icon rail and lists/tags, task-style card list, editable details. On desktop the middle list uses two thirds of its former width; the released space goes to the detail card. Details use a 28px heading, 14px body/inputs and 12px labels. Titles, descriptions and draft notes grow with their text; short descriptions keep a compact two-line minimum. Tablet details widen to 560px where space permits; phone details fill the screen.
- English UI. Blue accent, pale sidebar, white work area, fine separators, compact row typography.
- Several fictional companies with country, contact, description, checklist, and contact history.
- Create/edit/search/move cards; star, priority and lead stage. Company names are never struck through as completed tasks.
- Branding: Leader, with the exact subtitle `of the lead-free world`; no motivational copy. Following the user's sketch, a blue L forms the left and bottom edges of a pinned chip; a glowing yellow sun-dot sits at the upper right and shines toward the L. One shared SVG is used throughout the UI and as the favicon.
- A small three-dimensional pewter Tux playing-token mascot sits to the right of Leader in the sidebar heading. The transparent PNG is stored locally; company management remains available beside the company selector.
- Connected company databases: Demo, Clab (mail-derived clients), BrothersInArms. Each has independent cards, lists, tags and history; switch in the sidebar. Full JSON export and import as a new company.
- Independent flags: green `$` In quote (awaiting a reply to pricing), yellow Logistics issue, red Administrative issue, blue Tux SW issue, gray wrench HW issue. Compact circular controls sit in one horizontal row, without visible text labels (names remain in tooltips and accessibility labels). Each control acts as a checkbox: click to enable or clear; changes save when the card loses focus or closes. Active flags show a 300-character single-line comment; clearing hides but preserves the comment. List filters use matching round controls with nonzero count badges.
- In work contains cards with at least one active flag. Each flag has a top filter/list; multiple flags put a card in multiple lists. Original custom-list membership is retained.
- Card changes save automatically on exit, focus loss, or company switch. Undo discards current unsaved edits and closes the card. Ctrl+S saves. Browser-tab closing retains the browser's native unsaved-changes warning while saving is pending.
- Card header contains Undo, the five round attention flags and Close. Star and archive buttons are removed from this header; the flag row is not duplicated in the card body. Active-flag comments remain below the header.
- Create lists and color tags. Filter by list and tag; sort by recent contact or title.
- The compact board-pass actions above the card list add a card, export the current list/search result as a standalone `leader-list` JSON snapshot (all pages), and toggle Wisdom. Wisdom's on/off preference is stored locally; thought cards are not shown until a content source is supplied and connected.
- Derive YYYY-Q tag from last contact. Display it first. 2026 bright green, 2025 muted green, 2024 amber, 2023 and older red.
- Persist data in local SQLite. Refreshing or restarting must preserve edits. Verified JSON snapshots of each connected company are made at startup and every six hours, retaining 28 per company under `data/backups/`.
- Use pagination; no application-level cap of 100/500 cards per list.
- MCP tools to list/search/read/create/update cards and manage lists/tags, backed by the same service.

## Explicit boundaries

Prototype is single-user on loopback. Cloud synchronization, multi-user permissions, mobile apps, email sending, recurring reminders, file attachments and an exact reproduction of every TickTick feature are later work. Existing JSON is an eventual migration input, not automatically imported during demo.

## Definition of success

The user opens Leader in a Windows browser, sees a polished populated interface, edits and creates a card, refreshes and retains changes. MCP can discover tools, read cards and create/update a test card. The private GitHub repository contains source and architecture documents, with a separate prototype branch.

## Globe and navigation

The sidebar globe follows the current list, flag/tag filter and global search. Aggregates include every matching card, independently of list pagination; a card with two distinct countries contributes once to each country. Country buttons and map markers open the matching country directory with the same filters. Unknown or missing countries cannot be plotted. Markers represent country-level counts, not office coordinates.

The globe has no visible captions and uses its full sidebar width. Selecting a card or country rotates along the shortest great-circle route with eased motion (650–1100 ms); dragging interrupts the transition. Reduced-motion preferences disable automatic animation. The left icon rail uses a single silver stroke style, including the chip logo, on the original blue (#405ba5) background, with glass shading and an inset selected state.

Geography data: Natural Earth, distributed via `world-atlas` and `topojson-client`.


## Contact rows

Core card properties are paired: country/second country, stage/priority, last contact/next step. Tabs are ordered Card, Contacts, History. Contacts has repeatable single-line name, role/job description, email and status columns (12px text, 32px fields). Add/remove rows; changes save when the card is left, while Undo discards them. Up to 100 contacts per card. Empty rows are omitted on save. Names, roles and emails from all contacts participate in global search and filtered geography. Contacts retain all four columns on phones with 11px text; basic properties remain paired. Existing single contacts are retained automatically.


Contact status: active (default), main, inactive (left the company), disturbing, useful, decisions. New history entries require at least one selected contact from the card. Each entry retains its participants even after contact changes/removal; pre-existing entries remain visibly marked as legacy unlinked history. Switching detail tabs or opening another card resets the detail scroll so country, stage, priority and dates remain discoverable at the top. The rail logo grows from 26px to 33.8px (+30%) inside a 46px button; the sidebar globe artwork scales by 1.2 without widening either column.
