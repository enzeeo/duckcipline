# Duckcipline Development

## Requirements

- Node.js `>=20.19.0`
- npm
- Chrome with extension developer mode enabled

Install dependencies:

```bash
npm ci
```

## Commands

```text
npm run typecheck       TypeScript only
npm test                Run Vitest tests once
npm run test:watch      Run Vitest in watch mode
npm run build           Typecheck and build extension into dist/
npm run build:watch     Rebuild extension on file changes
npm run dev             Vite dev server
npm run package         Build release/duckcipline-0.1.0.zip
npm run assets:prompts  Generate sprite-sheet prompt batches
npm run assets:extract  Crop selected sprite sheets into runtime assets
npm run assets:verify   Verify pixel asset contracts
```

## Load The Extension

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Choose "Load unpacked".
5. Select this repo's `dist/` directory.

After source changes, rebuild and reload the extension from `chrome://extensions`.

## Testing Strategy

Use the smallest relevant check for the changed area:

- Timer math: `src/timer/timerState.test.ts`
- Background orchestration: `src/background/backgroundApplication.test.ts`
- Shared game rules: `src/shared/*test.ts`
- Popup runtime/client rendering helpers: `src/popup/*test.ts`
- Full code check: `npm run build`
- Manual Chrome QA: [MANUAL_TESTING.md](MANUAL_TESTING.md)

Docs-only changes can usually be verified with `git diff --check`.

## Asset Workflow

Runtime image assets are local. No remote asset loading should happen inside the extension.

Asset workflow notes live in [../workflow/README.md](../workflow/README.md). Main contracts:

- Duck, egg, tile, nest, rock, reeds, and lily pad assets are `32x32`.
- Tree assets are `64x64`.
- The walking animation is named `wander` in code and filenames.
- Canvas rendering must keep drawn fallbacks for missing PNG assets.

## Release Package

Run:

```bash
npm run package
```

The package script builds the extension and writes `release/duckcipline-0.1.0.zip`.

