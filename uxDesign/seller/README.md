# Onde Onde seller app: design handoff

Read this first. It explains what is in this folder and how to turn it into React + styled-components.

## What is here

| Path | What it is | How to use it |
| --- | --- | --- |
| `docs/handoff.md` | The written spec: rules, tokens, every screen and state, decisions log, data model changes, open questions | **Source of truth.** Where a board and this doc disagree, the doc wins. |
| `screens/*.dc.html` | One file per screen (a "board") from the design canvas | **Visual reference only.** Read for layout, spacing, copy and states. Do not copy the markup into the app. |
| `screens/index.json` | Board list: size (w × h), title, which page/area each belongs to | Use it to see which boards belong together. |
| `theme/tokens.ts` | All colours (5 themes × dark/light), fonts, sizes, typed | **Copy into the app as is** and feed it to `ThemeProvider`. |

## How to read a `.dc.html` board

They are HTML with a light template layer. Everything is inline styles.

- The markup is inside `<x-dc>`. Styles that apply to the whole board are in `<helmet><style>`.
- `{{name}}` is a value computed in `renderVals()` in the `<script>` at the bottom (a `class Component extends DCLogic`). Read `renderVals()` to see what each hole means and how state changes it.
- `<sc-if value="{{x}}">` = render only when `x` is true. `<sc-for list="{{rows}}" as="r">` = map over a list.
- `data-props` on the root (or the `tweaks` object in the script) lists the **states** a board can show, e.g. `step: sign in / password / first time / create`, `state: live / not published / none`. Each option is a state you need to build.
- Colours are CSS variables: `var(--text)`, `var(--fill)`, `var(--surf)` and so on. The names match the keys in `theme/tokens.ts` one to one, so `var(--fill)` becomes `${p => p.theme.c.fill}`.
- `<svg class="i">` icons are 24-unit line icons, stroke 1.75. Swap in your icon set (Lucide matches closely); keep 18 px in rows and 20 px in nav.
- `/_blob/<id>` image URLs point to images in the design canvas (banner, phone banner, background, menu picture). In the app these are the seller's own uploads; use placeholders.
- Sample names, prices and codes are fake.

## Turning it into React + styled-components

1. **Theme first.** Copy `theme/tokens.ts`. Wrap the app:
   `<ThemeProvider theme={{ c: makeColors(brand, mode), font, size, mode }}>`.
   Set `color-scheme: ${mode}` on the root so native `<select>` menus are readable. Brand is per kitchen and mode (light / dark / auto) is per device, both from Settings · Appearance.
2. **Build the patterns once** (doc → Patterns, board `Patterns.dc.html`): app shell (collapsible left nav + banner + sheet), list + side panel, slide-over editor, settings in panes, 4-step wizard, reuse picker, warning dialog, bottom sheet (phone), toast with Undo, compose & send, empty state, pager of 20. Screens are just content inside these.
3. **Then screens**, in this order: Sign in → Orders (3 states) → Menu screen → Make a menu wizard + Dish editor → Kitchen (Cook, Pack) → Pickup & delivery → Settings → phone views.
4. **Every label in EN and ID.** Use your i18n setup; leave about 30% extra width for Indonesian.
5. **Rules that apply everywhere** (doc → Principles): 44 px minimum targets; status always icon + word, never colour alone; one filled button per screen or panel; warn, never block; first names only; no swipe-only actions; dates are the menu's cooking date, never a weekday phrase.

## Board → screen map

| Area | Boards |
| --- | --- |
| Sign in | `Signin` (Tweaks: device, step) |
| Orders (home) | `Main` (live), `Main-Finished` (cooking day over / menu not published), `Main-Empty` (first run) |
| Menu | `Menu-Home` (live / not published / none, past menus panel), `Menu-Dishes`, `Menu-Details`, `Menu-Check`, `Menu-Publish` (wizard steps 1–4), `Dish-Edit` |
| Kitchen | `Kitchen` (Cook), `Kitchen-Pack` (Pack) |
| Pickup & delivery | `Handover` |
| Settings | `Settings` (all tabs) |
| Phone | `Phone-Orders`, `Phone-Order`, `Phone-NewOrder`, `Phone-Handover`, `Phone-More` |
| Foundations | `Palette`, `Theme-Compare`, `Patterns` |

## Not designed yet

See the doc → Open questions. Mainly New order on tablet (use the phone form's fields as a slide-over) and the live Dishes panel on Orders.
