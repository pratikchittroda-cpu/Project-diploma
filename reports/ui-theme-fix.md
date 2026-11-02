# Floating tabs and appearance fixes

## Goal and state

Keep personal/company navigation floating, make tab targets and labels balanced,
and remove inconsistent card darkening while supporting persisted light/dark mode.
Implemented locally on 2026-10-06, branch `main`, base revision `9d4ac0b3`.
Uncommitted; not deployed or visually verified on a native device.

The working tree already contained substantial changes. Concurrent AI hosting,
transaction assistance and budget recommendations were preserved, not reverted.
This task did not change backend services, release flags, credentials or dependencies.

## Changes

- `navigation/SharedTabBar.js`: centred 64px floating pill, 420px width cap,
  short labels, contained Add/Close button, themed surfaces and safe-area spacing.
  Press prevention, long press, keyboard hiding and previous-tab return remain.
- `navigation/TabNavigator.js`, `navigation/CompanyTabNavigator.js`: shorter
  visible labels with the original accessible labels retained.
- `contexts/ThemeContext.js`: contrast-safe foreground/status tokens and
  mode-aware gradients; original colour swatches and storage keys remain.
- `components/GlassCard.js`: one declared themed surface on both platforms,
  caller style overrides retained, optional blur behind rather than over the surface.
- `components/account/AccountPrimitives.js`, `components/finance/FinanceUI.js`,
  `components/finance/PersonalDashboard.js`, `components/finance/HomeAIEntry.js`:
  shared mode-derived card colours instead of platform-specific tints/white text.
- `screens/personal/ThemesScreen.js`, `screens/personal/BackupRestoreScreen.js`,
  `screens/personal/PrivacyScreen.js`, `screens/personal/SecuritySettingsScreen.js`,
  `screens/company/BillingSubscriptionScreen.js`: readable accent icons/selection.
- `tests/theme-navigation-ui.test.cjs`: nine appearance/navigation regressions.
  `tests/home-ai-ui.test.cjs` and `tests/full-ui-regression.test.cjs` mocks were
  updated for the combined UI and concurrent feature imports.

Original source snapshots reproduced the light-mode defect: GlassCard used an
iOS white overlay at 0.1 versus Android at 0.85; finance cards added a dark 0.7
content tint and white text on light iOS. Those platform-only treatments are gone.

## Checks

Commands ran from the repository root on host Node v25.8.1 / npm 11.11.0.
The project pins Node 22.23.3; repeat in that environment before release.

- **UI/unit — passed:**
  `node --test tests/theme-navigation-ui.test.cjs tests/full-ui-regression.test.cjs tests/home-ai-ui.test.cjs`
  — 23/23 tests. Includes 27 catalogue themes in both modes, card parity,
  preference restoration, small-screen layout, keyboard handling and Add/Close.
  Native views are mocked; these are not screenshot/device tests.
- **Lint/source — passed:** `npm run lint` — 122 files, zero errors.
- **Whitespace — passed:** scoped `git diff --check` for this task's paths.
- **Full suite — failed at this checkpoint:** `npm test` — 278 passed, 13 failed.
  Ten failures in `tests/ai-chat-ui.test.cjs` are missing new public-config mocks;
  two in `tests/client-backend.test.cjs` are missing finance mocks; one in
  `tests/free-tier-core.test.cjs` still expects the previous disabled-chat contract.
  These concern concurrent AI changes, not a verified defect in the new tab/card styles.
- **iOS JavaScript bundle — passed:**
  `EXPO_NO_DOTENV=1 APP_VARIANT=test npx expo export --platform ios --output-dir .expo/ui-theme-export`.
  Public configuration was deliberately omitted. Expo warned that it cannot be
  released; this verifies bundling only, not a signed/native build.
- **Typecheck — not available:** no dedicated project script.
- **Native compilation, Android build, visual/device checks — not run.**

## Next action: native visual smoke check

1. Open the app's Themes & Appearance screen and select Light, then Dark.
   Inspect Home, history/reports, budgets, profiles/settings and their cards.
2. Try Cotton (pastel) and Executive (dark swatches); selected labels/icons
   should remain readable. Restart the app and verify appearance is retained.
3. On a narrow phone and a home-indicator device, check all five tabs, the pill's
   side/bottom gaps, and that the last card/action can scroll above it.
4. Open Add from History/Reports, then Close; it should return to that tab.
   Focus a text field; the pill should hide and return after keyboard dismissal.
5. The AI work owner should update its remaining mocks/contracts, then rerun
   `npm test` with the pinned Node version. Do not revert concurrent features
   merely to make old tests pass.
