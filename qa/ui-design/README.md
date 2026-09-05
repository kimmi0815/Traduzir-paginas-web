# Native UI acceptance

The project aims to make TWP page translation feel built into browsers, using Chrome's translation popup as the reference. The default compact popup is still `old-popup.html`, selected by the existing `useOldPopup=yes` preference. The detailed popup remains accessible from its menu.

## Preview

Run from the repository root:

```sh
node qa/ui-design/server.mjs
```

Open `http://127.0.0.1:4190/preview.html`.

For the rounded in-page alternative, open `http://127.0.0.1:4190/rounded-popup.html`.
This harness runs the production `desktopPopup.js` and shared compact-popup controller in a
closed shadow root with a mock message transport. It demonstrates rounded outer corners,
shadows, tab switching, resizing, dismissal, and the return-to-toolbar menu action.
The UI and message-routing checks do not prove real provider output or installed-browser behavior.

Run `node --test qa/ui-design/page-popup.test.mjs` to check sender/tab scoping, allowed commands,
iframe preferences, toolbar routing, rollback, and fallback when a panel cannot open.

This serves the production HTML, CSS, localization, configuration, and UI scripts with a **mock browser-extension API**. It never contacts translation providers or changes installed-extension settings. Mock settings use tab session storage. No QA files are included in extension builds.

Direct pages:

- `/popup/old-popup.html`
- `/options/options.html`

Popup query parameters: `locale=ja|en`, `theme=light|dark`, `state=original|translated|error|unavailable`, `fail=yes`, `target=ja`, `source=en|und`, `sourceDelay=30000`, `service=google|bing|yandex`, `iframes=yes|no`.

Commands sent by the popup are recorded in the DOM in `#fixture-trace`. This tests the message contract, not actual provider output or timing.

## Verified on 2026-09-05

- Compact Japanese and English UI; original and translated tab selection.
- Translate and restore message actions, including restoring while a translation is pending.
- Existing all-frame and top-frame translation preferences produce the corresponding message scope.
- Delayed source detection does not block translation controls.
- Target-language picker applies the selected language; translated state reflects the response.
- Always-translate-language and original-on-hover preferences remain selected after reloading the fixture page.
- Switching providers updates the service label and sends the existing service-swap action.
- Failure shows retry; retry enters translating state and can return to failure.
- Missing content-script responses disable translation and show an unavailable-page message.
- Escape closes the expanded menu and restores focus to the menu button.
- Settings target-language changes survive fixture reload.
- Light/dark language settings and 390px settings layout inspected visually.
- At 390px, navigation opens and closes, and the translation settings have no horizontal overflow.
- Languages, sites, translation, appearance, shortcuts, privacy, storage, other, and experimental settings routes render; the inspected routes have no horizontal document overflow at desktop width.
- No browser console errors reported in the inspected settings flows.
- All functional settings remain available except the deliberately removed donation, release-notes, report, and localization contribution surfaces and the release-notes preference.
- `git diff --check` and `npm run build:local-sourcemaps` pass.
- Translation content scripts, background code, config storage implementation, manifest, and permissions are unchanged.

## Remaining installed-extension acceptance

### Page-panel focus regression (2026-09-05)

- Reproduced the blue outline around the initially focused dialog in the production page-panel fixture.
- Scoped `outline: none` to `.popup-surface:focus`; kept the initial focus and control-level `:focus-visible` styles.
- Visually verified no outer blue ring on opening, and a visible English-tab focus ring after Tab.
- Background tests (6), Chromium/Firefox builds, and `git diff --check` passed. The installed Aside extension and target page still need reloading for this change.

The subsequent settings-only polish, interaction checks, and review boundaries are documented in [settings-review.md](settings-review.md). Popup files and the shared theme were preserved during that pass.

The mock API does not prove real translation, extension popup sizing/lifecycle, browser permissions, or provider behavior. Load the generated Chromium build in the target browser and verify the toolbar popup, translate/restore, menu settings, PDF routing, and opening the options page. Recheck the performance fixture if any translation-core changes are made later.

Build output: `build/TWP_10.2.5.0_Chromium_MV3`.
