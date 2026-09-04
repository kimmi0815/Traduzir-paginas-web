async page => {
  const cdp = await page.context().newCDPSession(page);
  const contexts = [];
  cdp.on("Runtime.executionContextCreated", (event) =>
    contexts.push(event.context)
  );
  await cdp.send("Runtime.enable");
  await page.waitForTimeout(100);
  const isolated = contexts.find(
    (context) =>
      context.origin.startsWith("chrome-extension://") &&
      context.auxData &&
      context.auxData.type === "isolated"
  );
  if (!isolated) throw new Error("TWP isolated world not found");

  const setVisibility = async (state) =>
    cdp.send("Runtime.evaluate", {
      contextId: isolated.id,
      expression:
        "Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => '" +
        state +
        "'}); document.dispatchEvent(new Event('visibilitychange')); document.visibilityState",
    });

  await setVisibility("hidden");
  const before = await page.locator(".card").count();
  await page.evaluate(() => appendBurst(4));
  await page.waitForTimeout(500);
  const hiddenText = await page.locator(".card").nth(before).locator("p").innerText();
  const source = await page
    .locator(".card")
    .nth(before)
    .locator("p")
    .getAttribute("data-bench-source");

  await setVisibility("visible");
  await page.waitForFunction(
    (index) => {
      const node = document.querySelectorAll(".card")[index].querySelector("p");
      return node.textContent.trim() !== node.dataset.benchSource.trim();
    },
    before,
    { timeout: 10000 }
  );
  const visibleText = await page
    .locator(".card")
    .nth(before)
    .locator("p")
    .innerText();
  await cdp.detach();
  return {
    pausedWhileHidden: hiddenText === source,
    resumedAfterVisible: visibleText !== source,
    hiddenText,
    visibleText,
  };
}
