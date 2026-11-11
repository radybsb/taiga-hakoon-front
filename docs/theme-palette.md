# Modern palette alignment

The canonical light and dark palettes are in `app/themes/taiga/palette.scss`. `variables.scss` imports them to provide compile-time colors for existing Sass functions. Both runtime theme blocks emit CSS variables from that same palette.

## Changed Sass colors

| Variable | Previous | Current |
|---|---|---|
| `$primary` | `#25a28c` | `#4e56d9` |
| `$primary-75` | `#5cbaa9` | `#7a80e3` |
| `$primary-50` | `#92d1c5` | `#a7abec` |
| `$primary-25` | `#c9e8e2` | `#d3d5f6` |
| `$primary-10` | `#e9f6f3` | `#eeedff` |
| `$secondary` | `#a7cb23` | `#535bdc` |
| `$secondary-75` | `#bdd65a` | `#7e84e5` |
| `$secondary-50` | `#d3e391` | `#a9adee` |
| `$secondary-25` | `#e9f1c8` | `#d4d6f6` |
| `$tertiary` | `#c6c6d4` | `#dce3ee` |
| `$grey-02` | `#f9f9fb` | `#f4f6fa` |
| `$grey-05` | `#f1f1f4` | `#edf1f7` |
| `$grey-10` | `#e2e3e9` | `#e5eaf3` |
| `$grey-20` | `#c6c6d4` | `#dce3ee` |
| `$grey-30` | `#a9aabc` | `#b9bfca` |
| `$grey-40` | `#8d8ea5` | `#8a95a7` |
| `$grey-50` | `#70728f` | `#637189` |
| `$grey-60` | `#5a5b72` | `#536179` |
| `$grey-70` | `#434456` | `#3d4a61` |
| `$grey-80` | `#2d2d39` | `#243047` |
| `$grey-90` | `#16171d` | `#172033` |
| `$blackish` | `#16171d` | `#172033` |
| `$grayer` | `#434456` | `#3d4a61` |
| `$gray` | `#5a5b72` | `#536179` |
| `$gray-light` | `#70728f` | `#637189` |
| `$gray-lighter` | `#a9aabc` | `#b9bfca` |
| `$whitish` | `#e2e3e9` | `#e5eaf3` |
| `$mass-white` | `#f1f1f4` | `#edf1f7` |
| `$primary-light` | `#5cbaa9` | `#7a80e3` |
| `$primary-lighter` | `#e9f6f3` | `#eeedff` |
| `$primary-dark` | `#92d1c5` | `#444bc2` |
| `$primary-background` | `#c9e8e2` | `#eeedff` |
| `$secondary-light` | `#d3e391` | `#a9adee` |
| `$secondary-dark` | `#91b011` | `#444bc2` |
| `$card` | `#fff8e4` | `#fff` |
| `$card-hover` | `#f1e8cd` | `#edf1f7` |
| `$card-dark` | `#cfc29b` | `#dce3ee` |
| `$top-icon-color` | `#11241f` | `#172033` |
| `$dropdown-color` | `#16171d` | `#161a22` |
| `$highlight` | `#e5f390` | `#eeedff` |
| `$color-solid-primary` | `#83eede` | `#a7abec` |
| `$color-link-primary` | `#008aa8` | `#4e56d9` |
| `$color-link-tertiary` | `#70728f` | `#637189` |
| `$color-gray100` | `#f9f9fb` | `#f4f6fa` |
| `$color-gray200` | `#eceff4` | `#edf1f7` |
| `$color-gray300` | `#e5e9f0` | `#e5eaf3` |
| `$color-gray400` | `#d8dee9` | `#dce3ee` |
| `$color-gray800` | `#505c74` | `#637189` |
| `$color-black600` | `#4c566a` | `#637189` |
| `$color-black700` | `#434c5e` | `#536179` |
| `$color-black800` | `#3b4252` | `#3d4a61` |
| `$color-black900` | `#2e3440` | `#243047` |
| `$default-tags` | `#a9aabc` | `#b9bfca` |
| `$loading-color-1` | `#a8e440` | `#d3d5f6` |
| `$loading-color-2` | `#e4ce40` | `#a7abec` |
| `$loading-color-3` | `#e47c40` | `#7a80e3` |
| `$loading-color-4` | `#e44057` | `#535bdc` |
| `$loading-color-5` | `#4056e4` | `#444bc2` |

## Shared controls

- Base page backgrounds, body text and native control color scheme follow light/dark appearance.
- Primary and legacy action buttons use saturated purple fills, white text and darker hover fills.
- Secondary buttons, transparent/menu buttons, inputs, selects, textareas, placeholders and default popovers use semantic appearance tokens.
- Legacy gray filled buttons use white text and a darker hover to retain contrast.
- Generic headings and secondary links use appearance-aware foreground colors.
- Existing primary-action overrides reference the new CSS tokens instead of repeating hex values.
- New primary action tokens: `--workspace-button-primary` = `#535bdc`, `--workspace-button-primary-hover` = `#444bc2`, `--workspace-button-primary-text` = `#ffffff`, in both modes.
- Existing runtime accent values remain `#4e56d9` in light mode and `#b2b5ff` in dark mode. Existing surface, text and border roles retain their modern-theme values.

## Preserved colors and scope

Error, warning, success and status colors, user-configured issue/task/tag colors, external Tribe branding and code syntax colors are preserved. Explicit custom popover colors remain intact.

Static Sass aliases are modern light-palette fallbacks. Runtime appearance changes require CSS variables: this update migrates shared primitives rather than rewriting every screen-specific selector. Existing modern screen overrides remain in place.

## Files

- `app/themes/taiga/palette.scss`: new canonical palettes and CSS-variable emitter.
- `app/themes/taiga/variables.scss`: remapped aliases, shades, neutral/card colors and loading colors.
- `app/styles/shame/zz-modern-workspace.scss`: shared palette includes and semantic primary-action colors.
- `app/styles/components/buttons.scss` and `buttons-next.scss`: theme-aware control colors and readable legacy button text.
- `app/styles/core/base.scss`, `forms.scss`, `typography.scss`: shared defaults for page, native controls, forms, headings and links.
- `app/styles/dependencies/mixins/popover.scss`: theme-aware defaults while preserving custom color arguments.
- `scripts/test-theme-palette.cjs`: alias, light/dark token, state preservation, contrast and custom popover checks.

## Validation

Run `node scripts/test-theme-palette.cjs`. Semantic text and primary-action contrast must be at least 4.5:1. Compile the complete stylesheet set to verify existing Sass color functions.
