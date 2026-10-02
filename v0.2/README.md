# Orrery v0.2

A single-file organisation and process navigator. Open `orrery.html` in Edge or Chrome, load a JSON file, and explore or edit roles, processes, meetings and documents live in a meeting.

New in v0.2: **process flows**. One process can feed another: a product roadmap guides a design roadmap, and the design roadmap reports back. Roles still never connect to roles. Also new: **notes and links** on every role, process, meeting and document. No install or admin rights needed. It does need an internet connection to load d3 and the fonts.

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
| Focus on a node | Double-click a role or process in the graph. It moves to the centre with only its direct connections around it, including its meetings (long tables, with attendees' departments as figures along the top) and documents (pages with a folded corner). Double-click another node to move focus there. Leave with **Show full graph** in the bar at the top, **1**, *Graph* in the view menu, or Esc. |
| Move a node | Drag it. It stays pinned (pin badge on its top-left corner). Right-click it (or two-finger tap on a touchpad) and choose **Release position** to free it, or use **Reset view** in the panel under the toolbar to free every node. |
| Search | Move the pointer to the top edge, or press Ctrl+F or **/**. Enter selects the first match. Search also looks in notes and link labels. |
| Add a role or process | Edit mode → double-click or right-click empty canvas |
| Connect a role and a process | Edit mode → hover or select one and drag the brass handle on its right edge onto the other. No drag needed: click the handle (or press **C**, or choose *Connect to…* from the card's menu), then click the other card; Esc cancels. Right-drag from one onto the other also works. |
| Show that one process feeds another | Edit mode → connect from the process that gives to the one that receives, in any of the ways above. Or use *Add an input from…* / *Add an output to…* in the process's panel. |
| Reverse or delete a flow | Edit mode → right-click (or two-finger tap) the flow's line, or use the buttons on the flow in the panel |
| Hide process flows | **Process flows** at the bottom of the legend, or its eye button. Like collapsing a department, this only changes the graph, and isn't saved. |
| Delete | Edit mode → right-click (or two-finger tap) a node, press Delete, or use **Delete** in the panel. Undo brings it back. |
| Check for mistakes | **Warnings** in the panel under the toolbar, or **W**, lists every discrepancy. Click an item to go to it. Yellow triangles mark the same problems in the right panel and on table cards. **Marks on/off** next to it hides the triangles. |
| Fill a meeting from its processes | Edit mode → select the meeting → **Add process roles** beside *Roles*. If the meeting is in several processes, pick one or all from the drop-down. |
| Write a note on an item | Select it and type in **Notes** at the bottom of the right panel. Works with edit mode on or off. |
| Add a link to an item | Edit mode → select it → **+ Link** under **Links**. Paste the address (for example a SharePoint or OneDrive link) and give it a label. The pencil changes a link, the × removes it. |
| Hide panels | Round arrow buttons on each panel. Panels remember whether they were hidden. |

In edit mode the right panel edits everything else:
- names and descriptions
- RACI flags and notes
- Chair and Mandatory for meeting roles
- Own and Review for documents
- meeting cadence
- departments: pick one, or type a new name to create it
- flows: what passes along each one, and which documents it carries

Each list has a search box to add existing items or create new ones. Departments can be renamed, recoloured or deleted in the legend.

A process shows the first sentence of its description under its name, in the graph (up to three lines) and the process table header (up to two), so a process isn't confused with a document of the same name. Hover to see the whole sentence when it's cut short. The same sentence appears under each process in the *Add to a process…* search box, and as a tooltip on process links in the right panel. The sentence ends at the first `.`, `!` or `?` that starts a new sentence, so `e.g.` and `Dr.` don't cut it short.

## Notes and links

Every role, process, meeting and document has **Notes** and **Links** at the bottom of the right panel.

- **Notes** are free text. You can write them whether or not edit mode is on, so you can jot things down in a meeting. A note is saved when you click away. Undo works as usual, and the file shows as unsaved.
- **Links** open in a new tab. Only edit mode can add, change or remove them. A link without a label shows the file name from its address (`Org%20support.pptx` shows as *Org support.pptx*), or the site's name if the address doesn't name a file. SharePoint sharing links (`…/:p:/s/…`) don't name their file, so give those a label.
- If you type an address without `https://`, such as `contoso.sharepoint.com/…`, Orrery adds it. Only `http`, `https` and `mailto` addresses can be opened.
- Cards in the graph and tables don't show notes or links.

## Process flows

A flow says that one process feeds another, and what passes between them.

- **In the graph:** a flow is a line between two processes with its arrowhead halfway along. Two processes that feed each other get two thin parallel lines, each with a half-arrow; each line sits on the right-hand side of its direction. Hover a line to read what the flow carries. Flows don't move anything in the layout.
- **In focus mode:** a process's roles sit on the inner ring and the processes it's linked to by flows on an outer ring: *fed by* on the left, *feeds* on the right, both ways above and below.
- **In the panel:** a process has *Fed by* and *Feeds into* sections. Each flow has a description and can list documents it **carries**. When picking a document, the source process's own documents come first, and a new document created there also joins the source process.
- **In the process table:** *fed by* rows sit under each column's header and *feeds into* rows close the column (dashed borders).

In the graph, click a department in the legend (or its eye button) to collapse its roles into small coloured dots; click again to expand them. This is a view setting only: it doesn't affect the table views and isn't saved to the file.

## Warnings

| Warning | When |
|---|---|
| Meeting role outside the meeting's processes | A role attends a meeting but isn't in any process the meeting is part of |
| Document owner outside the document's processes | A role owns a document but isn't in any process the document is part of (reviewers aren't checked) |
| Meeting not part of any process | |
| Document not part of any process | |
| Role not part of any process | |
| Process with no roles | |
| Flow between processes with no role in common | Two processes are linked by a flow (either way) but share no role, so no one carries the handover. A two-way pair gets one warning. |
| Flow carrying a document its source process doesn't have | A flow carries a document that isn't one of the giving process's documents |

In the meeting table, chairs are listed first.

## File format

```json
{
  "orrery": "0.2",
  "title": "Product organisation",
  "departments": [{ "id": "dep-1", "name": "Design", "colour": "#2F5D8A" }],
  "roles":       [{ "id": "rol-1", "name": "System Engineer", "description": "", "department": "dep-1",
                    "notes": "More information can be found in the Org support file",
                    "links": [{ "label": "Org support file", "url": "https://contoso.sharepoint.com/…/Org%20support.pptx" }] }],
  "processes":   [{ "id": "pro-1", "name": "Early product design", "description": "",
                    "roles": [{ "role": "rol-1", "raci": ["R"], "note": "" }],
                    "meetings": ["mtg-1"], "documents": ["doc-1"] }],
  "meetings":    [{ "id": "mtg-1", "name": "", "description": "", "cadence": "quarterly",
                    "roles": [{ "role": "rol-1", "chair": true, "mandatory": false }] }],
  "documents":   [{ "id": "doc-1", "name": "", "description": "", "owners": ["rol-1"], "reviewers": [] }],
  "flows":       [{ "id": "flo-1", "from": "pro-1", "to": "pro-2", "description": "", "documents": ["doc-1"] }],
  "layout":      { "rol-1": { "x": 120, "y": -40 } }
}
```

- **Nothing is required.** Missing fields get defaults. Links to items that don't exist are dropped, and a message says how many. Fields Orrery doesn't know about are kept, so they survive a save.
- **Shared items:** meetings and documents are top-level items, so several processes can share one.
- **`cadence`:** one of `yearly`, `bi-yearly`, `quarterly`, `monthly`, `fortnightly`, `weekly`, `bi-weekly`, `daily`, or `null` for not specified.
- **Owner or reviewer:** a role owns a document or reviews it, not both. If a file lists a role as both, it's kept as the owner.
- **`layout`:** holds only the nodes you've pinned by dragging.
- **`notes` and `links`:** roles, processes, meetings and documents can all have them. A link can be written as just its address (`"https://…"`). A link with no address is dropped when the file opens, and counted in the message. A link to anything other than a web or email address (such as `C:\Shared\Org support.pptx`) is kept, but shows as text you can't click.
- **`flows`:** each runs `from` one process `to` another. A two-way link is two flows. A flow from a process to itself, a second flow in the same direction, or a flow to a process that doesn't exist is dropped when the file opens, and counted in the message.
- **v0.1 files** open as they are, with no flows, notes or links. **v0.1 keeps flows, notes and links** it doesn't understand when it saves a v0.2 file. But deleting a process in v0.1 can leave a flow pointing at it, and v0.2 drops that flow when it opens the file.

## Tests

```bash
cd v0.2/tests && npm install && npx playwright test
```

The tests run on the installed Edge (`channel: 'msedge'`) and serve d3 from `node_modules`.
- **Screenshots:** `node screenshots.js` writes the key screens, light and dark, to `tests/screenshots/`.
- **Large fixture:** `node fixtures/make-large.js` regenerates the 150-role fixture.

## Known limits (v0.2)

- **Online only:** needs a connection for d3 and the fonts. Without the fonts, text falls back to system fonts.
- **Save in place:** only works in Edge and Chrome, because it relies on the File System Access API. Other browsers download a copy.
- **Graph-only features:** connecting cards and pinning only work in the graph view, outside focus mode. The tables are for reading and selecting.
- **Flows:** their descriptions aren't searchable, and a flow can't be selected on its own: edit it from either process's panel.
- **Links:** only web (`http`/`https`) and email (`mailto`) links open. Paths to local or network files show as text, because browsers don't open them from a web page.
- **Undo history:** isn't saved with the file, and moving nodes can't be undone (use Reset view instead).
- **Screen size:** built for desktop and projector screens, not phones.
