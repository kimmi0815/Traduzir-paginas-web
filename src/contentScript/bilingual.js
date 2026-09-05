"use strict";

// Keep the live DOM as the translated copy so page handlers and links survive.
// The source line is inert text: no duplicated IDs, controls, or event handlers.
const twpBilingual = (() => {
  const blocks = 'p,h1,h2,h3,h4,h5,h6,li,dt,dd,td,th,figcaption,blockquote,div';
  const excluded = 'button,input,textarea,select,nav,[contenteditable]:not([contenteditable="false"]),[translate="no"],.notranslate';
  const records = new Map();
  let originals = new WeakMap();
  function blockFor(node) {
    const parent = node.parentElement;
    if (!parent || parent.closest(excluded)) return null;
    const block = parent.closest(blocks);
    // Container sections are handled by their child paragraphs, never duplicated.
    if (!block || block.querySelector(blocks) || block.closest('svg,math')) return null;
    return block;
  }
  function sourceText(block) {
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    const parts = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement.closest(excluded + ',script,style')) continue;
      parts.push(originals.has(node) ? originals.get(node) : node.textContent);
    }
    return parts.join('');
  }
  return {
    prepare(nodes) {
      const affected = new Set();
      for (const node of nodes) {
        if (!originals.has(node)) originals.set(node, node.textContent);
        const block = blockFor(node);
        if (block) affected.add(block);
      }
      for (const block of affected) {
        let record = records.get(block);
        if (!record) {
          record = { text: sourceText(block), copy: null };
          records.set(block, record);
        } else {
          record.text = sourceText(block);
          if (record.copy) record.copy.textContent = record.text;
        }
      }
    },
    show(node, language) {
      const block = blockFor(node);
      const record = records.get(block);
      if (!record || record.copy || !block.isConnected) return;
      const copy = document.createElement('span');
      copy.className = 'notranslate';
      copy.setAttribute('translate', 'no');
      copy.setAttribute('data-twp-bilingual-source', '');
      if (language && language !== 'und') copy.lang = language;
      copy.dir = 'auto';
      copy.style.cssText = 'display:block!important;margin:0 0 .4em!important;white-space:pre-wrap;';
      copy.textContent = record.text;
      record.copy = copy;
      block.insertBefore(copy, block.firstChild);
    },
    clear() {
      for (const record of records.values()) record.copy?.remove();
      records.clear();
      // Text nodes can be reused by a page after restoring.
      // prepare snapshots their new value on the next translation run.
      originals = new WeakMap();
    },
  };
})();
