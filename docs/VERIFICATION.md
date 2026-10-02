# Prototype verification

Verified locally on Windows on 2026-10-01, using Node.js 24 and the Codex in-app browser.

## Automated checks

- Production TypeScript check and Vite bundle: passed.
- Thirteen Node tests cover seed idempotency, persistence, ordered tags and quarter colors, input validation, transaction rollback, stale revision rejection, Unicode search, pagination, reversible archive, HTTP security, company isolation and portable export/import, independent flags, and the actual MCP SDK transport.
- A disposable SQLite database with 10,025 cards in one list passed count, deep pagination, search and reopen/persistence checks. One measured run: insert 22,122 ms, read a deep 200-card page 46 ms, text search 270 ms. These are observations on one machine, not performance guarantees or a browser stress test.
- MCP tests spawn the real stdio server, discover nine tools in legacy single-database mode, exercise reads and writes and verify shared persistence using another database connection. Multi-company mode adds four company tools and requires companyId for scoped operations; tests verify isolation and export/import. This does not establish installation in a desktop host.

## Browser checks

Created a temporary fictional card; edited country and contact; set last-contact date using the native date field; added a custom tag, checklist item and history note. Verified saved fields and history after page reload. Quarter tag is displayed first. No real customer or mail data used.

Company/flag update: in an isolated data directory, verified Save Changes? / Cancel (retain draft), No (discard), Yes (save and leave); enabled two flags with comments, verified their independent filtered lists, then cleared them through checkboxes and Save. Switched between empty Clab and BrothersInArms databases and verified isolation after creating a fictional Clab card. Exported Clab through the browser, selected the downloaded JSON with the file chooser, and imported it as Clab (import); the copied card appeared in the new database. The browser download event timed out, but the file was saved successfully and its subsequent import completed.

The main database was backed up before the additive migration. Existing 13 demo/user-edited cards remain present. Clab and BrothersInArms start empty; the mail draft package has not been imported. The updated interface screenshot is saved locally under ignored test-results/leader-interface.jpg.

Compact UI follow-up: TypeScript and production bundle passed. Browser verification confirmed three round flag checkboxes in one horizontal row, independent toggles, comments visible only while active, and preservation of a comment when toggled off/on. Test edits were discarded with No; the existing card remained at version 8. Chip logo and favicon updated. Screenshot: test-results/leader-compact-chip.jpg.

## Known boundaries

- Desktop browser prototype, not a packaged Windows installer.
- No real-time push: refresh the page after external MCP changes.
- Archive has no browse/restore UI yet; restore by known ID through MCP.
- There is no automated backup job. Preserve the SQLite file with an appropriate SQLite backup procedure before real-data migration.
- No calendar/reminders, attachments, cloud sync, multi-user access or TickTick/email import.
- Plugin manifests and SDK integration are included; host installation remains a separate step.
- Source and documentation are published to the private Ben-Pin/Leader repository. Client databases remain local and are not part of that source backup.

Run `pnpm test` and `pnpm build` to repeat automated verification. Tests create and remove only their own temporary databases.


## Globe and monochrome navigation — 2026-10-02

Production build and all 20 service, HTTP and MCP tests pass. Geography tests compare full-result aggregates against list, flag, star, tag, quarter, search, country and relationship filters, including intersections, empty results, archived cards and duplicate primary/secondary countries. The 10,025-card test verifies geography is independent of pagination.

Browser QA used a disposable two-card fixture, not customer data. Verified global search, active-flag filtering, country-directory scope, an empty search result, and the expanded globe. Selecting Japan moved its marker to the projection center; an intermediate screenshot showed the transition in progress. The main rail has consistent monochrome icons and logo, neutral glass shading and a visible selected state.

Rotation uses eased requestAnimationFrame updates (650–1100 ms) and memoized dot geometry. Reduced-motion behavior and stale-request handling are implemented; no automated frame-rate or assistive-technology benchmark was performed.

## Five attention flags — 2026-10-02

Production build and all 21 automated tests pass, including a v5-to-v6 SQLite migration fixture, persistence after restart, unchanged legacy flag comments/dates/revisions, independent SW/HW filters and counts, geography, portable export/import and real MCP calls. Browser QA on a disposable company saved both new flag comments and verified the two filtered lists and matching globe. The original blue rail background is restored; the monochrome glass-style icons are retained. Local SQLite backups were created and checked before updating the working databases.
