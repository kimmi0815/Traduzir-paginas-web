const concepts = [
  {
    name: '文とA', recommended: true,
    description: '囲いをなくした、翻訳そのものの記号。小さくても意味が伝わる、最も素直な案。',
    paths: '<path d="M3 6h11M8.5 3v3M11.5 6c-.6 5-3.3 8.3-8 10M5 9c1.1 2.8 3.5 5.2 6.5 6.5M13 21l4.5-11L22 21M14.6 17h5.8"/>'
  },
  {
    name: 'Aと文',
    description: 'Aを左上、文を右下に。文字は反転せず、同じ線の太さで並び順を入れ替えた案。',
    paths: '<path d="M2 14 6.5 3 11 14M3.6 10h5.8M10 11h11M15.5 8v3M18.5 11c-.6 5-3.3 8.3-8 10M12 14c1.1 2.8 3.5 5.2 6.5 6.5"/>'
  },
  {
    name: '重なるページ · Aと文',
    description: '左にA、右に文。Aのページを手前に重ね、文のページが後ろからのぞく案。',
    paths: '<path d="M13 6h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-1M4 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M4.5 14l3-7 3 7M5.5 11.5h4M15 11h5M17.5 9.5V11M19 11c-.3 3-1.6 5-4 6.5M15.5 13c.6 1.8 2 3.4 4.5 4.5"/>'
  },
  {
    name: '言語の往復',
    description: 'Aと折り返す矢印を一体に。文字量を減らし、切り替える軽快さを出す案。',
    paths: '<path d="M7 17l5-12 5 12M9 13h6M3 9V4h5M3 4l3 3M21 15v5h-5M21 20l-3-3"/>'
  },
  {
    name: '重なるページ · Aが下、文が上',
    description: '左のAを下へ、右の文を上へ。Aのページが手前に重なる配置。',
    paths: '<path d="M10 6V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-7M4 6h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"/><path d="M4.5 17l3-7 3 7M5.5 14.5h4M15 8h5M17.5 6.5V8M19 8c-.3 3-1.6 5-4 6.5M15.5 10c.6 1.8 2 3.4 4.5 4.5"/>'
  },
  {
    name: 'Aと文 · Aが下、文が上',
    description: '2番の枠なしの案を、左下にA、右上に文の配置に。文字の形と線の太さはそのまま。',
    paths: '<path d="M2 21 6.5 10 11 21M3.6 17h5.8M11 6h11M16.5 3v3M19.5 6c-.6 5-3.3 8.3-8 10M13 9c1.1 2.8 3.5 5.2 6.5 6.5"/>'
  },
];
function icon(paths, size) {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"${size ? ` style="width:${size}px;height:${size}px"` : ''}>${paths}</svg>`;
}
const star = '<svg class="icon neighbor" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/></svg>';
const menu = '<svg class="icon neighbor" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r=".8"/><circle cx="12" cy="12" r=".8"/><circle cx="12" cy="19" r=".8"/></svg>';
document.getElementById('choices').innerHTML = concepts.map((concept, i) => `
  <section class="card"><div class="heading"><span class="number">0${i + 1}</span><h2>${concept.name}${concept.recommended ? '<span class="badge">第一候補</span>' : ''}</h2></div>
  <div class="large"><div class="sample mono">${icon(concept.paths)}<small>通常</small></div><div class="sample on">${icon(concept.paths)}<small>翻訳オン</small></div></div>
  <p class="caption">${concept.description}</p>
  <div class="actual"><div class="label">実寸</div><div class="sizes mono">${[16,20,24].map(size=>`<span class="size">${icon(concept.paths,size)}<small>${size}</small></span>`).join('')}</div></div>
  <div class="toolbars"><div class="label">ツールバーで試す</div>${[false,true].map(dark=>`<div class="bar${dark?' dark':''}"><div class="address"></div>${star}<button class="state-button" aria-label="${concept.name}：翻訳オン" aria-pressed="false">${icon(concept.paths)}</button>${menu}</div>`).join('')}<p class="hint">アイコンをクリックして切り替え</p></div></section>
`).join('');
document.querySelectorAll('.state-button').forEach(button => {
  button.addEventListener('click', () => {
    const active = button.getAttribute('aria-pressed') !== 'true';
    button.closest('.card').querySelectorAll('.state-button').forEach(other => other.setAttribute('aria-pressed', String(active)));
  });
});
