# Acceptance checks

- App builds and opens on Windows in a browser, with all three panes visible at desktop width.
- Demo cards have meaningful fictional content, country, ordered quarter tags and colors.
- Create, edit, complete, star, move, search, filter, tag, checklist and comments work and persist after restart.
- Empty and no-result states are useful. Error states preserve edits.
- All mutation paths use common service validation; invalid dates, bad list/tag IDs and stale revisions fail cleanly.
- 10,000 cards can exist in one list. Queries are paginated and responsive; record test timing.
- MCP initializes, lists tools, reads cards, and writes a test card through shared service. HTTP observes the same state.
- Git ignores database files, logs, credentials, dependency folders and the unrelated mail archive.
- GitHub repository must be PRIVATE; branch `feat/leader-prototype` must contain prototype. Verify actual remote state.

Results will be recorded in docs/VERIFICATION.md after running checks.
