# Acceptance checklist

Current target: Leader 1.0.1. Run checks on disposable fictional databases; do not use customer records as fixtures. Results belong in [Verification](VERIFICATION.md).

## Installation and operation

- Locked dependency install and production TypeScript/Vite build succeed with Node.js 24+.
- Production browser UI opens at the printed loopback address and persists edits after restart.
- Company switching, new database creation, full export/import, disconnect/reconnect and data isolation work.
- Automatic startup/periodic snapshots validate, retain the configured count and import into a new company.

## Cards and organization

- Six permanent lists appear in spectrum order and resist deletion; hidden lists retain data. Empty custom lists can be deleted.
- Account category/list stay aligned; saved/intermediate draft moves create dated History; Undo discards unsaved moves.
- Contact/Evaluation/Ramp Up/Production/Legacy are independent of lists. Priority sorting/filtering, markers and globe scope agree.
- Autosave, Ctrl/Cmd+S and Undo work; errors retain drafts and stale revisions never silently overwrite.
- Contacts keep IDs/statuses/roles; blank roles are accepted. History requires valid participants and retains their snapshots.
- Five independent flags preserve comments, record on/off events, and UI toggles update Last contact.
- Tags can be assigned/reassigned to groups and deleted; quarter tags stay first and include future dates.
- Global search, paginated lists and country directory/geography share the correct effective selection. Search does not pretend to cover History text.
- List import supports preserved/target categories, duplicate-ID skipping, Imported markers and atomic validation. Export includes all matching pages and applies both privacy switches only to its copy.
- Next-step checklist, partner links and stars persist. Archive by ID is reversible; no in-app archive browser is claimed.

## Appearance, scale and integration

- Settings save browser preferences; custom map validation enforces square shape and limits. Map is displayed at 70% opacity.
- Gallery opens Mascot, loads fully decoded batches, and selects finished pieces. Holding enlarges one in place; release returns it.
- Narrow layouts and reduced-motion preferences remain usable.
- 10,025-card fixtures verify counts, deep pagination, search and persistence without an application list cap.
- Real MCP SDK tests verify tool discovery, shared writes, revisions, participants and company isolation.
- Git contains no real databases, exports, mail archives, secrets or private audit material.
- Repository visibility remains private. Source and documentation on main match the delivered application.

Platform claims must distinguish code compatibility from physical-machine tests. Passing the local Windows suite does not prove Linux/ARM64 or macOS browser/runtime operation.
