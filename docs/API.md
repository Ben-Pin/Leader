# Shared API contract v1

All responses JSON. Errors: `{error: string, code?: string}` with appropriate HTTP status. API prefix `/api`.

`Card`: `{id,listId,title,description,company,country,contactName,email,lastContact,dueDate,status,priority,completed,starred,archived,version,createdAt,updatedAt,tags,checklist,activity}`.

- `status`: `lead | contacted | qualified | proposal | client`.
- `priority`: integer 0 (none), 1 (low), 2 (medium), 3 (high).
- `lastContact`, `dueDate`: `YYYY-MM-DD` or empty/null.
- `tags`: `[{id,name,color}]`; derived quarter tag appears first (id `quarter:YYYY-Q`).
- `checklist`: `[{id,text,done}]`.
- `activity`: `[{id,text,createdAt}]`, newest first.
- Input tags use `tagIds: string[]`. Quarter tags must not be submitted in tagIds.
- `List`: `{id,name,color,count}`; `Tag`: `{id,name,color,count}`.

## HTTP

- GET `/bootstrap` -> `{lists,tags,stats:{total,active,completed,starred},csrfToken,demo:true}`.
- GET `/cards?listId=&tag=&q=&view=all|active|completed|starred&sort=updated|contact|title&limit=100&offset=0` -> `{items,total,limit,offset}`. `tag` is tag id or `quarter:YYYY-Q`.
- GET `/cards/:id` -> Card.
- POST `/cards` body partial Card, required title/listId -> Card.
- PATCH `/cards/:id` body fields to change + required version -> Card.
- POST `/cards/:id/comments` `{text,version}` -> Card.
- POST `/lists` `{name,color}` -> List.
- POST `/tags` `{name,color}` -> Tag.
- GET `/health` -> `{ok:true}`.

Browser writes send `X-Leader-Token: csrfToken`. UI refreshes bootstrap summaries after writes.

## Shared service module server/store.mjs

Export `createStore({path,seed=true})` returning `bootstrap()`, `listCards(query)`, `getCard(id)`, `createCard(input)`, `updateCard(id,input)`, `addComment(id,input)`, `createList(input)`, `createTag(input)`, `close()`.

MCP uses the same operations with schemas, stable IDs, and revision preconditions. Destructive operations are limited to reversible archive.
