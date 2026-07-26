# Debug Surface Shell

Parent Plan: none (standalone spec)

## Goal

Turn the development routes from browser-default DOM documents into a coherent, readable debug workspace. Establish one debug-only page template that the Hub, every current tool, and future debug scenes can reuse without moving domain state or behavior into a visual layer.

## Summary

The debug namespace will gain a shared page shell and stylesheet with deliberate typography, spacing, color, panels, controls, tables, status treatments, responsive widths, and visible focus states. The Hub will present the registered tools as a responsive card grid, while each tool will receive consistent page chrome, a route back to the Hub, and either standard or wide content composition appropriate to its data.

All five current tools will migrate to the template in the same change: Combat Explorer, Action Viewer, Floor Set Viewer, Floor Set Workbench, and Route Replay. Their calculations, draft ownership, validation gates, keyboard commands, maps, tables, and registry-driven lazy loading remain unchanged. The authoring map continues to own authored-cell semantics; the shell only makes that content legible and reusable as a debug scene pattern.

The stylesheet stays inside the development-only deferred debug graph, so ordinary play and production output do not acquire debug chrome or a new runtime dependency. The implementation remains framework-free and uses semantic DOM plus project-owned CSS.

## Requirements

1. Provide one reusable debug page template for the Hub, all current tools, and future debug scenes so page structure and presentation no longer depend on browser defaults or copied inline styles.
2. Render the Debug Hub from the existing tool registry as a responsive, descriptive card grid so registration metadata remains the only navigation catalog.
3. Give every tool consistent identity, description, Hub navigation, content width, panel, control, table, and status styling while preserving its current behavior and state ownership.
4. Keep the complete visual system development-only and downstream of the existing deferred debug route so ordinary play and production builds remain unaffected.
5. Keep the interface usable by keyboard and at narrow widths through semantic landmarks, visible focus, non-color-only states, wrapping controls, and locally scrollable wide maps or tables.
6. Do not add React, a UI framework, a rendering library, or a generic production design system; this is a small project-owned DOM and CSS template for debug tooling.

## Relational Context

- The application bootstrap continues to decide ordinary versus debug routing and dynamically imports the debug router only in development. The debug router imports the shell stylesheet so all CSS remains in the same deferred debug graph; neither the bootstrap nor ordinary-play code imports debug presentation.
- The debug tool registry remains the single owner of tool IDs, paths, titles, descriptions, and lazy loaders. The Hub reads it to build cards, and the shell never introduces a second navigation list.
- The debug router retains exact-path resolution and the existing `render(mount)` boundary. Each Hub or tool renderer composes the shared shell inside that boundary rather than making routing aware of domain layout.
- The shell owns page chrome, landmarks, width variants, navigation, and reusable presentation classes. Each tool continues to own its controls, state, calculations, status text, tables, maps, and rerender lifecycle.
- The authored-floor projection and inspector remain owned by the authoring map. Shared styling may replace inline presentation and add stable classes, but it must not turn that map into a generic gameplay or presentation component.
- Shared CSS is scoped to the loaded debug surface and uses semantic class names rather than tool-specific global element overrides. Full-page background rules are safe only because the stylesheet is loaded exclusively by the debug router.
- Existing accessibility meaning remains semantic DOM text and ARIA state. Icons, borders, badges, and colors supplement those labels and never replace them.

## Scope

### Included

- Shared debug page shell, page header, Hub navigation, content-width variants, and reusable DOM presentation helpers.
- Debug-only stylesheet with tokens and treatments for cards, panels, forms, buttons, tables, code blocks, status messages, maps, and responsive composition.
- Card-based Hub generated from the current registry.
- Migration of every current debug tool to the shared template and removal of superseded page-level inline styling.
- Focused route regression checks, aggregate verification, and manual visual, responsive, and keyboard review of every debug route.

### Excluded

- Gameplay presentation, HUD, runtime minimap, ordinary-play styling, or production design-system work.
- Changes to debug tool behavior, authored-floor data, generator behavior, validation, combat calculations, or route replay.
- Floor resizing, terrain or entity editing, and environment-feature editing.
- Browser automation or screenshot regression infrastructure.

## Files to Change

| File                                       | Change Size | Purpose                                                                                                                     |
| ------------------------------------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| `src/app/debug/debug-shell.ts`             | Medium      | Own shared semantic page construction, Hub navigation, width variants, and reusable debug layout helpers.                   |
| `src/app/debug/debug.css`                  | Large       | Own debug-only tokens, responsive layout, visual states, and presentation for shared and domain-provided semantic classes.  |
| `src/app/debug/debug-router.ts`            | Small       | Load the stylesheet inside the deferred debug graph while preserving exact routing and renderer boundaries.                 |
| `src/app/debug/debug-hub.ts`               | Medium      | Render the registry as the shell's responsive tool-card landing page.                                                       |
| `src/app/debug/combat-explorer.ts`         | Medium      | Adopt the shell and shared control, detail, and table presentation without changing projections.                            |
| `src/app/debug/action-viewer.ts`           | Medium      | Adopt the shell and shared layout while preserving scenario state and keyboard handling.                                    |
| `src/app/debug/floor-map.ts`               | Medium      | Replace local visual declarations with stable semantic classes while retaining authored projection and selection ownership. |
| `src/app/debug/floor-viewer.ts`            | Medium      | Compose validation, map, inspector, and solution evidence inside the shared page and panel structure.                       |
| `src/app/debug/floor-workbench.ts`         | Medium      | Adopt the wide workbench template and shared form/action/status styles without changing draft or validation gates.          |
| `src/app/debug/route-replay.ts`            | Medium      | Adopt the shell and shared status and scrollable-table treatments without changing replay evidence.                         |
| `test/unit/app/debug/debug-router.test.ts` | Small       | Preserve routing and registry expectations after the debug style and shell integration.                                     |

## Execution Outline

1. Add the debug-only stylesheet and semantic shell owner, including standard and wide page variants, navigation, panels, cards, controls, status treatments, table overflow, and responsive behavior.
2. Load the style entry from the debug router, then migrate the Hub first so the registry-driven card index becomes the visual and navigational reference for the remaining pages.
3. Migrate the five tool renderers to the shell without changing their external render contract or domain state, moving reusable inline presentation into scoped classes as each route lands.
4. Adapt the authored map's local classes and responsive composition last within the migration so its dense grid and inspector remain legible without weakening its semantic projection boundary.
5. Run focused route tests and aggregate checks, build production output to retain the debug isolation guarantee, then manually review the Hub and every tool route at wide and narrow widths with keyboard navigation.

## Implementation Notes

- Prefer a small shell result that exposes the semantic page and content mount needed by a renderer. Do not create a broad widget library or make domain renderers register their internal sections with the shell.
- Give tools a standard content width by default and a wide variant for map- or table-heavy surfaces. Wide content remains centered and bounded while individual overflow regions scroll locally instead of forcing page-wide horizontal scrolling.
- Use native controls and landmarks. Styling must cover hover, active, disabled, focus-visible, success, warning, and error states without relying on motion; respect reduced-motion preferences if any transition is added.
- Preserve the Action Viewer's keyboard-handler cleanup and every workbench exact-text validation gate during structural wrapping and rerenders.

## Edge Cases

| Case                                      | Expected Handling                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| An unknown debug path resolves to the Hub | The styled Hub renders normally and exposes every registered tool card.                                             |
| A title or description wraps              | Cards and page headers grow without clipping or overlapping navigation.                                             |
| A map or table is wider than the viewport | Its local region scrolls horizontally while page chrome and primary actions remain reachable.                       |
| A tool rerenders interactive content      | The outer page identity remains consistent and the tool preserves its existing state and listener cleanup contract. |
| CSS fails to load or is disabled          | Semantic headings, links, labels, buttons, tables, and status text remain understandable in document order.         |

## Acceptance Criteria

1. `/debug` is a deliberate, responsive Hub with a descriptive card for every registered tool rather than an unstyled list.
2. Every current debug route uses the same recognizable page header, Hub navigation, typography, surface, control, status, and focus language while retaining its existing behavior.
3. The Floor Set Workbench is readable as a wide authoring page with generator controls, layered map, inspector, JSON editor, validation evidence, and departure actions visually separated without page-wide overflow.
4. Maps and tables remain usable at narrow widths through stacking and local scrolling, and all interactive controls remain keyboard reachable with visible focus and text labels.
5. Debug route resolution and lazy tool loading remain registry-driven, and production verification confirms ordinary play does not load or display the debug shell.
6. No gameplay, floor content, authoring draft, validation, combat, or replay result changes as a consequence of the visual migration.
