# Duckcipline Homestead V1 Design Contract

## Surface

- Side panel only.
- Two tabs: Focus and Homestead.
- Focus tab is first: timer, active project progress, seeds, project choices.
- Homestead tab is canvas-first with a bottom drawer for unplaced ducks and duck details.

## Tokens

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

## Assets

Runtime assets are local only. The extension must not call remote image generation or network asset APIs.

Expected optional PNG paths:

```text
src/assets/pixel/ducks/
src/assets/pixel/tiles/
src/assets/pixel/objects/
src/assets/pixel/ui/
```

Canvas rendering must fall back to drawn pixel placeholders when PNG files are absent.
