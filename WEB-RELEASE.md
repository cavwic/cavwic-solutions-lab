# Web edition 1.6.0-web.1

The actual web application now follows the stable desktop 1.6.0 interface. This release updates the tool itself, not just the personal-site listing.

## Synchronized interface

- Blue-gray light/dark palettes, system theme default and saved language/theme preferences.
- Two header rows: brand/history/language/theme, then model channels and Skills.
- Project actions below the title; sticky title/metrics and responsive five-stage navigation.
- Inline local, authorized-plan, API and hybrid model controls.
- Shared Skills upload, public GitHub installation, review and enable controls.
- Original project schema, identifiers and storage keys remain compatible.

## Browser boundaries

Native Codex sign-in requires the desktop app. The web app does not read desktop credentials or launch local processes. Model calls obey CORS/local-network permissions and use only the selected channel. Keys are separated by channel, cleared when editing service endpoints and excluded from project exports. Connection tests do not send project content.

Browser cleanup preserves project originals and downloaded copies. It never substitutes permanent deletion for the system Recycle Bin.

Skills use a separate IndexedDB database, default to disabled and are limited to 64 records. Archives and downloads have byte, count, timeout and path limits. Scripts remain inert. Imported guidance is not action authorization and does not override verified source facts.

## Verification

- Astro check: no errors or warnings; informational hints remain.
- Vitest: 20 files, 291 tests passed.
- Static build completed for `/cavwic-solutions-lab/`.
- Browser acceptance used a separate localhost origin, without changing existing user projects.
- Checked Chinese/English, light/dark, and widths 320, 390, 760 and 1280 pixels. Root type remains 17px, without viewport-scaled typography.
- Verified project edit/reload, undo/redo, five-stage navigation, cleanup scope, synthetic local model list/generation test, Skill upload/default-disabled state/enable/reload, and anonymous public GitHub Skill directory installation.
- No real account credentials, customer files or paid model calls were used. Live provider entitlements are not claimed as verified.
- The optional Playwright workflow suite was updated for inline model controls but was not executed in this acceptance. Interactive checks used the desktop browser-control tooling.
