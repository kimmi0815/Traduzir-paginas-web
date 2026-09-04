async page => {
  const paragraph = page.locator("header p");
  const before = await paragraph.innerText();
  const insertedSource =
    " A newly inserted sentence should be translated promptly.";

  await paragraph.evaluate(
    (node, source) => node.append(document.createTextNode(source)),
    insertedSource
  );

  await page.waitForFunction(
    (source) => !document.querySelector("header p").textContent.includes(source),
    insertedSource,
    { timeout: 10000 }
  );

  const after = await paragraph.innerText();
  return {
    translated: !after.includes(insertedSource),
    existingTranslationPreserved: after.startsWith(before),
    before,
    after,
  };
}
