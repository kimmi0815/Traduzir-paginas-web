async page => {
  const valuesHash = () =>
    page.evaluate(async () => {
      const values = [...document.querySelectorAll("[data-bench-source]")].map(
        (element) =>
          element.dataset.benchAttribute
            ? element.getAttribute(element.dataset.benchAttribute)
            : element.textContent
      );
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(values))
      );
      return [...new Uint8Array(digest)]
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("");
    });

  await page.evaluate(() =>
    window.translationLatencyBenchmark.waitForFullDocument()
  );
  const translatedHash = await valuesHash();
  const url = page.url();
  let worker = page.context().serviceWorkers()[0];
  if (!worker) {
    worker = await page.context().waitForEvent("serviceworker", {
      timeout: 5000,
    });
  }
  const tabId = await worker.evaluate(async (pageUrl) => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((candidate) => candidate.url === pageUrl);
    if (!tab?.id) throw new Error(`Fixture tab not found: ${pageUrl}`);
    await chrome.tabs.sendMessage(tab.id, { action: "restorePage" });
    return tab.id;
  }, url);

  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("[data-bench-source]")].every((element) => {
        const value = element.dataset.benchAttribute
          ? element.getAttribute(element.dataset.benchAttribute)
          : element.textContent;
        return value.trim() === element.dataset.benchSource.trim();
      }),
    null,
    { timeout: 10000 }
  );
  await page.evaluate(() => window.translationLatencyBenchmark.startTiming());
  await worker.evaluate(async (id) => {
    await chrome.tabs.sendMessage(id, {
      action: "translatePage",
      targetLanguage: "ja",
    });
  }, tabId);
  const retranslated = await page.evaluate(() =>
    window.translationLatencyBenchmark.waitForFullDocument()
  );
  const retranslatedHash = await valuesHash();
  return {
    passed: retranslated && translatedHash === retranslatedHash,
    retranslated,
    retranslatedHash,
    translatedHash,
  };
}
