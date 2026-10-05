# Leader 1.0.0 verification

Verified locally on Windows on 4 and 5 October 2026, using Node.js 24.19.0 and the Codex in-app browser. All test data was fictional and isolated from customer databases.

## Automated checks

| Check | Result |
| --- | --- |
| TypeScript and production Vite build | Passed |
| Service, HTTP, backup, migration and transfer tests | 39 passed, including the new fresh-installation check |
| Actual stdio MCP SDK integration | 2 passed after the package-version import was corrected |
| Package and both plugin versions | Aligned at 1.0.0 |
| Plugin presentation metadata | Matching; short description within 30 characters; default prompt preserved |
| Bundled manual route | HTTP 200 with application/pdf |
| PDF inspection | Twenty-six pages rendered and visually inspected; clickable contents, English text, ten screenshot figures and all sixty illustrated personalities checked |
| Release-preparation checks | Existing forty checks passed; the new fresh-installation check and five export/company checks passed in a targeted rerun after correcting its fictional-description expectation |

The forty existing checks passed again on 5 October and cover transactional rollback, stale revisions, persistence, migrations, contacts and participant snapshots, flag/list events, account relationships, permanent-list rules, tag groups, future quarter tags, import modes/privacy choices, backup retention, company disconnect/reconnect, filtered geography and real MCP transport. The new check verifies that fresh installation connects only Demo with twelve fictional cards and reserved .example addresses, and that existing connected databases survive a restart. All forty-one checks passed across the suite and the targeted rerun. A disposable 10,025-card fixture verified counts, deep pagination, text search and durability. These checks establish behavior on this machine, not a cross-platform benchmark.

## Browser checks

A disposable two-card workspace served the production build at port 4178. The permanent six-list order and English labels were visible. Add card, List import and List export measured 28 x 28 CSS pixels, matching all five flag filters; all eight shared the same top coordinate in one row. The normal 1280 x 720 viewport and compact 1024 x 576 viewport had no horizontal overflow. The motto remained visible in the compact-height rule that previously hid it when zoom reduced the available CSS viewport.

The woodland preview on port 4180 uses a temporary database with twelve animal-run companies purchasing nuts, vegetables and fruit. Every permanent list contains examples. Acorn & Co. has three contacts, including one with an empty unknown role, and two dated discussions linked to participants. Seeding was tested for persistence and idempotence. Screenshots show the overview, card, contacts, history, export choices and Mascot gallery; no customer data appears in documentation.

About displayed version 1.0.0, Concept and Product: Benjamin Pinkas, a random finished piece and the local PDF link; no current-database block. The piece measured 225 x 246 CSS pixels and occupied its own column beside the product information. Opening About again chose another piece. The supplied transparent white chip image appears in the rail, loading screen, About and favicon. The rail button measured 44 x 44 pixels, its logo 36 x 36, and its horizontal center matched the 38 x 38 neighboring controls. The settings label is Leader's motto. Gallery hold behavior was not changed. See the [fictional desktop interface](screenshots/manual-overview.jpg).

The manual link targets the release-specific bundled file directly with no remote viewer. Its route and PDF contents were verified independently; rendering belongs to the user's browser/PDF handler. The source PDF and served production copy are identical. The manual describes implemented features, uses the current supplied logo, and presents game-piece strengths and luck as fictional stories.

For 1.0.0, the isolated woodland preview supplied fresh 1280 x 720 screenshots of all ten toolbar buttons, two active flag comments, saved flag history and the Auto-tag result. The photographed toolbar is annotated in the PDF from recorded button coordinates. Enabling SW issue, saving its comment, then entering a resolution before disabling it produced two independently dated Flag change entries. The first Auto-tag run examined twelve dated cards and changed eleven stored quarters; repeating it returned zero updates. Service tests also verified archived cards, future 2027-1 groups and preserved undated quarter-only records. The manual groups all five algorithm steps on one page and identifies the frameworks, storage and build tools used by this release.

Final release preparation keeps the user-approved baseline at 1.0.0. About and the sidebar header have matching computed font, weight, letter spacing and dot color. The PDF uses Leader. on its cover and every page header and still has twenty-six inspected pages. Both export paths use the requested local ddmmhh-hhmm suffix; HTTP company downloads also provide a timestamped Content-Disposition filename. Full company export opens the browser save picker before its first data request, suggesting Documents; the native save dialog itself was not automated.

About, README and the English manual explain that company databases and backups stay local and that Leader is intentionally single-user. The manual and connector documentation distinguish local application storage from data returned to an optional MCP host. The updated About layout and all twenty-six regenerated PDF pages were inspected; both local preview servers returned the exact source PDF and version 1.0.0.

Before changing GitHub visibility, all twenty-three existing commits and their 347 unique file blobs were checked. They contain no databases, mail archives, private exports, personal machine paths or credential patterns. Both historical PDF versions contain fictional data; historical demo seeds use reserved example addresses. Email-pattern matches outside the reserved domains were the literal name@company.com input placeholder, now changed to name@company.example. Artwork and manual screenshot assets contain only the supplied artwork and fictional Demo.

## Boundaries

- Linux/ARM64 and macOS have not been verified on physical machines for this release.
- The suite tests the MCP protocol, not actual installation into a desktop host or cloud ChatGPT.
- No live push; refresh after external edits. Archive restore is by known ID through API/MCP.
- Standard multi-company HTTP schedules local backups; single-database mode and standalone MCP do not.
- No built-in PST/mail importer, outgoing email, reminders, attachments or cloud sync. Wisdom has no connected content source; figure relighting remains a study.
- Private databases, correspondence and audit reports remain excluded from Git.

Repeat with `pnpm build` and `node --test --test-concurrency=1 tests/*.test.mjs`. Tests create only disposable databases.
