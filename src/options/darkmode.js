function enableDarkMode() {
  document.documentElement.dataset.theme = "dark";
  sessionStorage.setItem("darkModeIsEnabled", "yes");
}
function disableDarkMode() {
  document.documentElement.dataset.theme = "light";
  sessionStorage.setItem("darkModeIsEnabled", "no");
}
if (sessionStorage.getItem("darkModeIsEnabled") === "yes") enableDarkMode();
