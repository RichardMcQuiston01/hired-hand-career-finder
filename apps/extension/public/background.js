// MV3 service worker. Kept as plain JS (public/ assets are copied to dist
// as-is, unbundled) since this only needs one API call. If future stages
// need real logic here, move it into src/background and give it its own
// Vite build entry instead of growing this file.
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error('Failed to set side panel behavior:', error));
});
