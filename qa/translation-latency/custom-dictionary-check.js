async page => {
  const url = page.url();
  let worker = page.context().serviceWorkers()[0];
  if (!worker) {
    worker = await page.context().waitForEvent("serviceworker", {
      timeout: 5000,
    });
  }

  await worker.evaluate(async (pageUrl) => {
    await chrome.storage.local.set({
      pageTranslatorService: "google",
      targetLanguage: "ja",
      enableDiskCache: "no",
      customDictionary: { "linked reference": "DICTIONARY_REFERENCE" },
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((candidate) => candidate.url === pageUrl);
    if (!tab?.id) throw new Error(`Fixture tab not found: ${pageUrl}`);
    await chrome.tabs.sendMessage(tab.id, {
      action: "translatePage",
      targetLanguage: "ja",
    });
  }, url);

  await page.waitForFunction(
    () => document.querySelector("header a").textContent === "DICTIONARY_REFERENCE",
    null,
    { timeout: 10000 }
  );

  const translatedText = await page.locator("header a").innerText();
  return {
    preserved: translatedText === "DICTIONARY_REFERENCE",
    translatedText,
  };
}
