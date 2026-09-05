# Translation latency QA

This fixed corpus separates browser-visible acceptance from build success. It records when visible fixture text is still the source language, when content is blank, and how long the initial viewport takes to translate.

## Serve the corpus

```sh
npm run qa:latency
```

The server exposes:

- `http://127.0.0.1:4177/static.html`
- `http://127.0.0.1:4177/structured.html`
- `http://127.0.0.1:4177/dynamic.html`
- `http://127.0.0.1:4177/stress.html` (2,000 duplicate text elements)

Use a 1280 x 720 viewport and a clean browser profile. Set TWP to Google, source `auto`, target Japanese, disk cache off, and dynamic translation on.

Create a Playwright configuration for either the immutable baseline or the candidate build:

```sh
npm run qa:latency:config -- \
  --extension build/TWP_10.2.5.0_Chromium_MV3 \
  --profile /private/tmp/twp-candidate-profile \
  --output /private/tmp/twp-candidate.json
```

## Playwright CLI sequence

Use the current official CLI package. The older Codex wrapper may still point to `@playwright/mcp`, which no longer exports the `playwright-cli` binary.

```sh
npx --yes --package @playwright/cli playwright-cli -s=twp-latency open http://127.0.0.1:4177/static.html --config /private/tmp/twp-candidate.json --headed --persistent
npx --yes --package @playwright/cli playwright-cli -s=twp-latency resize 1280 720
npx --yes --package @playwright/cli playwright-cli -s=twp-latency snapshot
npx --yes --package @playwright/cli playwright-cli -s=twp-latency run-code --filename=qa/translation-latency/start-translation.js
npx --yes --package @playwright/cli playwright-cli -s=twp-latency run-code "async page => await page.evaluate(() => window.translationLatencyBenchmark.waitForInitialViewport())"
npx --yes --package @playwright/cli playwright-cli -s=twp-latency run-code --filename=qa/translation-latency/full-document-check.js
npx --yes --package @playwright/cli playwright-cli -s=twp-latency eval "() => window.translationLatencyBenchmark.beginExposureSampling()"
npx --yes --package @playwright/cli playwright-cli -s=twp-latency run-code "async page => await page.evaluate(() => window.translationLatencyBenchmark.scroll({pixelsPerSecond: 600, direction: 'down'}))"
npx --yes --package @playwright/cli playwright-cli -s=twp-latency eval "() => window.translationLatencyBenchmark.result()"
```

Before running the sequence, load the target extension build into the browser profile. Branded Chrome and Edge require a profile where the unpacked extension has already been installed; use CDP/extension attachment rather than command-line side-loading.

Run ordinary scrolling at 600 and 1200 pixels per second in both directions. Use 3000 pixels per second only as a stress case. Save screenshots, traces, and JSON under `output/playwright/<label>/`.

Passing ordinary scrolling requires `sourceExposureFrames: 0` and `blankFrames: 0`. Compare initial latency against the immutable `e013d14` baseline; the candidate median may increase by no more than the greater of 10 percent or 100 ms, and p95 by no more than 15 percent. Static full-document completion must have a median of 1.5 seconds or less and improve by at least 20 percent.

On a fresh static-page profile, record the translation service's HTTP request
limits and response status counts with:

```sh
npx --yes --package @playwright/cli playwright-cli -s=twp-latency run-code --filename=qa/translation-latency/network-concurrency-check.js
```

For every service, `maxActive` must be at most 6, `maxNonUrgent` at most 4,
and `maxBackground` at most 4. The Google service's
`responseStatusCounts["429"]` must be absent or zero.

Run the same full-document command on `stress.html` for the baseline and
candidate. Compare `longTasks`, `maxLongTaskMs`, and completion time; the
candidate must not introduce scheduler-originated long tasks.

On `dynamic.html`, the hidden-tab pause/resume path can be checked in TWP's isolated world with:

```sh
npx --yes --package @playwright/cli playwright-cli -s=twp-latency run-code --filename=qa/translation-latency/hidden-visibility-check.js
```

The expected result is `pausedWhileHidden: true` and `resumedAfterVisible: true`.

On `structured.html`, direct text-node insertion into an already translated
element can be checked with:

```sh
npx --yes --package @playwright/cli playwright-cli -s=twp-latency run-code --filename=qa/translation-latency/direct-text-check.js
```

The expected result is `translated: true` and
`existingTranslationPreserved: true`.

Custom-dictionary substitution can be checked on a fresh `structured.html`
session with:

```sh
npx --yes --package @playwright/cli playwright-cli -s=twp-latency run-code --filename=qa/translation-latency/custom-dictionary-check.js
```

The expected result is `preserved: true`.

After background translation has completed, compare the baseline and candidate DOM with:

```sh
npx --yes --package @playwright/cli playwright-cli -s=twp-latency run-code --filename=qa/translation-latency/dom-hash.js
```

The two runs must have the same `count`, `sourceRemaining: 0`, and the same SHA-256 `hash`.
