# Leader

Local customer and partner management for Windows. The browser interface and MCP connector use the same local SQLite databases. The subtitle is **of the lead-free world**.

## Start on this computer

Install Node.js 24 or newer and pnpm. In the cloned repository:

```powershell
pnpm install
pnpm build
pnpm start
```

Open **http://127.0.0.1:4177/** in a browser on that computer. Keep the terminal running while using Leader. On Windows, after the first build you can double-click `start-leader.cmd` to start the server in the background and open the browser automatically. If port 4177 is in use, stop the other Leader server before starting this one.

## Move Leader to another computer

1. Clone the private [Leader repository](https://github.com/Ben-Pin/Leader), then run `pnpm install` and `pnpm build`.
2. On the old computer, open **Company databases**, select Clab and click **Export Clab**. Copy the downloaded Leader JSON file to the new computer. Alternatively, copy a file from `data/backups/clab/`.
3. On the new computer, run `pnpm start` or `start-leader.cmd`, open **http://127.0.0.1:4177/**, then open **Company databases → Connect from Leader JSON file**. Select the JSON file and confirm the company name. Repeat for any other company database you want to move.

The import creates a separate database. Do not import the same snapshot over an existing company; switch to the newly imported company after importing. For an exact transfer of every database and its connections, stop Leader on both computers and copy the entire `data/` directory to the new checkout before starting it. Do not copy a live SQLite file while Leader is running.

GitHub contains the code and Markdown, **not** the cards or mail archive. Treat exports and `data/backups/` as private customer data.

## Backups and recovery

When the standard server starts, it writes a verified JSON snapshot of each connected company to `data/backups/<company-id>/`. It repeats every six hours while running and keeps the newest 28 snapshots per company. The files are ignored by Git. To recover, use **Company databases → Connect from Leader JSON file** and choose a snapshot. Copy backups to another storage location periodically; a disk failure can destroy both the database and backups kept on the same disk.

Run `node scripts/audit-data.mjs clab` for a read-only summary of missing or unverified card fields. It does not change customer data.

## Editing

Card changes save automatically when the card loses focus, closes, or you switch to another card or company. **Undo** discards the current unsaved changes and closes the card. A browser warning appears when you try to close a tab with an unsaved or still-saving change. The footer shows the save state and any error. Ctrl+S also saves.

The four permanent lists are **Customers**, **Prospects**, **Partners**, and **Distributors**. Changing an account type moves the card to its corresponding list. Tags can be assigned to a group when created and moved to another group later. The globe follows the current list, filters and search.

## Notes

The app binds only to the local computer. The MCP connector is implemented but not installed into a user MCP host. The Demo database is fictional. Company JSON export/import is the supported portable format; live cloud sync and mail import are not implemented.

Architecture and APIs: [Architecture](docs/ARCHITECTURE.md), [Product](docs/PRODUCT.md), [API](docs/API.md), [Acceptance](docs/ACCEPTANCE.md), [Connector](docs/CONNECTOR.md).
