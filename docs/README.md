# Duckcipline Docs

This folder documents how the repo works and where future agents should look first.

## Start Here

- [Architecture](ARCHITECTURE.md): extension runtime, state ownership, module boundaries.
- [Development](DEVELOPMENT.md): setup, commands, local loading, tests, packaging.
- [Data and Messages](DATA_AND_MESSAGES.md): storage keys, message contracts, state flow.
- [Design Contract](DESIGN.md): product surface, visual tokens, asset expectations.
- [Manual Testing](MANUAL_TESTING.md): Chrome extension smoke and regression checks.
- [TODO](TODO.md): roadmap and known follow-up work.

## Related Root Files

- [../CONTEXT.md](../CONTEXT.md): compact domain vocabulary and repo rules.
- [../MEMORY.md](../MEMORY.md): durable decisions for future sessions.
- [../SESSION.md](../SESSION.md): latest session handoff.
- [../ERRORS.md](../ERRORS.md): repeated setup or debugging traps.

## Current Product Shape

Duckcipline is a Manifest V3 Chrome side panel extension. It has a timestamp-based focus timer, local project progress, duck rewards, and a canvas homestead. The background service worker owns canonical timer and game state. The popup is a UI client that sends typed messages and renders responses.

