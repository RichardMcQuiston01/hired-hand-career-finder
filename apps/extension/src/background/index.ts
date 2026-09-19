// MV3 service worker, bundled via Vite (see vite.config.ts's `background`
// build entry) since it now pulls in the `extpay` npm package.
import ExtPay from 'extpay';
import { EXTPAY_EXTENSION_ID } from '../lib/extpay';

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error('Failed to set side panel behavior:', error));
});

// Per the extpay README, this must be initialized in the background script
// exactly once, at the top level — never re-declared inside a later
// service-worker callback's closure (MV3 service workers are non-persistent,
// so a captured top-level reference can become `undefined` there; if a
// future change needs `extpay` inside a `chrome.*` callback here, create a
// fresh `ExtPay(EXTPAY_EXTENSION_ID)` inside that callback instead of
// closing over this one).
const extpay = ExtPay(EXTPAY_EXTENSION_ID);
extpay.startBackground();
