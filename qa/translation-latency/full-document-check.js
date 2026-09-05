async page => {
  const completed = await page.evaluate(() =>
    window.translationLatencyBenchmark.waitForFullDocument()
  );
  return {
    completed,
    ...await page.evaluate(() => window.translationLatencyBenchmark.result()),
  };
}
