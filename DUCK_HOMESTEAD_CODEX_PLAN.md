# Duckcipline Homestead Codex Plan

## Product Goal

Build Duckcipline into a cozy Chrome side panel focus timer where users earn duck and seed rewards by completing focused work sessions. The extension should feel like a cute pixel-art duck homestead: users hatch duck eggs, grow seed batches, feed ducks, name ducks, place ducks into a pannable homestead map, and watch them wander or interact with ponds and the environment.

This plan is written for Codex. Follow the goals in order. Preserve the existing working Chrome extension structure and refactor carefully instead of rewriting from scratch.

---

## Current Repo Context

The repo is already a Chrome Manifest V3 extension built with Vite and TypeScript.

Existing architecture includes:

- `@crxjs/vite-plugin`
- Manifest V3 configuration
- A Chrome side panel using `src/popup/popup.html`
- A background service worker at `src/background/background.ts`
- Timer message flow through `chrome.runtime.sendMessage`
- Timer state stored in `chrome.storage.session`
- Duck reward state stored in `chrome.storage.local`
- Two hardcoded duck egg rewards
- Current UI is a plain single-column timer side panel.
- No `DESIGN.md` or reusable design system exists yet.
- `src/assets/ducks/` exists, but the V1 pixel asset pack still needs to be created.

Preserve this foundation. Extend it into a broader persistent game system.

---

## Locked Product Decisions

### Theme

- V1 is ducks only.
- No chickens or chicks.
- Use language like egg, duckling, young duck, adult duck, seeds, homestead.

### App Surface

- V1 lives entirely in the existing Chrome side panel.
- Use two top-level tabs:
  - `Focus`
  - `Homestead`
- New Tab mode is future scope only.

### Persistence

Persist all long-term game state in `chrome.storage.local`:

- Ducks
- Duck names
- Duck variants
- Duck growth stages
- Duck placement status
- Duck map positions
- Seed count
- Active egg or seed project
- Project progress
- Homestead state
- Long-term stats

The timer may still use session-like behavior, but active project progress must not be lost when the side panel closes or Chrome windows close.

When all Chrome windows close:

- Stop/pause the active running focus timer.
- Save project progress earned so far.
- Do not grant offline focus progress after Chrome is closed.
- Do not reset ducks, seeds, homestead, or project progress.

### Focus Reward Model

- User must select one active project before starting focus.
- Only one active project can exist at a time.
- Active project can be either:
  - Egg hatching project
  - Seed growing project
- Focus timer duration and project requirement are separate systems.
- Example: if an egg needs 60 minutes and the user focuses for 40 minutes, the egg has 40 / 60 minutes progress.
- No automatic spillover. If a project completes before the timer ends, extra focus time does not automatically go into another project.
- Claiming waits until the timer is not running.
- Earned project progress is never lost accidentally.
- User may change the active project only when the timer is not running.
- Changing active project preserves earned progress for every project.
- Abandon/reset project progress is not a normal V1 flow.
- No early-stop penalties.

### Seeds

- Seeds are a global inventory count in V1.
- No crop planting, watering, or crop tiles in V1.
- Seed projects produce seeds when claimed.
- Seeds are spent through duck feeding.

### Duck Lifecycle

Ducks have three growth stages:

1. `duckling`
2. `youngDuck`
3. `adultDuck`

Growth uses manual seed feeding:

- Duckling to young duck: 5 seeds
- Young duck to adult duck: 10 seeds
- Total to fully grow one duck: 15 seeds

Duck stats are cozy/info-only except growth progress.

Duck menu should include:

- Editable name
- Variant/type
- Growth stage
- Seeds fed toward next stage
- Seeds needed for next stage
- Age since hatched
- Favorite activity/personality text
- Current activity
- Feed button
- Rename input/button

Duck name rules:

- Max display/edit length is 18 characters.
- Trim leading/trailing whitespace.
- Empty submitted name resets to a generated default name.
- Duplicate names are allowed in V1.

No hunger, death, sickness, decay, sadness, or punishment systems in V1.

### Duck Hatching

- Egg type determines a random hatch table.
- Variant is rolled only when the completed egg is claimed, not when the egg is selected.
- Claimed duck is created as an unplaced duck.
- Unplaced ducks are stored in game state and shown in the Homestead tab as sprite thumbnails only.
- User drags an unplaced duck thumbnail or uses click-to-place to place it on the homestead map.
- Once placed, duck starts wandering/interacting.

V1 hatch tables:

| Egg | Variant | Chance |
|-----|---------|--------|
| Meadow Egg | `meadow-a` | 50% |
| Meadow Egg | `meadow-b` | 50% |
| Pond Egg | `pond-a` | 45% |
| Pond Egg | `pond-b` | 45% |
| Pond Egg | `fancy-a` | 10% |
| Fancy Egg | `fancy-a` | 45% |
| Fancy Egg | `fancy-b` | 45% |
| Fancy Egg | `pond-b` | 10% |

### Duck Capacity

- V1 max total ducks: 20.
- This includes placed and unplaced ducks.
- If total ducks reach 20, disable egg projects.
- Seed projects remain available.

### Homestead

- Use HTML Canvas for the homestead.
- Timer/project UI remains normal HTML.
- Fixed map, but pannable viewport.
- Map is 48 x 36 tiles.
- Tile size is 32 px.
- Logical world size is 1536 x 1152 px.
- The homestead world is intentionally larger than the side panel viewport.
- Canvas viewport shows only a window into the larger homestead world.
- Canvas viewport is inset from the side panel with a visible 12 px inner frame/gutter.
- The authored map includes a 2-tile scenic padding buffer around the playable homestead content.
- User drags empty map space to pan the camera.
- Camera is clamped to world bounds.
- Ducks and objects use world coordinates.
- Collision uses the tile grid.
- User can drag placed ducks to new valid locations.
- User cannot place ducks on trees, rocks, water, or outside the map.
- Ducks may enter water by their own AI later if valid.

### Duck AI

Use simple idle AI:

- Idle
- Wander
- Swim
- Rest
- Eat

Rules:

- No complex whole-map pathfinding in V1.
- Duck picks nearby valid target tiles.
- Movement updates only while Homestead tab/view is open.
- Save duck state/position when leaving the view or when useful.
- On reopen, resume from saved position/state.
- Pond variants prefer water slightly more often.
- Fancy variants are cosmetic in V1.

### Art

- Art style: 2D pixel art, cozy, Stardew Valley-like inspiration.
- Use static PNG sprite assets checked into the repo.
- Use transparent PNGs where possible.
- Use fallback Canvas-drawn placeholders when assets are missing.
- Extension runtime should not depend on image generation APIs.
- Goal 0 may use ChatGPT image generation to create the committed source PNG asset pack.

Recommended asset structure:

```text
src/assets/pixel/
  tiles/
    grass.png
    grass-variant-1.png
    dirt-path.png
    water.png
    pond-edge.png
  objects/
    tree.png
    rock.png
    flower.png
    seed-bag.png
  ducks/
    meadow-duckling.png
    meadow-young.png
    meadow-adult.png
    pond-duckling.png
    pond-young.png
    pond-adult.png
    fancy-duckling.png
    fancy-young.png
    fancy-adult.png
  ui/
    egg-meadow.png
    egg-pond.png
    egg-fancy.png
    seed-icon.png
```

If assets are not present yet, implement a robust fallback renderer.

### Sound and Notifications

- V1 has no sounds.
- V1 has no Chrome notifications.
- Do not add notification permission yet.
- Visual ready/claim states inside the side panel are enough.

### Debug Mode

Add temporary debug balance as a code constant, not a visible user setting.

Example:

```ts
const IS_DEBUG_BALANCE_ENABLED = true;
```

Keep normal and debug values in one shared balance file. Debug mode should make egg and seed project durations very short for development.

---

## V1 Design Contract

Use these decisions as implementation constraints for all Codex goals.

### Surface Priority

- V1 is focus-first.
- The Focus tab first scan order is:
  1. Current timer and focus status
  2. Active project progress and next action
  3. Seed count and available rewards
  4. Homestead entry point
- The Homestead tab is the reward space, not the primary control surface.
- Do not let decorative game UI hide Start, Pause, Reset, Claim, or Change Project.

### Layout

- Use a single-column layout for the Focus tab.
- Use a canvas-first layout for the Homestead tab.
- Homestead uses a bottom drawer for unplaced ducks and selected duck details.
- Avoid dashboard-style card mosaics in the side panel.
- Support Chrome side panel widths from 320 px to at least 720 px and heights from 600 px up.
- Chrome controls actual side panel resizing; the extension should respond to user-resized panel dimensions, not try to set panel width through the Side Panel API.
- Use container-based responsive layout and resize observers so Focus and Homestead resize immediately when the user drags the Chrome side panel edge.
- Mobile web support remains out of scope, but the side panel must not break at narrow Chrome side panel sizes.

### Visual Direction

- Use a full cozy pixel-game UI direction.
- Keep the utility hierarchy clear: game frame and sprites support the focus workflow, not the reverse.
- Use warm, short UI copy. Avoid long lore text in controls or empty states.
- Use real design tokens in CSS for colors, spacing, borders, shadows, and typography.
- Do not leave the final UI on default `sans-serif`, `system-ui`, or browser-default controls.
- Use bundled local fonts:
  - Pixelify Sans for titles, tab labels, counters, and short game labels.
  - Nunito for body copy, buttons, form labels, and longer readable text.
- Do not load remote fonts.
- Use this warm pond palette as the starting token set:
  - Ink: `#2f2418`
  - Muted text: `#6f6046`
  - Panel cream: `#fff8df`
  - Surface straw: `#f4e5b8`
  - Moss green: `#5f7f3f`
  - Deep moss: `#3e5d2e`
  - Pond blue: `#4f9db0`
  - Deep pond: `#2e6f7e`
  - Duck gold: `#f2c14e`
  - Soil brown: `#9b6f35`
  - Error red: `#b94e48`
  - Focus ring: `#2e6f7e`

### Asset Workflow

- Before implementation-heavy UI goals, create a prebuilt generated PNG asset pack.
- Assets may be generated with ChatGPT image generation as a build/design step.
- Commit final PNG assets into the repo under stable paths.
- The extension must never call image generation APIs at runtime.
- Keep V1 offline/private after install. Do not add network permissions for assets.
- Codex should still implement placeholder/fallback rendering so missing sprites do not crash the extension.

Recommended asset set:

```text
src/assets/pixel/ducks/
  duckling-meadow-a.png
  duckling-meadow-b.png
  duckling-pond-a.png
  duckling-pond-b.png
  duckling-fancy-a.png
  duckling-fancy-b.png
  young-duck-meadow-a.png
  young-duck-meadow-b.png
  young-duck-pond-a.png
  young-duck-pond-b.png
  young-duck-fancy-a.png
  young-duck-fancy-b.png
  adult-duck-meadow-a.png
  adult-duck-meadow-b.png
  adult-duck-pond-a.png
  adult-duck-pond-b.png
  adult-duck-fancy-a.png
  adult-duck-fancy-b.png

src/assets/pixel/tiles/
  grass.png
  water.png
  path.png
  flower.png

src/assets/pixel/objects/
  tree.png
  rock.png
  reeds.png

src/assets/pixel/ui/
  panel-frame.png
  egg-meadow.png
  egg-pond.png
  egg-fancy.png
  seed.png
```

Sprite scale:

- Base tile size is 32 x 32 px.
- Duck sprites are 32 x 32 px in V1.
- V1 has 6 duck variants: 2 meadow, 2 pond, and 2 fancy.
- Each duck variant needs 3 growth-stage sprites.
- Tile sprites are 32 x 32 px.
- Small object sprites are 32 x 32 px.
- Large object sprites use exact 32 px multiples, such as 64 x 64 px trees.
- Collision still uses tile cells, not transparent pixels in the PNG.
- Art perspective is top-down 3/4, inspired by cozy farming games.
- Do not copy any specific commercial game's assets, characters, or exact visual identity.

### Homestead Map

- V1 map is a fixed authored meadow pond map.
- The map is larger than the visible side panel viewport.
- Users explore by dragging empty background to pan the camera.
- If the user widens or heightens the Chrome side panel, the Canvas viewport expands to reveal more of the same homestead world.
- Resizing the side panel must not scale the world tiles or duck sprites; it only changes how much of the world is visible.
- Camera clamping must recalculate after every viewport resize.
- The side panel keeps a 12 px visual gutter/frame between the panel edge and the canvas viewport.
- The world map keeps a 2-tile scenic edge buffer so content does not feel pressed against map boundaries.
- Include grass, one pond, a small path, trees, rocks, flowers/reeds, and open placement zones.
- Use the tile grid for collision and placement.
- Water, trees, rocks, and outside-map tiles are invalid placement targets.
- Pond duck variants may enter water through AI, but users cannot manually place ducks on water.

### Interaction Rules

- Duck placement supports both drag-and-drop and click-to-place.
- Click-to-place flow: select unplaced duck, highlight valid tiles, click tile to place.
- Invalid placement shows brief inline feedback and keeps the duck selected/unplaced.
- Project progress is stored per project, not only on the active project.
- Only one project is selected as active at a time.
- Changing active project preserves each project's earned progress.
- If a project becomes ready while the timer is running, show the ready state but enable Claim only after the timer is paused, stopped, or completed.
- Feeding supports `Feed 1 seed` and `Feed to next stage` when enough seeds exist.

### Required Interaction States

| Feature | Empty | Ready/Success | Disabled | Error/Invalid |
|---------|-------|---------------|----------|---------------|
| Active project | Prompt user to pick an egg or seed project | Show progress, requirement, and next action | Start disabled until selected | Storage/read error shows retry text |
| Project progress | Show 0 / required time | Show ready-to-claim state | Claim disabled while timer runs | Progress cannot exceed requirement |
| Claim | Hidden until project is ready | Claim creates seeds or duck | Disabled during running timer | At duck cap, egg claim is blocked with explanation |
| Seed inventory | Show 0 seeds with hint to grow seed project | Updated count after seed claim/feed | Feed disabled without enough seeds | Never allow negative seed count |
| Unplaced duck tray | Show warm empty state after all ducks placed | New duck appears as thumbnail | Disabled only during impossible drag state | Invalid drop returns duck to tray |
| Duck menu | No selection state in drawer | Show name, stage, activity, feed actions | Feed disabled for adult ducks or insufficient seeds | Rename validation keeps previous name |
| Homestead canvas | Show map even with no ducks | Placed ducks render and animate | Placement blocked on invalid tiles | Missing sprites use visible placeholders |

### Accessibility and Input

- All buttons need visible focus states.
- Tab controls must be keyboard reachable.
- Click-to-place must be usable without drag-and-drop.
- Use visible labels, not placeholder-only labels.
- Use 44 px minimum hit targets for main side-panel actions.
- Body text must be at least 16 px or intentionally replaced by legible pixel UI labels.
- Maintain 4.5:1 contrast for readable text.

## V1 Balance

### Normal Balance

| Project | Type | Time Required | Reward |
|---|---|---:|---|
| Meadow Egg | Egg | 25 min | `meadow-a` or `meadow-b` |
| Pond Egg | Egg | 50 min | `pond-a`, `pond-b`, or rare `fancy-a` |
| Fancy Egg | Egg | 90 min | `fancy-a`, `fancy-b`, or rare `pond-b` |
| Small Seed Patch | Seeds | 10 min | 5 seeds |
| Garden Bed | Seeds | 25 min | 15 seeds |
| Big Harvest | Seeds | 50 min | 35 seeds |

### Debug Balance

| Project | Debug Time Required | Reward |
|---|---:|---:|
| Meadow Egg | 10 sec | Meadow hatch table |
| Pond Egg | 15 sec | Pond duck variant table |
| Fancy Egg | 30 sec | Fancy duck variant table |
| Small Seed Patch | 5 sec | 5 seeds |
| Garden Bed | 10 sec | 15 seeds |
| Big Harvest | 15 sec | 35 seeds |

### Duck Growth Balance

| Growth Transition | Seeds Required |
|---|---:|
| Duckling to Young Duck | 5 |
| Young Duck to Adult Duck | 10 |

---

## Recommended Data Model

Create or refactor shared types into something close to this. Adjust names to match repo style, but keep the concepts.

```ts
export type ProjectType = "egg" | "seeds";

export type ProjectId =
  | "meadowEgg"
  | "pondEgg"
  | "fancyEgg"
  | "smallSeedPatch"
  | "gardenBed"
  | "bigHarvest";

export type DuckGrowthStage = "duckling" | "youngDuck" | "adultDuck";

export type DuckPlacementStatus = "unplaced" | "placed";

export type DuckActivity = "idle" | "wander" | "swim" | "rest" | "eat";

export interface ProjectProgressState {
  projectId: ProjectId;
  progressSeconds: number;
  isReadyToClaim: boolean;
  progressStartedAtTimestampMilliseconds: number | null;
}

export interface DuckPosition {
  x: number;
  y: number;
}

export interface Duck {
  id: string;
  name: string;
  variantId: string;
  sourceEggProjectId: ProjectId;
  growthStage: DuckGrowthStage;
  seedsFedForCurrentStage: number;
  placementStatus: DuckPlacementStatus;
  position: DuckPosition | null;
  activity: DuckActivity;
  favoriteActivity: string;
  hatchedAtTimestampMilliseconds: number;
  lastUpdatedAtTimestampMilliseconds: number;
}

export interface HomesteadCameraState {
  x: number;
  y: number;
}

export interface GameState {
  activeProjectId: ProjectId | null;
  projectProgressById: Partial<Record<ProjectId, ProjectProgressState>>;
  ducks: Duck[];
  seedCount: number;
  totalCompletedSessions: number;
  totalCompletedFocusSeconds: number;
  homesteadCamera: HomesteadCameraState;
}
```

Migration note:

- Existing `DuckRewardsState` should be migrated into or replaced by `GameState`.
- Existing ducks only have `id`, `sourceDuckRewardItemId`, and `hatchedAtTimestampMilliseconds`. Add defaults for missing fields when reading old saved data.
- Project progress should be stored per project so changing active project does not erase earned focus time.
- Project requirements should come from project definitions/balance config, not duplicated as mutable saved state.

---

## Suggested File Organization

Use this as a guide. The exact structure can be adjusted if Codex finds a cleaner fit.

```text
src/shared/
  types.ts
  messages.ts
  balance.ts
  projectDefinitions.ts
  duckDefinitions.ts
  gameState.ts
  gameLogic.ts
  homesteadMap.ts

src/background/
  background.ts

src/popup/
  popup.html
  popup.css
  popup.ts
  focusView.ts
  homesteadView.ts
  canvasRenderer.ts
  assetLoader.ts
  inputController.ts
```

Keep pure game calculations out of DOM files where practical.

---

## Message/API Plan

Refactor messages so the UI can interact with the background service worker cleanly.

Recommended message types:

```ts
GET_TIMER_STATE
START_TIMER
PAUSE_TIMER
RESET_TIMER

GET_GAME_STATE
SELECT_PROJECT
CHANGE_PROJECT
CLAIM_ACTIVE_PROJECT
RENAME_DUCK
FEED_DUCK
PLACE_DUCK
MOVE_DUCK
UPDATE_DUCK_SIMULATION_STATE
SAVE_HOMESTEAD_CAMERA
```

Important rules:

- Background owns canonical timer and game state.
- UI polls or requests state updates.
- UI may run Canvas animation locally while open.
- Any permanent game change must be written to `chrome.storage.local` through background or a clear shared persistence layer.
- Keep state validation/type guards for safety.

---

# Codex Goals

## Goal 0 — Lock Design Contract and Asset Pack

### Objective

Prepare the UI design system and generated PNG asset pack before implementation-heavy goals.

### Tasks

- Add or confirm design tokens for colors, spacing, borders, typography, focus states, and pixel UI treatment.
- Generate the V1 PNG asset pack with ChatGPT image generation as a design/build step.
- Save final assets under `src/assets/pixel/...` using the paths in the V1 Design Contract.
- Confirm fallback rendering still exists for missing sprites.
- Confirm Focus tab, Homestead tab, bottom drawer, and interaction states follow the V1 Design Contract.

### Done When

- Asset filenames and sprite sizes are stable.
- Focus-first hierarchy is explicit before UI implementation starts.
- No runtime image generation or network asset dependency is introduced.
- Codex goals can reference the design contract instead of inventing visual behavior.

---

## Goal 1 — Refactor Persistent Game State

### Objective

Create a persistent `GameState` system in `chrome.storage.local` without breaking the existing timer flow.

### Tasks

- Add `GameState` and related types.
- Add `createDefaultGameState()`.
- Add safe reader/writer functions for local storage.
- Add migration/defaulting for old `DuckRewardsState` shape.
- Add `activeProjectId` and `projectProgressById`.
- Preserve current timer functions where possible.
- Ensure game state persists after side panel closes and Chrome restarts.

### Done When

- `npm run typecheck` passes.
- Existing timer still starts, pauses, resets, and displays correctly.
- `GameState` can be read/written from local storage.
- Old saved ducks do not crash the extension.

---

## Goal 2 — Replace Hardcoded Duck Rewards with Active Project System

### Objective

Replace the current two hardcoded duck egg reward flow with a flexible project system for eggs and seeds.

### Tasks

- Add project definitions for all egg and seed projects.
- Add normal/debug balance selection.
- Add one active project at a time.
- Require project selection before timer start.
- Lock project selection while timer is running.
- Track progress continuously while timer runs.
- Save progress on pause/reset/timer completion/window close.
- Prevent spillover when project completes before timer ends.
- Allow project change only while timer is not running.
- Preserve progress for each project when active project changes.

### Done When

- User can select an egg or seed project.
- User can focus any chosen duration.
- Project progress increases only while timer runs.
- Switching active project does not erase earned progress on any project.
- Progress persists after side panel close.
- Resetting timer does not erase earned progress.
- Project can be claimed only when timer is not running and project is ready.

---

## Goal 3 — Add Claim Logic for Eggs and Seeds

### Objective

Implement claiming completed active projects.

### Tasks

- Add seed inventory count.
- Claiming seed projects adds seeds to `seedCount`.
- Claiming egg projects rolls hatch table and creates a new duck.
- New ducks start as `placementStatus: "unplaced"`.
- New ducks start as `growthStage: "duckling"`.
- Enforce 20-duck cap.
- Disable egg projects at cap.
- Prevent egg claim at cap with a clear side-panel explanation.
- Keep seed projects available at cap.

### Done When

- Completed seed project adds correct seeds.
- Completed egg project creates a permanent duck.
- Duck variant is rolled on claim.
- Duck appears in unplaced inventory.
- Egg projects are disabled at 20 ducks.
- Claim controls follow the V1 Design Contract state table.

---

## Goal 4 — Build Focus Tab UI

### Objective

Replace the current single-panel reward UI with a clearer Focus tab.

### Tasks

- Add `Focus` and `Homestead` tabs.
- Use top segmented tabs with clear selected and keyboard-focus states.
- Focus tab shows seed count.
- Focus tab shows active project card.
- Focus tab shows egg project choices.
- Focus tab shows seed project choices.
- Focus tab shows timer duration controls.
- Focus tab shows Start/Pause/Reset.
- Focus tab shows Claim button only when appropriate.
- Focus tab shows Change Project button when timer is not running.
- Focus tab progress/focus bar expands to the available panel width.
- Progress/focus bar preserves readable labels and does not become fixed-width at larger side panel sizes.
- Disable Start until active project exists.
- Use warm, short empty states for no active project, no seeds, ready claim, and full duck capacity.

### Done When

- User can navigate between Focus and Homestead tabs.
- Focus tab supports full project selection and timer flow.
- UI clearly shows progress and ready-to-claim state.
- Timer cannot start without an active project.
- Focus tab works at 320 px side-panel width without clipped controls.
- Focus bar and project progress area expand cleanly when the side panel is widened.

---

## Goal 5 — Add Duck Naming, Feeding, and Growth Logic

### Objective

Implement duck growth and duck menu logic.

### Tasks

- Add feed logic that spends 1 seed per click.
- Add `Feed to next stage` when enough seeds exist.
- Add growth transition rules.
- Duckling to young duck requires 5 seeds.
- Young duck to adult duck requires 10 seeds.
- Adult ducks cannot be fed for growth in V1.
- Add rename logic.
- Add duck stats display data helpers.
- Ensure seed count is visible.

### Done When

- Clicking a duck can open a menu.
- Menu shows name, variant, stage, seeds fed, age, activity, and favorite activity.
- User can rename duck.
- User can feed duck if enough seeds exist.
- User can feed one seed or batch-feed to the next growth stage.
- Duck grows after required seeds.
- Feed/growth state persists.

---

## Goal 6 — Add Homestead Tab and Pannable Canvas Map

### Objective

Create the fixed 48 x 36 tile homestead map with a pannable Canvas viewport.

### Tasks

- Add Canvas to Homestead tab.
- Add `homesteadMap.ts` map definition.
- Use 32 px tiles.
- World size: 1536 x 1152 px.
- Keep the visible Canvas viewport smaller than the world.
- Let the visible Canvas viewport grow when the Chrome side panel is resized larger.
- Do not stretch sprites or tiles when the panel grows.
- Recompute Canvas size, camera clamp bounds, and drawer height on viewport resize.
- Add a 12 px inner frame/gutter between side panel chrome and Canvas viewport.
- Add a 2-tile scenic edge buffer inside the authored world map.
- Add camera state.
- Dragging empty map pans camera.
- Clamp camera to world bounds.
- Draw an authored meadow pond map with grass, one pond, path, trees, rocks, flowers/reeds, and open placement zones.
- Add bottom drawer shell for unplaced duck tray and selected duck details.
- Persist camera state optionally.

### Done When

- Homestead tab renders Canvas.
- User can pan around the fixed map.
- Dragging empty background reveals homestead areas outside the initial viewport.
- Increasing side panel size reveals more homestead area at once.
- Camera cannot move beyond map edges.
- Visible viewport has padding/frame instead of touching side panel edges.
- Bottom drawer does not hide the primary map interaction.
- Map can render without final PNG assets.

---

## Goal 7 — Add Duck Placement, Dragging, and Duck Menu

### Objective

Let users place unplaced ducks and interact with placed ducks.

### Tasks

- Add thumbnail-only unplaced duck tray.
- Draw placed ducks on Canvas.
- Drag thumbnail onto valid map tile to place duck.
- Select thumbnail and click a valid tile to place duck.
- Drag placed duck to move it.
- Clicking placed duck opens duck menu.
- Validate placement against collision map.
- Prevent placing ducks on water, trees, rocks, or outside map.
- Save positions in `GameState`.

### Done When

- Newly hatched duck appears as thumbnail only.
- User can drag it onto the map.
- User can place it without drag-and-drop.
- Placed duck disappears from unplaced tray.
- User can drag placed duck to a new valid spot.
- Invalid drops are rejected gracefully.
- Duck menu opens on click.

---

## Goal 8 — Add Simple Duck Idle AI and Pond Interactions

### Objective

Make placed ducks feel alive with simple movement and activities.

### Tasks

- Add lightweight per-duck activity state.
- Activities: idle, wander, swim, rest, eat.
- Ducks choose nearby valid target locations.
- Pond ducks prefer water/swim behavior more often.
- Ducks avoid invalid collision tiles except allowed swim zones.
- Eating state triggers briefly after feed.
- Save position/activity periodically or on view close.

### Done When

- Placed ducks move around slowly while Homestead view is open.
- Ducks can idle/rest/wander.
- Ducks can interact with ponds using simple rules.
- Feeding briefly shows eat activity.
- No heavy pathfinding required.

---

## Goal 9 — Add Pixel Asset Loading with Fallbacks

### Objective

Support static PNG assets while keeping the app functional without them.

### Tasks

- Add asset loader for tile/object/duck/ui sprites.
- Use `src/assets/pixel/...` convention.
- Load the prebuilt generated PNG asset pack from Goal 0 when present.
- If sprite fails to load, draw placeholder pixel shapes.
- Keep all sprite sizes consistent.
- Do not rely on remote URLs.
- Do not call image generation APIs from extension runtime.

### Done When

- Canvas renderer can draw from PNG assets when present.
- Missing assets do not crash the app.
- Fallback placeholders are visibly distinct.
- Generated assets and fallback placeholders use the same logical sprite sizes.

---

## Goal 10 — Add Debug Balance and Testing Checklist

### Objective

Make development fast and reduce regressions.

### Tasks

- Add `IS_DEBUG_BALANCE_ENABLED` constant.
- Normal and debug balances live in one shared file.
- Keep debug mode not user-facing.
- Add or isolate pure helper functions for testing.
- Run typecheck/build.
- Document manual test checklist.

### Done When

- Debug durations are short when constant is enabled.
- Normal balance can be restored by toggling one constant.
- `npm run typecheck` passes.
- `npm run build` passes.

---

## Manual Testing Checklist

### Timer and Project Progress

- Select an egg project and start a timer.
- Project progress increases while timer runs.
- Pause timer and verify progress is saved.
- Reset timer and verify project progress remains.
- Close side panel and reopen; verify progress remains.
- Close all Chrome windows; verify earned progress remains but no offline progress is granted.
- Complete project before timer ends; verify claim waits until timer is not running.

### Seed Flow

- Select Small Seed Patch.
- Complete it in debug mode.
- Claim seeds.
- Verify seed count increases.
- Verify seed count persists after reopening.

### Egg Flow

- Select Meadow Egg.
- Complete it in debug mode.
- Claim egg.
- Verify random duck is created.
- Verify duck appears in unplaced thumbnail tray.
- Verify duck persists after reopening.

### Homestead

- Open Homestead tab.
- Pan map by dragging empty background.
- Verify camera clamps to map bounds.
- Drag unplaced duck thumbnail onto valid tile.
- Verify duck appears on map and leaves tray.
- Try dropping duck on invalid tile; verify placement is rejected.
- Drag placed duck to another valid tile.
- Click duck; verify menu opens.

### Duck Menu and Growth

- Rename duck.
- Feed duck with seeds.
- Verify seed count decreases.
- Feed enough seeds to grow from duckling to young duck.
- Feed enough seeds to grow from young duck to adult duck.
- Verify growth persists.

### Capacity

- Create enough ducks to reach 20 in debug mode or test helper.
- Verify egg projects are disabled.
- Verify seed projects are still available.

---

## Lightweight Automated Testing Targets

Where possible, keep these functions pure and easy to test:

- Balance selection: normal vs debug
- Project progress calculation
- Ready-to-claim calculation
- Seed claiming
- Duck cap enforcement
- Hatch table selection
- Duck feeding
- Growth stage update
- Placement validation
- Camera clamping

At minimum, every milestone should pass:

```bash
npm run typecheck
npm run build
```

For UI milestones, also capture or manually inspect the side panel at:

- 320 px width
- 420 px width
- 520 px width
- 720 px width or the widest manually available Chrome side panel width

Required visual QA states:

- Focus tab with no active project
- Focus tab with running timer
- Focus tab with ready-to-claim project while timer is stopped
- Focus tab at 20-duck capacity
- Homestead tab with no ducks placed
- Homestead tab with unplaced duck tray open
- Homestead tab with selected duck menu open
- Homestead tab after invalid placement attempt
- Homestead tab after panning to each world edge/corner
- Homestead tab showing 12 px viewport frame/gutter around the Canvas
- Homestead tab before and after widening the side panel, verifying more world becomes visible
- Focus tab before and after widening the side panel, verifying focus/progress bar expands dynamically

---

## Explicitly Out of Scope for V1

Do not implement these in V1:

- Website blocking
- Chrome notifications
- Sound effects
- New Tab homestead mode
- Crop planting/watering
- Editable terrain
- Duck sickness/death/hunger penalties
- Breeding
- Marketplace/shop
- Cloud sync
- Multiplayer/social features
- Complex pathfinding
- Mobile support
- Runtime external image generation integration

---

## Implementation Guidance for Codex

- Preserve existing working code wherever possible.
- Refactor in small steps.
- Keep Chrome extension message boundaries clear.
- Keep game logic separate from DOM/Canvas code when practical.
- Prefer explicit beginner-friendly TypeScript.
- Avoid clever abstractions.
- Avoid abbreviations except common ones like `id`, `x`, `y`, `ui`, and `api`.
- Add docstrings/comments for important functions, but do not comment every line.
- Run typecheck after each major milestone.
- If an asset is missing, use a fallback rather than blocking implementation.

---

## Final V1 Loop

The finished V1 should support this loop:

1. User opens side panel.
2. User chooses Focus tab.
3. User selects an egg or seed project.
4. User chooses any focus duration.
5. User starts timer.
6. Active project earns progress while timer runs.
7. User pauses, resets, or completes timer without losing earned progress.
8. When project is ready and timer is not running, user claims reward.
9. Seed projects add seeds.
10. Egg projects hatch a random duck variant into unplaced inventory.
11. User opens Homestead tab.
12. User pans around the map.
13. User drags unplaced duck thumbnail onto map.
14. Duck wanders, rests, swims, or eats.
15. User clicks duck to rename, inspect stats, or feed seeds.
16. Duck grows from duckling to young duck to adult duck.
