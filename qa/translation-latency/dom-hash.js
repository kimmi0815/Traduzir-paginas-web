async page =>
  page.evaluate(async () => {
    const elements = [...document.querySelectorAll("[data-bench-source]")];
    const values = elements.map((element) =>
      element.dataset.benchAttribute
        ? element.getAttribute(element.dataset.benchAttribute)
        : element.textContent
    );
    const sourceRemaining = elements.filter(
      (element, index) =>
        values[index].trim() === element.dataset.benchSource.trim()
    ).length;
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify(values))
    );
    return {
      count: values.length,
      sourceRemaining,
      hash: [...new Uint8Array(digest)]
        .map((value) => value.toString(16).padStart(2, "0"))
        .join(""),
    };
  })
