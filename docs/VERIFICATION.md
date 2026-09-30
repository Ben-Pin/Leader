# Prototype verification

Verified locally on Windows on 2026-10-01, using Node.js 24 and the Codex in-app browser.

## Automated checks

- Production TypeScript check and Vite bundle: passed.
- Nine Node tests cover seed idempotency, persistence, ordered tags and quarter colors, input validation, transaction rollback, stale revision rejection, Unicode search, pagination, reversible archive, HTTP security and the actual MCP SDK transport.
- A disposable SQLite database with 10,025 cards in one list passed count, deep pagination, search and reopen/persistence checks. One measured run: insert 22,122 ms, read a deep 200-card page 46 ms, text search 270 ms. These are observations on one machine, not performance guarantees or a browser stress test.
- MCP tests spawn the real stdio server, discover all nine tools, exercise reads and writes and verify shared persistence using another database connection. This does not establish installation in a desktop host.

## Browser checks

Created a temporary fictional card; edited country and contact; set last-contact date using the native date field; added a custom tag, checklist item and history note. Verified saved fields and history after page reload. Quarter tag is displayed first. No real customer or mail data used.

## Known boundaries

- Desktop browser prototype, not a packaged Windows installer.
- No real-time push: refresh the page after external MCP changes.
- Archive has no browse/restore UI yet; restore by known ID through MCP.
- There is no automated backup job. Preserve the SQLite file with an appropriate SQLite backup procedure before real-data migration.
- No calendar/reminders, attachments, cloud sync, multi-user access or TickTick/email import.
- Plugin manifests and SDK integration are included; host installation remains a separate step.
- GitHub publishing depends on the user completing browser sign-in. Local source and branch do not imply that a private remote exists.

Run `pnpm test` and `pnpm build` to repeat automated verification. Tests create and remove only their own temporary databases.
