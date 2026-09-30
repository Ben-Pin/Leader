# Leader local MCP connector

The prototype includes a local stdio MCP server with nine tools. It uses the same `server/store.mjs` validation, transactions, revision checks and SQLite file as the browser API. An assistant can read and edit the same cards shown in Leader.

## Running

Use Node.js 24 on `PATH` and install the repository's pinned dependencies before connecting. The entrypoint is `node server/mcp.mjs`; it waits for MCP messages on standard input. Standard output is reserved for protocol messages. Diagnostics go to standard error. The browser server does not need to be running for MCP operations.

The default file is `data/leader.sqlite`, resolved relative to this source checkout, regardless of the launching process's working directory. Both HTTP and MCP can run simultaneously. Set an absolute `LEADER_DB` path in both processes to share another database. Set `LEADER_SEED=false` to suppress fictional demo seed data in a fresh database.

`plugin.json` and `mcp.json` form a portable Agent Plugins package. `.codex-plugin/plugin.json` supplies matching compatibility metadata for Codex hosts. `${PLUGIN_ROOT}` is expanded by the plugin host. The package identifier is lowercase `leader`; use a lowercase `leader/` root when making a distributable archive. The Windows checkout may retain the product name `Leader`.

This delivery is source-only: no marketplace entry, global service, account upload, or installed Codex connector is implied. A host that copies a plugin into its cache must be configured with the same absolute `LEADER_DB` path as the running browser app; otherwise its default database belongs to that copied checkout. Host installation and an actual in-host smoke test are separate steps.

## Tools

| Tool | Purpose |
| --- | --- |
| `list_lists` | List IDs, names, colors and card counts |
| `list_tags` | List custom and derived quarter tags |
| `search_cards` | Filter by list/tag/text/view; sort and page through results |
| `get_card` | Read fields, tags, checklist, activity and current version |
| `create_card` | Create a card with required `title` and `listId` |
| `update_card` | Change fields, move a card, complete, star, archive or restore |
| `add_comment` | Append contact history or a note |
| `create_list` | Create a list |
| `create_tag` | Create a custom color tag |

`search_cards` returns `{items,total,limit,offset}`. Its default page is 100 cards and maximum page is 200. Fetch subsequent pages by adding the page size to `offset` until the total is reached. Archived cards are omitted from search but remain readable by ID.

`update_card` and `add_comment` require the `version` returned by the latest read. A stale version returns a tool error with status 409. Read the current card and reconcile the changes; do not blindly replay an old edit. Results contain JSON text and matching `structuredContent`. Service failures use `isError: true` and a structured error code.

The `lastContact` field uses a calendar date in `YYYY-MM-DD` format; its quarter tag is generated and placed first by the shared service. Supply custom `tagIds` only. The connector supports reversible `archived` updates and exposes no permanent-delete tool.

## Verification and limits

`node --test tests/mcp.test.mjs` launches the actual server as a child process and uses the official SDK client to initialize it, discover tools, create/read/edit/search cards, manage tags/lists, reject stale writes and invalid dates, add history, archive/restore and verify persisted data through a separate SQLite connection. It uses a disposable temporary database, never the demo database.

The implementation uses the official SDK's [v1 server API](https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.x/docs/server.md) and [stdio client](https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.x/docs/client.md). Dependency versions are locked in the package lockfile.

This local process is available to a desktop MCP host with filesystem access. It does not provide a remote HTTPS endpoint or automatically connect to cloud ChatGPT. Remote access, authentication and deployment remain separate work. There are no outbound API calls, email sending or TickTick synchronization in this connector.
