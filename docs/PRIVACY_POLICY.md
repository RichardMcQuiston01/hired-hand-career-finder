# Privacy Policy — Hired Hand: Career Finder

**Last updated:** 2026-09-22

**Published at:** <https://hiredhandhq.com/career-finder/privacy-policy/> (this
file is the source content; the live page is maintained in the
`hiredhandhq-site` repo — keep the two in sync)

Hired Hand: Career Finder ("the extension") is a Chrome extension that helps
you search, browse, and explore career and occupation data from O\*NET, and
take a career-interest (RIASEC) assessment. This page explains what data the
extension does and does not collect.

## Summary

The extension does not collect, store, or transmit any personally
identifiable information. There is no account, no sign-up, and no user
profile. Nothing you do in the extension is tied to your identity by us.

## What the extension stores, and where

- **Interest Profiler in-progress answers.** While you're partway through the
  Interest Profiler assessment, your answers so far are kept in
  `chrome.storage.session` — a storage area scoped to your current browser
  session. This exists only so your progress survives closing and reopening
  the side panel; it is cleared automatically when you close your browser,
  and is never synced to any account or sent to us.
- **Cached career data and a call-rate limit.** The extension caches
  responses from its O\*NET data proxy in your browser's `localStorage` for a
  short time (to avoid re-fetching data you just looked at) and keeps a small
  counter of how many requests it has made recently (to avoid exceeding the
  O\*NET API's rate limits). This is technical bookkeeping only — it contains
  no personal information and never leaves your browser.
- **Final Interest Profiler results.** Your completed RIASEC scores and
  matched careers are held only in the side panel's memory for that session,
  so you can view and optionally export them. They are not saved anywhere
  after you close the side panel unless you choose to export them yourself
  (see "Exporting your results" below).

None of the above is ever transmitted to us, sold, or shared with third
parties.

## Network requests the extension makes

- **Career/occupation data.** Career Search, Browse Careers, and the
  Interest Profiler all fetch data through the extension's own backend proxy,
  which forwards the request to O\*NET Web Services. The proxy injects the
  API key needed to call O\*NET; the extension itself never holds or sends
  that key. Requests carry only the search terms or occupation codes needed
  to answer your query (e.g. a keyword you searched, or which occupation
  you're viewing) — never anything that identifies you personally. The proxy
  keeps a short-lived, in-memory cache of responses and a request counter to
  stay within O\*NET's rate limits; neither is tied to you individually
  beyond your IP address being used momentarily to apply a per-client rate
  limit, which is not logged or stored.
- **Optional paid upgrade.** Exporting your Interest Profiler results (as
  CSV or a printed PDF) is gated behind a one-time optional upgrade,
  processed by [ExtensionPay](https://extensionpay.com), a third-party
  payment service. If you choose to upgrade, you're taken to ExtensionPay's
  own hosted checkout page — the extension never sees or handles your
  payment details itself. See
  [ExtensionPay's privacy policy](https://extensionpay.com/privacy.html) for
  how they handle payment information.
- **Donate link.** The extension's Options page includes an optional,
  external donation link (Stripe). Following it takes you to Stripe's own
  site; the extension does not collect anything related to donations.

## Exporting your results

If you choose to export your Interest Profiler results, the CSV file is
generated and downloaded entirely within your browser — it is not sent to
any server. Printing to PDF uses your browser's own built-in print function.
In both cases, the exported file exists only on your device; we never
receive a copy.

## What the extension does _not_ do

- No accounts, sign-up, or login.
- No collection of personally identifiable information (name, address,
  email, etc.).
- No health information.
- No collection of your browsing history, web activity, or content of other
  pages you visit.
- No location tracking.
- No analytics, tracking pixels, or advertising of any kind.
- No selling or sharing of data with third parties, because none is
  collected to begin with.

## Permissions this extension requests, and why

- **`sidePanel`** — lets the extension's UI live in Chrome's side panel so
  you can browse careers alongside whatever page you're already on.
- **`storage`** — used only for `chrome.storage.session`, as described
  above (in-progress Interest Profiler answers, cleared when the browser
  closes).

## Children's privacy

This extension is not directed at children and does not knowingly collect
any information from anyone, regardless of age, because it does not collect
personal information from any user.

## Changes to this policy

If this policy changes, the "Last updated" date above will be updated and
the new version will be posted at this same location.

## Contact

Questions about this privacy policy can be sent to: mcqforyoudesign@gmail.com
