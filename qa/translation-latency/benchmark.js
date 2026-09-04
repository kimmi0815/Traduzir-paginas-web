(() => {
  "use strict";

  const tracked = new Set();
  let timingActive = false;
  let exposureActive = false;
  let frameHandle = null;
  let timingStartedAt = 0;
  let exposureStartedAt = 0;
  let currentExposureStartedAt = null;
  let firstVisibleTranslationMs = null;
  let initialViewportCompleteMs = null;
  let sourceExposureFrames = 0;
  let blankFrames = 0;
  let maxContinuousSourceExposureMs = 0;
  const exposedIds = new Set();

  const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();

  function collectFromRoot(root) {
    if (!root) return;
    if (root.nodeType === Node.ELEMENT_NODE && root.matches("[data-bench-source]")) {
      tracked.add(root);
    }
    if (root.querySelectorAll) {
      root.querySelectorAll("[data-bench-source]").forEach((element) =>
        tracked.add(element)
      );
      root.querySelectorAll("*").forEach((element) => {
        if (element.shadowRoot) collectFromRoot(element.shadowRoot);
      });
    }
  }

  function isVisible(element) {
    if (!element.isConnected) return false;
    const rect = element.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > innerHeight || rect.right < 0 || rect.left > innerWidth) {
      return false;
    }
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  function currentValue(element) {
    const attributeName = element.dataset.benchAttribute;
    return attributeName
      ? element.getAttribute(attributeName)
      : element.textContent;
  }

  function visibleState() {
    const visible = [...tracked].filter(isVisible);
    const source = visible.filter(
      (element) => normalize(currentValue(element)) === normalize(element.dataset.benchSource)
    );
    const blank = visible.filter((element) => normalize(currentValue(element)).length === 0);
    return { blank, source, visible };
  }

  function sampleFrame(now) {
    const state = visibleState();
    if (timingActive && state.visible.length > 0) {
      if (
        firstVisibleTranslationMs == null &&
        state.source.length < state.visible.length
      ) {
        firstVisibleTranslationMs = now - timingStartedAt;
      }
      if (initialViewportCompleteMs == null && state.source.length === 0) {
        initialViewportCompleteMs = now - timingStartedAt;
      }
    }

    if (exposureActive) {
      if (state.source.length > 0) {
        sourceExposureFrames++;
        state.source.forEach((element) =>
          exposedIds.add(element.dataset.benchId || "unlabelled")
        );
        if (currentExposureStartedAt == null) currentExposureStartedAt = now;
        maxContinuousSourceExposureMs = Math.max(
          maxContinuousSourceExposureMs,
          now - currentExposureStartedAt
        );
      } else {
        currentExposureStartedAt = null;
      }
      if (state.blank.length > 0) blankFrames++;
    }

    frameHandle = requestAnimationFrame(sampleFrame);
  }

  collectFromRoot(document);
  new MutationObserver((mutations) => {
    mutations.forEach((mutation) =>
      mutation.addedNodes.forEach(collectFromRoot)
    );
  }).observe(document.documentElement, { childList: true, subtree: true });
  frameHandle = requestAnimationFrame(sampleFrame);

  window.translationLatencyBenchmark = {
    startTiming() {
      timingActive = true;
      timingStartedAt = performance.now();
      firstVisibleTranslationMs = null;
      initialViewportCompleteMs = null;
    },

    beginExposureSampling() {
      exposureActive = true;
      exposureStartedAt = performance.now();
      sourceExposureFrames = 0;
      blankFrames = 0;
      maxContinuousSourceExposureMs = 0;
      currentExposureStartedAt = null;
      exposedIds.clear();
    },

    stop() {
      timingActive = false;
      exposureActive = false;
      currentExposureStartedAt = null;
    },

    async waitForInitialViewport(timeoutMs = 15000) {
      const deadline = performance.now() + timeoutMs;
      while (performance.now() < deadline) {
        if (visibleState().source.length === 0) return true;
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      return false;
    },

    async scroll({ pixelsPerSecond = 600, direction = "down" } = {}) {
      const sign = direction === "up" ? -1 : 1;
      let previous = performance.now();
      const atLimit = () =>
        sign > 0
          ? scrollY + innerHeight >= document.documentElement.scrollHeight - 1
          : scrollY <= 0;

      while (!atLimit()) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const now = performance.now();
        const elapsedSeconds = (now - previous) / 1000;
        previous = now;
        scrollBy(0, sign * pixelsPerSecond * elapsedSeconds);
      }
    },

    result() {
      return {
        firstVisibleTranslationMs,
        initialViewportCompleteMs,
        sourceExposureFrames,
        blankFrames,
        maxContinuousSourceExposureMs,
        exposedIds: [...exposedIds],
        exposureDurationMs: exposureStartedAt
          ? performance.now() - exposureStartedAt
          : 0,
        trackedElements: tracked.size,
      };
    },

    dispose() {
      if (frameHandle != null) cancelAnimationFrame(frameHandle);
    },
  };
})();
