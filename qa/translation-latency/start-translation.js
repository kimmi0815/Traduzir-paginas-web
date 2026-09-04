async page => {
  const url = page.url();
  await page.evaluate(() => window.translationLatencyBenchmark?.startTiming());

  let worker = page.context().serviceWorkers()[0];
  if (!worker) {
    worker = await page.context().waitForEvent("serviceworker", {
      timeout: 5000,
    });
  }

  return worker.evaluate(async (pageUrl) => {
    await chrome.storage.local.set({
      pageTranslatorService: "google",
      targetLanguage: "ja",
      enableDiskCache: "no",
      translateDynamicallyCreatedContent: "yes",
      enableIframePageTranslation: "yes",
    });

    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((candidate) => candidate.url === pageUrl);
    if (!tab?.id) throw new Error(`Fixture tab not found: ${pageUrl}`);

    await chrome.tabs.sendMessage(tab.id, {
      action: "translatePage",
      targetLanguage: "ja",
    });

    return { tabId: tab.id, url: tab.url };
  }, url);
}
