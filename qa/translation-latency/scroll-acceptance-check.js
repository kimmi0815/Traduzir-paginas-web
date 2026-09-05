async page => {
  const options = await page.evaluate(() =>
    Object.fromEntries(new URLSearchParams(location.search))
  );
  const pixelsPerSecond = Number(options.speed || 600);
  const direction = options.direction === "up" ? "up" : "down";

  if (direction === "up") {
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(500);
  }

  const url = page.url();
  await page.evaluate(() => window.translationLatencyBenchmark.startTiming());
  let worker = page.context().serviceWorkers()[0];
  if (!worker) {
    worker = await page.context().waitForEvent("serviceworker", {
      timeout: 5000,
    });
  }

  const diagnosticsEnabled = await worker.evaluate(async (pageUrl) => {
    await chrome.storage.local.set({
      pageTranslatorService: "google",
      targetLanguage: "ja",
      enableDiskCache: "no",
      translateDynamicallyCreatedContent: "yes",
      enableIframePageTranslation: "yes",
    });
    const supportsDiagnostics =
      typeof translationService.resetRequestSchedulerDiagnostics === "function";
    if (supportsDiagnostics) {
      translationService.resetRequestSchedulerDiagnostics();
    }
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((candidate) => candidate.url === pageUrl);
    if (!tab?.id) throw new Error(`Fixture tab not found: ${pageUrl}`);
    await chrome.tabs.sendMessage(tab.id, {
      action: "translatePage",
      targetLanguage: "ja",
    });
    return supportsDiagnostics;
  }, url);

  const initialViewportCompleted = await page.evaluate(() =>
    window.translationLatencyBenchmark.waitForInitialViewport()
  );
  await page.evaluate(() =>
    window.translationLatencyBenchmark.beginExposureSampling()
  );
  await page.evaluate(
    (scrollOptions) =>
      window.translationLatencyBenchmark.scroll(scrollOptions),
    { direction, pixelsPerSecond }
  );
  await page.waitForTimeout(500);

  const benchmark = await page.evaluate(() => {
    window.translationLatencyBenchmark.stop();
    return window.translationLatencyBenchmark.result();
  });
  const services = diagnosticsEnabled
    ? await worker.evaluate(() =>
        translationService.getRequestSchedulerDiagnostics()
      )
    : [];
  const google = services.find((service) => service.serviceName === "google");
  return {
    benchmark,
    direction,
    initialViewportCompleted,
    passed:
      initialViewportCompleted &&
      benchmark.sourceExposureFrames === 0 &&
      benchmark.blankFrames === 0 &&
      benchmark.sourceRemaining === 0 &&
      Number(google?.responseStatusCounts?.["429"] || 0) === 0,
    pixelsPerSecond,
    services,
  };
}
