async page => {
  const fullDocumentCompleted = await page.evaluate(() =>
    window.translationLatencyBenchmark.waitForFullDocument()
  );
  const coverage = await page.evaluate(() => {
    const placeholder = document.querySelector("input");
    const titledButton = document.querySelector("button");
    const shadow = document.querySelector("#shadow-host").shadowRoot;
    const shadowNodes = [...shadow.querySelectorAll("[data-bench-source]")];
    return {
      notranslatePreserved:
        document.querySelector(".notranslate").textContent ===
        "DO NOT TRANSLATE THIS SENTENCE.",
      placeholderTranslated:
        placeholder.placeholder !== placeholder.dataset.benchSource,
      preText: document.querySelector("pre").textContent,
      shadowTranslated: shadowNodes.every(
        (node) => node.textContent.trim() !== node.dataset.benchSource.trim()
      ),
      titleTranslated:
        titledButton.title !== titledButton.dataset.benchSource,
    };
  });
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
  const iframeTranslated = frame
    ? await frame.locator("body").evaluate(
        (body) =>
          !body.textContent.includes("Frame translation heading") &&
          !body.textContent.includes(
            "Text inside a same-origin frame should follow the same scheduling path."
          )
      )
    : false;
  return {
    ...coverage,
    fullDocumentCompleted,
    iframeTranslated,
    passed:
      fullDocumentCompleted &&
      iframeTranslated &&
      coverage.notranslatePreserved &&
      coverage.placeholderTranslated &&
      coverage.shadowTranslated &&
      coverage.titleTranslated,
  };
}
