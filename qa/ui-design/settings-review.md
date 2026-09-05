# Settings interface review — 2026-09-05

Mode: **full**, using `make-interfaces-feel-better`.

Scope: the nine options-page sections, their navigation, controls, rules, light/dark surfaces, and responsive layout. Plain HTML/JavaScript and CSS layered over the existing W3 styles; no new framework or runtime dependency. Popup files and shared theme are outside this change. The browser preview executes production UI/configuration scripts with a mock extension API, not an installed extension.

## Coverage

| Category | Evidence inspected | Result |
| --- | --- | --- |
| Typography | Settings titles, labels, rule empty states, range outputs, storage count; `native-options.css` | Hierarchy, wrapping, and tabular numerals improved. Existing shared macOS font smoothing retained. |
| Surfaces | All nine routes at desktop and 390px; language/rule cards and translation controls in light/dark screenshots | Grouped surfaces, quieter dividers, consistent spacing and larger controls. |
| Animations | Options CSS, shared reduced-motion rule, menu and switch interactions | Routine changes are immediate; no staged entrance. Press feedback is 0.96. |
| Icons | Nine sidebar SVGs, removal buttons, existing shortcut utility icons | Sidebar uses one outline vocabulary and currentColor. Removal controls have names. Existing shortcut utilities retained. |
| Performance | Options initialization and removed auxiliary code; CSS transition declarations; browser warning/error logs; build | No added dependency, polling, transition-all, or will-change. No observed browser errors. |

## Findings and implemented changes

All findings below are resolved within the requested scope.

### Typography and hierarchy

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| LOW | `src/options/options.html:18`, `:50`; `src/options/native-options.css:11`, `:104`, `:151` | Brand and page titles competed; loosely arranged sections and changing numeric widths | Quiet brand/eyebrow, single page h1, balanced headings, pretty labels, tabular output/storage numerals | Text wrapping and stable hierarchy make the active setting easier to find. |

### Surfaces, grouping, and hit areas

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| MEDIUM | `src/options/native-options.css:25`, `:94`, `:111` | Strong outer borders and disconnected preference rows | Subtle layered shadows, structural dividers, grouped language/provider/favorite settings, consistent spacing | Shadows communicate elevation; borders communicate relationships. |
| MEDIUM | `src/options/settings-ui.js:48`; `src/options/native-options.css:123`; `src/_locales/{en,ja}/messages.json:2` | Blank space below empty lists; headings and list content separate | A rule card combines heading, Add control, list, and localized empty state | Empty and populated states are explicit and remain visually connected. |
| MEDIUM | `src/options/settings-ui.js:14`; `src/options/options.html:419`; `src/options/native-options.css:114` | Binary settings require opening a select menu | Semantic 52×44 switches retain original select/change handlers; named choices such as popup style stay selects | One-action operation and static color/position cues, without changing stored values or configuration contracts. |
| MEDIUM | `src/options/options.html:279`; `src/options/settings-ui.js:80`; `src/options/native-options.css:136`, `:160` | Small standalone ranges and tightly stacked checkbox labels | Named ranges in grouped rows, 40px range area, 44px checkbox label rows, visually disabled dependent controls | Larger nonoverlapping targets and explicit label association improve mouse and keyboard use. |
| LOW | `src/options/native-options.css:152`, `:164` | Experimental and storage controls visually disconnected | Settings cards, constrained text-field widths, quieter utility actions, distinct destructive-action color | Surface consistency extends to infrequently used settings. |

### Keyboard operation and icons

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| HIGH | `src/options/options.js:275`, `:318`, `:361`, `:412`, `:455`, `:499`, `:548`; `src/options/settings-ui.js:3` | Clickable removal spans lack keyboard semantics; removal drops focus | Native buttons named with their rule, 40px desktop/44px mobile targets, focus moves to the next rule or Add control | Every destructive list action is keyboard reachable and retains the user's place. |
| MEDIUM | `src/options/settings-ui.js:59`, `:90` | Overlay Add button and select duplicate keyboard stops; mobile menu lacks Escape handling | Name the real select, remove inert visual button from keyboard/AX order; Escape closes menu and focuses trigger | Clear accessible names and predictable focus. |
| LOW | `src/options/options.html:21`; `src/options/native-options.css:107` | Text-only navigation without visual anchors | Nine decorative inline SVGs, one outline style, 1.5px currentColor stroke, selected/hover colors | Match icon weight to labels without adding assets or icon packages. |

### Motion restraint and performance

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| LOW | `src/options/options.css:51`; `src/options/native-options.css:149` | Legacy menu bars declare transition-all | Immediate routine feedback; 0.96 press state; no custom entrance animation or will-change | Motion restraint and transition specificity avoid distracting or incidental changes. No timed animation remains to replay at 10% speed. |
| MEDIUM | `src/options/options.html:15`; `src/options/options.js:56`; `src/options/options.css:230` | Donation, release notes, report, translation-contribution links and donation/release-notes UI code remain visible/loaded | Removed these surfaces, their orphan handlers/styles, delayed release-note loading, and release-note preference from settings; old hashes fall back to Languages | Applies the user's requested removal and reduces auxiliary UI/code. Background update behavior and stored preferences are unchanged. |

## Considered but rejected

| Location | Candidate | Rejected because |
| --- | --- | --- |
| `src/lib/ui-theme.css`, `src/popup/*` | Tune shared theme or popup details | User approved the popup and explicitly restricted this task to settings. These files are byte-identical to the start of this turn. |
| `src/options/settings-ui.js:18` | Convert every yes/no-valued select to a switch | Popup style stores yes/no but presents named choices. A switch would obscure the selected style. |
| `src/options/native-options.css` | Animate section entrances and switch thumbs | High-frequency settings navigation benefits from immediate feedback; no motion dependency is justified. |
| `src/options/options.html` | Remove advanced translation, privacy, or experimental settings | User requested removal of auxiliary links, not functional capabilities. These settings remain accessible. |

## Verification

- `npm run build:local-sourcemaps`: passed Firefox and Chromium builds. Babel emitted only its existing large-polyfill formatting notice.
- `node --check src/options/settings-ui.js` and `node --check src/options/options.js`: passed.
- `git diff --check`: passed after removing a trailing blank line.
- `shasum -a 256 -c /private/tmp/twp-settings-only-before.sha256`: every popup file and `src/lib/ui-theme.css` passed, proving no changes during this settings-only turn.
- Browser: all nine routes render without horizontal document overflow at desktop width and 390px. At 390px, selecting each route closes navigation. Escape closes navigation and returns focus to its trigger.
- Browser: switch click writes the original setting; reload retains it. Space toggles it with a visible focus outline. Related advanced checkboxes disable/enable correctly. Popup-style choice remains a select.
- Browser: add Ukrainian to Never Translate, reload and retain it, delete by Enter, return to localized empty state. After the final reload, deletion restores focus to the Add select.
- Browser: dark theme applies live and survives reload. Light/dark language and translation surfaces and narrow dark translation layout were visually inspected.
- Browser: old `#release_notes` route falls back to Languages; sidebar contains only the nine settings categories.
- Browser: switch hit area measured 52×44; checkbox labels measured 44px high. Hover/press rules inspected in CSS; keyboard focus inspected in the browser. No browser warning/error logs in the inspected flows.
- Preview tabs refreshed to load the final files.

**Not verified:** installed-extension settings persistence and permissions; external provider/API forms; backup/import/reset/cache destructive actions; every locale and RTL layout; browser-native select popup appearance across Firefox/Chromium; sustained loading/error states from actual background services. Those underlying integrations were not changed. Hover and held-press rendering were not captured as separate screenshots. No timed animation was added, so 10%-speed animation replay is not applicable.

**Verdict: Approve** for the requested settings interface polish; no actionable finding remains in the inspected scope. The unverified integrations and visual checks above remain acceptance boundaries, not claims of end-to-end extension verification.
