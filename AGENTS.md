# Leader development rules

- Read docs/PRODUCT.md, docs/ARCHITECTURE.md and docs/API.md before implementation.
- Keep the UI close to TickTick's three-pane task layout with original Leader branding. Use real working controls, clear Russian text, and compact proportions.
- All UI and MCP writes go through the same service validation and SQLite transaction layer.
- Never commit mail archives, real client data, databases, secrets, access tokens or machine-specific paths.
- Keep demo companies fictional and visibly identify demo data.
- Every card carries a revision number. Reject stale updates rather than silently overwriting.
- Dates use ISO strings; quarter tags are derived from lastContact and always appear first.
- Main list endpoints are bounded and paginated. Test with 10,000 cards in a temporary database.
- Document supported behavior and limitations honestly. Run relevant build, service and MCP checks.
- Prefer soft archive to irreversible deletion. Do not install global services or publish the local app publicly.
