const popup = document.getElementById('popup');
let selectedState = 'original';
let dark = false;
let observer;
function updatePreview() {
  popup.src = '/popup/old-popup.html?target=ja&service=google&source=und&state=' + selectedState + '&theme=' + (dark ? 'dark' : 'light');
}
for (const button of document.querySelectorAll('[data-state]')) {
  button.addEventListener('click', () => {
    selectedState = button.dataset.state;
    document.querySelectorAll('[data-state]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    updatePreview();
  });
}
document.getElementById('theme').addEventListener('click', (event) => {
  dark = !dark;
  event.target.setAttribute('aria-pressed', String(dark));
  updatePreview();
});
popup.addEventListener('load', () => {
  if (observer) observer.disconnect();
  const body = popup.contentDocument.body;
  const resize = () => { popup.style.height = Math.ceil(body.getBoundingClientRect().height) + 'px'; };
  observer = new ResizeObserver(resize);
  observer.observe(body);
  resize();
});
