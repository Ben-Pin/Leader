# Leader

Local lead management for Windows, with a TickTick-inspired browser interface and an MCP connector sharing the same data model. The name comes from **lead**.

Prototype scope: editable cards, lists, ordered color tags, country, last-contact quarter, search, filters, completion, and persistent SQLite storage. At least 10,000 cards per list is the target. Demo data is fictional; the private mail archive is never part of this repository.

## Development

Requires Node.js 24 LTS and pnpm. Install with `pnpm install`, run `pnpm dev`, and open the printed localhost URL. Production: `pnpm build` then `pnpm start`. Windows launcher: `start-leader.cmd`.

Architecture is defined in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), requirements in [docs/PRODUCT.md](docs/PRODUCT.md), the API contract in [docs/API.md](docs/API.md), and verification in [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md).

The local database and backups live under `data/` and are ignored by Git. No customer archive is uploaded to GitHub.
