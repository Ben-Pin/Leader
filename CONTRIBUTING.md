# Contributing to Leader

Read [AGENTS.md](AGENTS.md), [Product](docs/PRODUCT.md), [Architecture](docs/ARCHITECTURE.md) and [API](docs/API.md) before changing behavior. Node.js 24+ and the pnpm version in package.json are required.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Use the address printed by Vite for development; the HTTP API runs on loopback port 4177. Stop an existing production instance before starting another on that port. For isolated UI work, use an explicit alternate LEADER_DATA_DIR and PORT so customer databases are not touched.

## Verification

```sh
pnpm build
node --test --test-concurrency=1 tests/*.test.mjs
```

Tests own temporary databases and should never target data/ or a customer export. Sequential execution avoids concurrent test-load interference in measurements. The test suite includes the real MCP transport and 10,025-card fixtures. Record relevant results in docs/VERIFICATION.md and update the user manual when behavior changes.

## Changes and private data

- Browser/API/MCP writes must use the shared service and expected card versions.
- Preserve migration compatibility, stable IDs, contacts, dates, event history and relationships.
- Use fictional examples and clearly labeled demo screenshots.
- Never commit data/, work/, database files, customer exports, PST/mail archives, credentials or machine-specific private paths. Review the staged diff before pushing.
- Use codex/ as the default new branch prefix. Keep commits focused and describe behavior and validation clearly.
- Synchronize package/plugin descriptions and both plugin manifests when changing presentation metadata; preserve plugin identity and connection configuration.

This repository has no published release package or hosted service. A source update is not deployment or proof that a connector is installed in a user's host.

## Releases and manual

Version 1.0.0 is the first release baseline. New/changed functionality advances MINOR; fixes or documentation-only changes advance PATCH; breaking compatibility advances MAJOR. Update package.json and both plugin manifests together. UI and MCP read the package version. Keep the English Markdown manual current and regenerate the bundled PDF with `python scripts/build-user-manual.py` (authoring dependencies: ReportLab and Pillow). Python is not required to run Leader.

After building, `node scripts/preview-demo.mjs` starts an isolated woodland Demo on port 4180. It uses a temporary directory and never opens customer databases. Capture current screenshots into docs/screenshots/; all people and companies in documentation must be fictional. regions.json stores the pixel regions used in the PDF; recapture those regions when screenshot dimensions change. Keep complete fields, notes and controls visible and inspect the embedded images, not only the source screenshots. The illustrated piece catalogue uses docs/game-piece-personalities.json and finished assets under public/tokens/. Render the PDF and inspect every page before committing it.
