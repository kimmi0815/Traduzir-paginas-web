// Exercise the production content-script panel with the mock translation transport.
document.getElementById('openPanel').addEventListener('click', () => window.twpFixture.togglePagePopup());
twpConfig.onReady().then(() => window.twpFixture.togglePagePopup());
