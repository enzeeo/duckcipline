# Popup Workflow Diagram

Files:
- `workflow/popup-page-workflow.dot`: editable Graphviz source
- `workflow/popup-page-workflow.svg`: rendered workflow diagram

Regenerate SVG:

```bash
dot -Tsvg workflow/popup-page-workflow.dot -o workflow/popup-page-workflow.svg
```

# Pixel Sprite Sheet Workflow

Generate small ChatGPT image batches:

```bash
npm run assets:prompts -- --batch style-lock
npm run assets:prompts -- --batch ducks --variant brown-green --stage adultDuck
npm run assets:prompts -- --batch environment
npm run assets:prompts -- --batch eggs
```

Create a selected-sheet manifest:

```bash
python3 scripts/extract_selected_sprite_sheets.py --init-manifest
```

Put the chosen option paths in `workflow/sprite_sheet_manifest.json`, then crop into runtime assets:

```bash
npm run assets:extract
npm run assets:verify
```

Renderer contracts:
- Duck, egg, tile, nest, rock, reeds, lily pad assets: `32x32`
- Tree asset: `64x64`
- Walking animation stays named `wander` in code and filenames.
