# Manual screen reader testing script

> **Status: NOT YET EXECUTED.** This script was written as part of Stage 4
> (`feature/a11y-hardening`) but has not been run by a human. The sandbox
> this stage was built in is Linux-only — there is no macOS (VoiceOver) or
> Windows (NVDA) available to run it. Everything in this repo that touches
> accessibility up to this point (component-level `jest-axe` tests, the
> whole-page `@axe-core/playwright` scans in `apps/extension/e2e/`, and the
> manual keyboard-only Playwright test in `e2e/keyboard-nav.spec.ts`) is
> **automated and machine-verified**. Nothing has been listened to with an
> actual screen reader. A human needs to run this checklist — on real
> hardware, with a real screen reader — before this stage can be called
> genuinely WCAG 2.1 AA-verified, not just "AA by the parts a computer can
> check."

## Who this is for

You don't need prior screen reader experience to run this — each step says
exactly what key to press and what you should hear. Read a step, do it,
listen, and check the box. If something doesn't match, write down exactly
what you heard (or didn't) next to that step; that's the bug report.

## Setup

You'll test the same build two ways: VoiceOver on macOS, and NVDA on
Windows. You don't need the packaged Chrome extension for this — the built
pages work fine served locally, which is simpler to set up.

1. On the machine you're testing from, clone this repo and check out the
   branch/commit you're testing.
2. `npm install` at the repo root, then `npm run build -w apps/extension`.
3. `cd apps/extension && npx vite preview --port 4173`.
4. Open the side panel page at `http://localhost:4173/src/sidepanel/index.html`
   and the Options page at `http://localhost:4173/src/options/index.html`.
   (The real extension's Side Panel and Options page render this same HTML;
   testing them as plain browser tabs is equivalent for screen reader
   purposes and much easier to set up than loading an unpacked extension.)
5. Because this serves the built pages directly rather than running behind
   the real API proxy, Search/Browse/Interest Profiler network calls will
   fail (you'll see error states, e.g. "Something went wrong..."). That's
   expected and fine for most of this script — screen reader behavior around
   the chrome (skip link, tabs, forms, focus) doesn't depend on real data.
   Section 3 (the full Interest Profiler run) is the one part that needs
   real questions to answer; if the proxy isn't reachable from your machine,
   ask whoever owns `apps/proxy`'s deployment for a reachable URL and set
   `VITE_PROXY_BASE_URL` to it before the build step above.

**Browser/screen reader pairings to test** (per the development plan's
accessibility baseline):

- [ ] VoiceOver + Safari (macOS)
- [ ] VoiceOver + Chrome (macOS)
- [ ] NVDA + Chrome (Windows)
- [ ] NVDA + Firefox (Windows)

Run the whole checklist below once per pairing. If you only have time for
one pass, do VoiceOver + Chrome and NVDA + Chrome first — Safari/Firefox
are lower priority since Chrome is the extension's actual runtime.

**Quick key reference:**

| Action                                | VoiceOver (macOS)                 | NVDA (Windows)                |
| ------------------------------------- | --------------------------------- | ----------------------------- |
| Turn screen reader on/off             | Cmd+F5                            | Ctrl+Alt+N (or NVDA shortcut) |
| Move to next focusable element        | Tab                               | Tab                           |
| Activate a link/button                | Space or Enter                    | Space or Enter                |
| Read current line/item                | VO+Right Arrow (VO = Ctrl+Option) | Down Arrow (in browse mode)   |
| Move between radio buttons in a group | Arrow keys                        | Arrow keys                    |

---

## 1. Opening the side panel: skip link and landmarks

1. [ ] Load the side panel page fresh (reload it) with the screen reader
       running.
2. [ ] Press Tab once. **Expect to hear:** "Skip to main content, link." The
       skip link should also become visible on screen at this point (a
       small orange badge, top-left).
3. [ ] Press Enter/Space to activate it. **Expect to hear:** the screen
       reader announce arriving at the main content region (VoiceOver:
       something like "main"; NVDA: "main landmark" or similar) — not
       silence, and not a jump back to the top of the page.
4. [ ] Using your screen reader's landmarks/regions list (VoiceOver: VO+U
       then arrow to "Landmarks"; NVDA: Insert+F7, "Landmarks" category),
       confirm you can see and reach: a **banner** (the "Career Finder"
       header), a **main** region, and a **contentinfo** (footer, with the
       "Support this project" link).

## 2. The tablist: names, state, and arrow-key navigation

1. [ ] Continue tabbing (or jump to the tablist via landmarks/headings) until
       you reach the tab buttons. **Expect to hear** something like "Search,
       tab, selected, 1 of 3" (exact wording varies by screen reader) — the
       tab's name, its role, and that it's currently selected.
2. [ ] Press the Right Arrow key. **Expect:** focus and selection both move
       to the next tab, announced as "Browse, tab, selected, 2 of 3", and
       the panel content below visibly/audibly changes to Browse's content.
       You should **not** need to press Tab or Enter to activate it — moving
       with arrow keys should select it immediately (this is the "automatic
       activation" tabs pattern).
3. [ ] Press Right Arrow again: "Interest Profiler, tab, selected, 3 of 3".
4. [ ] Press Right Arrow once more: focus should **wrap around** back to
       "Search, tab, selected, 1 of 3", not stop or move focus elsewhere.
5. [ ] Press Left Arrow from Search: wraps the other way, to "Interest
       Profiler".
6. [ ] Press Home: jumps straight to "Search". Press End: jumps straight to
       "Interest Profiler".
7. [ ] With a tab selected, press Tab (not an arrow key) once. Focus should
       leave the tablist and land inside that tab's panel content (you may
       land on the panel region itself before its first control — that's
       expected; keep tabbing once more to reach the first real control,
       e.g. the search box on the Search tab).

## 3. Full Interest Profiler run, keyboard + screen reader only

Do this section without touching the mouse/trackpad at all.

1. [ ] Arrow-key to the "Interest Profiler" tab. **Expect to hear** the
       intro heading, "Find careers that fit your interests", and the
       explanatory paragraph read out as you arrow/read through it.
2. [ ] Tab to the "Short form — 30 questions" button and activate it
       (Space/Enter).
3. [ ] **Expect:** focus moves to the question text itself (not the "Back"
       button, not somewhere random) and you hear both the progress
       ("Question 1 of 30") and the question text read together as one
       unit. If your screen reader only reads part of this, note exactly
       what was cut off.
4. [ ] Tab to the first Likert option. **Expect to hear** something like
       "1, Strongly Dislike, radio button, 1 of 5" (not just "radio
       button" with no label, and not just the number with no word).
5. [ ] Use Arrow Down/Up (not Tab) to move between the five options.
       **Expect:** each move both **selects** that option and announces its
       full label ("2, Dislike, radio button, 2 of 5", etc.) — native radio
       group behavior, not custom JS, so this should "just work", but
       confirm it actually does with your screen reader running.
6. [ ] With an option selected, Tab to "Next" and activate it. **Expect:**
       focus moves to the next question, and "Question 2 of 30" plus the
       new question text is announced — the same as step 3, every time you
       advance. This is the part most likely to silently regress (a future
       change could stop moving focus to the question on each step), so
       pay attention here on every question, not just the first couple.
7. [ ] Answer through all 30 questions this way. On the last question, the
       button should read "Submit" instead of "Next" — confirm your screen
       reader announces the changed label, not the stale "Next".
8. [ ] After submitting, **expect:** a brief "Scoring your answers…" status
       is announced, then focus moves to the "Your results" heading and it
       is announced automatically (you shouldn't have to go hunting for
       where the page ended up).
9. [ ] Arrow/read through the RIASEC scores list and the matched careers
       list — confirm both are announced as proper lists with readable
       item text (a title, a code, and — for matched careers — a "Fit"
       value), not just a wall of unstructured text.
10. [ ] Reach the "Export your results" section. If export is locked,
        confirm the screen reader announces the explanation text ("Export
        your results as CSV or PDF with a one-time upgrade.") before or
        together with the "Upgrade to export" button, not the button in
        isolation with no context.
11. [ ] Tab to "Start over" and activate it. **Expect:** you're returned to
        the intro step, and focus lands somewhere sensible (not lost to the
        very top of the document/page).

Also spot-check the **Back** button mid-assessment (e.g. on question 5,
press Back twice): confirm each press announces the newly-focused, prior
question correctly (not the question you just left).

## 4. Browse: master-detail focus and announcements

1. [ ] Arrow-key to the "Browse" tab. **Expect:** "Browse careers" heading
       announced, followed by a status message like "Showing careers 1–20
       of ...".
2. [ ] Tab through the list to a career entry that has a "Bright Outlook"
       star. **Expect:** the star is announced with a real label ("Bright
       Outlook career"), not silently skipped or read as an unlabeled
       symbol.
3. [ ] Activate a career (Enter/Space on its list button). **Expect:**
       focus moves straight to that career's detail heading (its title) and
       it's announced immediately — you should not have to go looking for
       where you landed.
4. [ ] Tab to one of the section buttons (e.g. "Skills") and activate it.
       **Expect:** a brief "Loading Skills…" status is announced, then the
       loaded content (or an error message) replaces it and is
       reachable/readable.
5. [ ] Tab back to "Back to results" and activate it. **Expect:** focus
       returns to the **same list item you originally activated** (not the
       top of the list, not lost entirely) — this is the specific behavior
       `apps/extension/e2e/keyboard-nav.spec.ts` checks by DOM focus, but a
       human pass should confirm it's also announced sensibly by an actual
       screen reader (e.g. VoiceOver/NVDA say the career's name again, not
       just silently place a cursor).

## 5. Options page

1. [ ] Open the Options page fresh. **Expect:** landmarks (banner, main,
       contentinfo) present, same as the side panel.
2. [ ] Read through the "About" section. **Expect:** "Extension" and
       "Version" are announced as a proper label/value pair (a description
       list), not run-together text.
3. [ ] Reach the "Donate via Stripe" link. **Expect:** it's announced as a
       link with the text "Donate via Stripe" plus "(opens in new tab)" —
       confirm the "opens in new tab" part is actually read, since it's
       there specifically so screen reader users get that warning before
       activating it.
4. [ ] Reach the donate QR code image. **Expect:** it's announced with its
       alt text ("QR code to donate via Stripe"), not as an unlabeled
       image.

## Reporting results

For each pairing tested, note:

- Which steps passed as described.
- For any step that didn't: the exact pairing (e.g. "NVDA + Firefox"), the
  step number, and what was actually heard/happened instead.
- Anything not covered by this script that stood out as confusing or
  broken.

File findings as issues (or fix them directly if small) against
`apps/extension/src/**` — the components under test are `AppShell.tsx`,
`Tabs.tsx`, `CareerSearchPanel.tsx`, `BrowseCareersPanel.tsx`,
`CareerDetailView.tsx`, `InterestProfilerPanel.tsx`, `ExportResults.tsx`,
and `options/App.tsx`.
