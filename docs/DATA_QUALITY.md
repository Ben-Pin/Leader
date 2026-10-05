# Data quality and evidence

Customer data and local audit results do not belong in Git. This document describes the workflow rather than a dated snapshot of a private database.

## Review rules

- Use readable, correctly capitalized company names rather than domain names.
- Keep About customer as concise facts, requirements, constraints and agreements. Separate inquiries/forecasts from confirmed orders.
- Unknown country, exact contact date, employer and Position/Role remain blank unless evidence supports them. A quarter does not establish a day.
- Represent each identified company contact separately; new contacts default to active. Preserve existing IDs, statuses and known roles.
- Attach new discussion notes to actual card contacts. Include original correspondence dates in text when recording an older exchange.
- Check existing titles and contacts before creating accounts. Matching by ID is stronger than matching by a similar name; list import skips matching IDs, but does not deduplicate equal company names.
- Preserve later contact dates, user descriptions, Priority, Stage, flags, tags, links and History during assistant enrichment. Use partial validated service writes with current revisions.
- A confirmed purchase may establish Customers. A forecast, RFQ or evaluation request alone does not. Stage remains independent of account category.

## Local audit

From the checkout, run `node scripts/audit-data.mjs <company-id>`; for the fictional workspace, use `demo`. Find actual IDs through GET /api/companies or MCP list_companies. The script defaults to the fictional demo when no ID is supplied; supply the selected database ID explicitly for other workspaces.

The report counts cards by list, unverified/empty countries, missing exact contact dates, absent contacts/emails/descriptions, category/list mismatches and History entries. It deliberately makes no card edits. Opening an older database through the shared manager can perform normal schema/list initialization, so export it before auditing an older installation.

Keep reports and source correspondence in ignored local storage such as work/. Reconcile gaps against supplied correspondence or official company information; never fill a field simply to reduce a missing-data count. PST/mail parsing is an external review workflow, not Leader's built-in JSON import.
