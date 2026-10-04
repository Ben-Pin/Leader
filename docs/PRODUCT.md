# Leader product

Leader 1.0.0 is a single-user local workspace for company databases, contacts and relationships, including BD, sales, partnerships and job searching. The English browser UI and optional MCP connector share the same validated SQLite service. This document describes implemented behavior; [the user manual](USER_MANUAL.md) explains operation.

## Account organization

Each connected company has independent cards, lists, tags, contacts and History. A fresh checkout provides fictional Demo data and empty additional workspaces. Real customer databases are supplied separately and are never part of source control.

Six permanent lists appear in spectrum order: **Leads, Prospects, Opportunities, Customers, Partners, Agents**. List and account category stay synchronized. Lists cannot be deleted, but can be hidden in User settings. Existing Distributors is renamed to Agents while retaining IDs and relationships. Saved moves record source, destination and timestamp in History. Custom lists remain available; only empty custom lists can be deleted.

Stage is a separate project axis: **Contact, Evaluation, Ramp Up, Production, Legacy**. Stage does not move cards. Priority has four values: unset, Low, Medium, High; it supports filtering, sorting and a visible label next to the star. Stage remains on the right beneath Last contact. Important is the independent starred view.

## Cards and contacts

The compact three-pane interface includes an icon rail, lists/tags and globe, a paginated card list, and wider details. Details have **Card, Contacts, History** tabs. Core properties are paired; descriptions grow with content. The UI remains usable on narrow screens through navigation/detail panels.

Cards contain a readable name, primary/secondary country, Last contact, Next step date, About customer, checklist, agent/partner links, five flags, Stage and Priority. Repeatable contact rows contain name, Position, email and one of **active, main, inactive, disturbing, useful, decisions**. New contacts default to active. Unknown roles stay blank. Up to 100 contacts are supported.

Discussion notes require at least one existing contact on the card and retain participant snapshots. Older unlinked history remains readable. Notes save immediately through Add note; their creation timestamp is not an inferred historical correspondence date.

Card fields autosave on leaving/closing the card, switching database or browser focus loss. Ctrl/Cmd+S saves explicitly. Undo discards the unsaved draft and closes; it is not a rollback of previously saved edits. Errors preserve the draft and stale revisions are rejected.

## Attention and activity

Independent flags: **In quote** (green dollar), **Logistics issue** (yellow truck), **Administrative issue** (red warning), **SW issue** (blue Tux), **HW issue** (gray wrench). Active flags show a single-line comment, maximum 300 characters. Clearing preserves the comment. Each saved enable/disable produces dated History; multiple draft transitions are retained. A UI toggle also sets Last contact to today's local date. In work means any active flag.

Last contact derives a first-position **YYYY-Q** tag, including future years such as 2027-1. Auto-tag synchronizes quarter metadata across dated cards in the selected company. Exact dates are never fabricated from an unknown day; a fallback quarter is supported by the service.

## Search and geography

Text search covers the entire selected company rather than the current sidebar list, tag or flag view. Stage and Priority filters still apply. Search includes names, countries, contact names/roles/emails, description, flag comments and custom tag names; it excludes History-note and checklist text. Sorting supports contact date, Priority, update time and name.

The globe and country directory use the list's effective query across all pages. Primary and secondary distinct countries both count. Points spread across the country are visual positions, not office geocodes. Unknown/unrecognized countries cannot be plotted. Selecting a country/card triggers eased rotation; dragging interrupts it. Reduced-motion preferences reduce animation. Geography uses Natural Earth through world-atlas/topojson-client.

## Transfer and persistence

List export includes every matching page and offers independent About customer/History switches. List import accepts leader-list JSON, skips existing IDs, and either preserves account categories or replaces them with a selected permanent-list category. Imported records are marked until their first saved edit. Available links are restored; unavailable links are reported. Full leader-company JSON transfers/restores a complete database as a new company.

Local SQLite persists across restarts. Standard multi-company startup creates verified JSON backups and repeats every six hours while running, retaining 28 per company. Disconnect preserves database files and permits reconnection. Source control excludes databases, backups, correspondence, private reports and credentials.

## Personal appearance

Blue rail, monochrome icons, translucent surfaces and subtle motion. User settings include display name, the default motto **of the lead-free world**, hidden permanent lists, Wisdom and background map. A custom map must be square PNG/JPEG/WebP, at most 20 MB and 8192 pixels per side; the empty detail area shows it at 70% opacity without distortion.

Sixty finished transparent game pieces are selectable from a gallery opening on Mascot, including Lucky cat and Einstein. Click previews; double-click/Use this piece selects. Holding enlarges the same figure in place with slight wobble; release returns it. These are local PNG assets, not 3D models. Browser preferences/custom maps are separate from database exports.

## Boundaries

Tested desktop environment: Windows with Node.js 24 and a browser. Linux/ARM64 and macOS use the same intended runtime workflow but are not physically verified. Leader is not a packaged desktop installer, multi-user CRM or public hosting service. There is no cloud synchronization, email sending, built-in mail/PST/TickTick importer, reminders or attachments. Wisdom has no content source. Pointer-directed piece lighting remains research. MCP tools are implemented and tested; host installation is not automatic.
