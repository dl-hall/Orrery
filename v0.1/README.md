# Orrery v0.1

A single-file organisation and process navigator. Open `orrery.html` in Edge or Chrome, load a JSON file, and explore or edit roles, processes, meetings and documents live in a meeting. No install or admin rights needed. It does need an internet connection to load d3 and the fonts.

- `orrery.html`: the whole app.
- `examples/product-org.json`: the example organisation (also built in, under **Load example**).
- `tests/`: Playwright tests and a screenshot script.

Tip: `orrery.html?example` opens straight into the example.

## Using it

| To… | Do this |
|---|---|
| Open or save | Folder and disk icons (Ctrl+O / Ctrl+S). In Edge and Chrome, Save writes back to the file you opened; elsewhere it downloads a copy. You can also drop a `.json` file onto the window. |
| Switch view | Eye icon, or keys **1** Graph · **2** Process table · **3** Role table · **4** Meeting table |
| Go back or forward | Double arrows (Alt+← / Alt+→). Covers both view and selection changes. |
| Undo or redo | Round arrows (Ctrl+Z / Ctrl+Y) |
| Edit | Pencil or **E**. A brass *Edit mode* tab shows at the top while it's on. |
| Pan and zoom | Drag empty space; mouse wheel. Zoom buttons appear near the bottom middle. **F** fits everything to the screen. |
| Move a node | Drag it. It stays pinned (brass dot) until **Reset view** in the panel under the toolbar. |
| Search | Move the pointer to the top edge, or press Ctrl+F or **/**. Enter selects the first match. |
| Add a role or process | Edit mode → right-click empty canvas |
| Connect a role and a process | Edit mode → right-drag from one onto the other |
| Delete | Edit mode → right-click a node, press Delete, or use **Delete** in the panel. Undo brings it back. |
| Hide panels | Round arrow buttons on each panel. Panels remember whether they were hidden. |

In edit mode the right panel edits everything else:
- names and descriptions
- RACI flags and notes
- Chair and Mandatory for meeting roles
- Own and Review for documents
- meeting cadence
- departments: pick one, or type a new name to create it

Each list has a search box to add existing items or create new ones. Departments can be renamed, recoloured or deleted in the legend.

## File format

```json
{
  "orrery": "0.1",
  "title": "Product organisation",
  "departments": [{ "id": "dep-1", "name": "Design", "colour": "#2F5D8A" }],
  "roles":       [{ "id": "rol-1", "name": "System Engineer", "description": "", "department": "dep-1" }],
  "processes":   [{ "id": "pro-1", "name": "Early product design", "description": "",
                    "roles": [{ "role": "rol-1", "raci": ["R"], "note": "" }],
                    "meetings": ["mtg-1"], "documents": ["doc-1"] }],
  "meetings":    [{ "id": "mtg-1", "name": "", "description": "", "cadence": "quarterly",
                    "roles": [{ "role": "rol-1", "chair": true, "mandatory": false }] }],
  "documents":   [{ "id": "doc-1", "name": "", "description": "", "owners": ["rol-1"], "reviewers": [] }],
  "layout":      { "rol-1": { "x": 120, "y": -40 } }
}
```

- **Nothing is required.** Missing fields get defaults. Links to items that don't exist are dropped, and a message says how many. Fields Orrery doesn't know about are kept, so they survive a save.
- **Shared items:** meetings and documents are top-level items, so several processes can share one.
- **`cadence`:** one of `yearly`, `bi-yearly`, `quarterly`, `monthly`, `fortnightly`, `weekly`, `bi-weekly`, `daily`, or `null` for not specified.
- **Owner or reviewer:** a role owns a document or reviews it, not both. If a file lists a role as both, it's kept as the owner.
- **`layout`:** holds only the nodes you've pinned by dragging.

## Tests

```bash
cd v0.1/tests && npm install && npx playwright test
```

The tests run on the installed Edge (`channel: 'msedge'`) and serve d3 from `node_modules`.
- **Screenshots:** `node screenshots.js` writes the key screens, light and dark, to `tests/screenshots/`.
- **Large fixture:** `node fixtures/make-large.js` regenerates the 150-role fixture.

## Known limits (v0.1)

- **Online only:** needs a connection for d3 and the fonts. Without the fonts, text falls back to system fonts.
- **Save in place:** only works in Edge and Chrome, because it relies on the File System Access API. Other browsers download a copy.
- **Graph-only features:** connecting by right-drag and pinning only work in the graph view. The tables are for reading and selecting.
- **Undo history:** isn't saved with the file, and moving nodes can't be undone (use Reset view instead).
- **Screen size:** built for desktop and projector screens, not phones.
