# Leader development rules

- Read docs/PRODUCT.md, docs/ARCHITECTURE.md and docs/API.md before implementation.
- Keep the UI close to TickTick's three-pane task layout with original Leader branding. Use real working controls, clear English text, and compact proportions.
- All UI and MCP writes go through the same service validation and SQLite transaction layer.
- Never commit mail archives, real client data, databases, secrets, access tokens or machine-specific paths.
- Keep demo companies fictional and visibly identify demo data.
- Every card carries a revision number. Reject stale updates rather than silently overwriting.
- Dates use ISO strings; quarter tags are derived from lastContact and always appear first.
- Main list endpoints are bounded and paginated. Test with 10,000 cards in a temporary database.
- Document supported behavior and limitations honestly. Run relevant build, service and MCP checks.
- Prefer soft archive to irreversible deletion. Do not install global services or publish the local app publicly.

- Release baseline: 1.0.0. Increment the minor version for functional additions/changes, patch for fixes/docs, and major for breaking compatibility. Keep package, plugin manifests, UI, MCP and documentation versions aligned.
- Initial release preparation remains version 1.0.0, including corrections found on 5 October 2026. Keep the public release on main; subsequent development belongs on branch 1.1.
- The English PDF manual is bundled under public/ and opened locally from About; update it with user-facing functionality.
