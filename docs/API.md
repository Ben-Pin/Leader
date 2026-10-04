# Shared API contract v1

All responses JSON. Errors: `{error: string, code?: string}` with appropriate HTTP status. API prefix `/api`.

`Card`: `{id,listId,title,description,company,country,contactName,email,lastContact,dueDate,status,priority,completed,starred,archived,version,createdAt,updatedAt,tags,checklist,activity}`.

- `status`: `lead | contacted | qualified | proposal | client`.
- `importedPending`: boolean marker for a list-imported card, cleared by its first saved edit.
- `priority`: integer 0 (none), 1 (low), 2 (medium), 3 (high).
- `lastContact`, `dueDate`: `YYYY-MM-DD` or empty/null.
- `tags`: `[{id,name,color}]`; derived quarter tag appears first (id `quarter:YYYY-Q`).
- `checklist`: `[{id,text,done}]`.
- `activity`: `[{id,text,createdAt,contacts}]`, newest first.
- Input tags use `tagIds: string[]`. Quarter tags must not be submitted in tagIds.
- `flags`: `{inQuote:{active,comment}, logisticsIssue:{active,comment}, administrativeIssue:{active,comment}, swIssue:{active,comment}, hwIssue:{active,comment}}`. Updates may supply any subset of flag keys. Comments are single-line, at most 300 characters. Clearing a flag does not implicitly erase its comment.
- `accountType`: `unspecified | client | distributor | partner`; `distributorIds`: up to 20 same-company partner/distributor IDs. Read responses include `distributors` summaries and non-archived `clientCount`. Search accepts `distributorId` and `accountType` (including `channel` for both partner types). Links reject self-reference and cycles and survive export/import.
- `contactQuarter`: optional `YYYY-Q` fallback when an exact contact day is unknown. `lastContact` takes precedence. Fallback tags are displayed first, colored and filterable, without fabricating a date.
- `List`: `{id,name,color,count}`; `Tag`: `{id,name,color,count}`.

## HTTP

- GET `/bootstrap` -> `{lists,tags,stats:{total,active,completed,starred},csrfToken,demo:true}`.
- GET `/cards?listId=&tag=&q=&view=all|active|completed|starred&sort=updated|contact|title&limit=100&offset=0` -> `{items,total,limit,offset}`. `tag` is tag id or `quarter:YYYY-Q`.
- GET `/cards/:id` -> Card.
- POST `/lists/import` `{bundle,mode,targetListId?}` -> `{created,skipped,omittedLinks}`. `bundle` is a version-1 `leader-list` export with at most 10,000 cards; `mode` is `preserve` (route by each card's `accountType`) or `target` (use the permanent `targetListId` and its category). The operation is atomic, preserves supplied notes/history and tags, skips existing card IDs, and marks newly imported cards until their first saved edit. Links to unavailable distributors are omitted and counted.
- POST `/cards` body partial Card, required title/listId -> Card.
- PATCH `/cards/:id` body fields to change + required version -> Card.
- PATCH may include `flagEvents:[{kind,active,comment,happenedAt}]` for every unsaved flag toggle; the final event states must match the saved flags. Without this array, a flag state change records a single dated event automatically. History entries include `kind: note | flag`. Flag events do not require contact participants.
- POST `/cards/:id/comments` `{text,version,contactIds}` -> Card.
- POST `/lists` `{name,color}` -> List.
- POST `/tags` `{name,color}` -> Tag.
- GET `/health` -> `{ok:true}`.

Browser writes send `X-Leader-Token: csrfToken`. All scoped requests send `X-Leader-Company: companyId`; this is mandatory for writes. Bootstrap includes `company`, `companies`, and flag counts in stats. `view=active` means at least one active flag; `view=inQuote|logisticsIssue|administrativeIssue|swIssue|hwIssue` selects that flag. The UI no longer uses legacy completion.

- GET `/companies` -> `{companies:[{id,name}]}`.
- POST `/companies` `{name}` -> new empty `{id,name}`.
- GET `/companies/:id/export` -> complete `leader-company` JSON with downloadable filename.
- POST `/companies/import` `{name,bundle}` -> newly connected `{id,name}`. Validates the full bundle; existing databases are not overwritten.

Normal startup uses the company registry. Explicit `LEADER_DB` or `LEADER_DB_PATH` remains supported for a single fixed database (tests/legacy integrations), without company management routes. `LEADER_DATA_DIR` selects an alternate company directory for isolated testing.

## Shared service module server/store.mjs

Export `createStore({path,seed=true})` returning `bootstrap()`, `listCards(query)`, `getCard(id)`, `createCard(input)`, `updateCard(id,input)`, `addComment(id,input)`, `createList(input)`, `createTag(input)`, `close()`.

MCP uses the same operations with schemas, stable IDs, and revision preconditions. Destructive operations are limited to reversible archive.

In normal multi-company mode MCP adds list_companies, create_company, export_company and import_company; existing scoped tools require companyId. Flags and view filters use the same service validation as the browser.

- GET `/geography` -> `{countries:[{country,count}],total}`. Accepts the same selection filters as `/cards`: `listId`, `view`, `tag`, `q`, `country`, `accountType`, `distributorId`. Pagination and sorting do not restrict geography totals. The selected company is scoped through `X-Leader-Company`. The country directory uses `/cards` with the original filters plus `country` and bounded pagination.


`contacts`: ordered array of `{id,name,role,email,status}` (maximum 100). IDs are optional on input and generated when omitted; name <=300, role <=500, email <=320 characters. Each nonempty email is validated. Empty rows are omitted. Providing contacts replaces the complete collection; omitting it preserves contacts. Legacy `contactName`/`email` remain first-contact mirrors: legacy patches update only the first contact and retain its role and other contacts. If both formats are supplied, contacts takes precedence. All changes use the card revision and shared HTTP/MCP service; portable export/import includes contacts and accepts older single-contact packages.


Contact status accepts `active | main | inactive | disturbing | useful | decisions`, default active. `add_comment` / POST comments requires 1–100 contact IDs belonging to that card; missing/empty/foreign IDs are rejected without mutation. Activity contacts are snapshots of the selected contact records, preserving attribution after edits or removal. Old history imports may omit contacts; they remain unlinked rather than inventing participants.
