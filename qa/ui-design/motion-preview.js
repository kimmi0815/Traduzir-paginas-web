'use strict';
(() => {
  const studies = [...document.querySelectorAll('.study')];
  const ready = new Set();
  let mode = 'bilingual';
  const api = study => study.querySelector('iframe').contentWindow.motionSample;
  const status = document.querySelector('#status');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function renderReduced() { document.querySelector('#reducedNotice').hidden = !reduced.matches; }
  renderReduced();
  reduced.addEventListener('change', renderReduced);
  function play(selected) {
    const startAt = performance.timeOrigin + performance.now();
    for (const study of selected) api(study).play({mode, startAt,
      speed:Number(document.querySelector('#speed').value), delayed:document.querySelector('#latency').value === 'delayed'});
    status.textContent = '結果が届いた段落から表示します。';
  }
  function restore() {
    for (const study of ready) api(study).restore();
    status.textContent = '原文に戻しました。好きなタイミングで再生できます。';
  }
  document.querySelector('#playAll').onclick = () => play(studies);
  document.querySelector('#restoreAll').onclick = restore;
  for (const study of studies) study.querySelector('.replay').onclick = () => play([study]);
  for (const button of document.querySelectorAll('[data-mode]')) button.onclick = () => {
    mode = button.dataset.mode;
    for (const sibling of document.querySelectorAll('[data-mode]')) sibling.setAttribute('aria-pressed', String(sibling === button));
    restore();
  };
  for (const control of document.querySelectorAll('select')) control.onchange = restore;
  // Same-origin QA frames only. No extension or page message API is involved.
  window.motionStudy = {
    ready(frame) {
      const study = studies.find(study => study.querySelector('iframe') === frame);
      if (!study) return;
      ready.add(study);
      study.querySelector('.replay').disabled = false;
      this.state(frame, '原文');
      if (ready.size === studies.length) {
        document.querySelector('#playAll').disabled = false;
        document.querySelector('#restoreAll').disabled = false;
        status.textContent = '「まとめて翻訳」で3案を同時に比較。';
      }
    },
    state(frame, text) {
      const study = studies.find(study => study.querySelector('iframe') === frame);
      if (study) study.querySelector('.state').textContent = text;
    },
  };
  function stopMotion() { for (const study of ready) api(study).finishMotion(); }
  window.addEventListener('scroll', stopMotion, {passive:true});
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopMotion(); });
})();
