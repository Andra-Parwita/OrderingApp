# Onde Onde theme (shared by the seller app and the customer app)

Use this for every Onde Onde screen so the seller app and the customer site look like one product. Every colour pair below has been checked to WCAG AA: text at least 4.5:1, control edges at least 3:1.

## How the theme works

- **Five colour themes**, each in light and dark: **Onde Onde** (green from the logo, the default), **Bali** (blue), **Sumatra** (red), **Sunda** (indigo), **Jawa** (brown).
- The seller picks the theme once for the whole kitchen (Seller app → Settings → Appearance). The customer site uses the same theme, so customers see the kitchen's colours.
- A theme sets the accent and tints the backgrounds. Text and status colours never change between themes.
- Light or dark: the seller chooses per device. On the customer site, follow the phone's setting (`prefers-color-scheme`).
- Pass the mode to `color-scheme` on the root so native dropdowns and date pickers match.

## Tokens

| Token | What it is for |
| --- | --- |
| `bg` | Page background |
| `panel` | Side panel, bottom bar |
| `surf` / `surf2` | Sheets and cards / raised rows, inputs |
| `line` | 1px hairlines |
| `kbg` | Area behind the banner when no background picture is set |
| `fill` / `on` | Main button background / text on it (one filled button per screen) |
| `atext` | Accent text and links |
| `tint` | Selected row, selected tab, soft accent background |
| `text` / `muted` | Body text / secondary text (meta, codes, hints) |
| `ctrl` | Input and outline-button borders |
| `conf` | Confirmed, ready, done (always with an icon and a word) |
| `ready` | Out for delivery |
| `warn` / `warnTint` | Changed, warnings, not paid / its soft background |
| `danger` | Cancelled, delete |

### Accent and backgrounds per theme

| Theme | Dark fill | Light fill | Dark bg / surf | Light bg / surf |
| --- | --- | --- | --- | --- |
| Onde Onde | #8CC08A | #2F6B36 | #121411 / #181A16 | #F6F2E8 / #FFFDF8 |
| Bali | #84C3D6 | #1D5C73 | #101417 / #161B1F | #F1F4F4 / #FCFEFE |
| Sumatra | #EBA0AA | #8A2232 | #161112 / #1C1617 | #F7F0EE / #FFFBFA |
| Sunda | #A9B6EC | #3A4C96 | #111219 / #17181F | #F2F2F7 / #FDFDFF |
| Jawa | #D9AE7E | #7A4A1E | #15120E / #1B1813 | #F6F0E6 / #FFFBF4 |

The code below has every value.

## Type, size and touch

- UI font: **Plus Jakarta Sans** 400/500/600/700. Order codes: **IBM Plex Mono** 500/600, letter-spacing .06em. Use tabular figures for prices, counts and times.
- Phone sizes: screen title 26–28px/700, row name 15px/600, body 15px, meta 12–13px muted.
- Touch targets at least 44 × 44px, 8px apart; main buttons 48–56px tall.
- Radius 10px on controls, 12–16px on sheets and dialogs. Page padding 16px on phone, 24px on tablet.
- Focus: 2px ring in `fill`, 2px offset, on every control.

## Rules that carry over

- Status is always an icon plus a word, never colour alone.
- One filled (accent) button per screen; everything else is outlined or plain.
- Every label exists in English and Indonesian; leave about 30% extra width for Indonesian.
- First names only. No phone numbers or addresses stored.
- Warn, never block.
- Separate things with spacing and hairlines, not boxed cards.
- Dates are the menu's cooking date ("Sat 17 Oct"), never "this week" or a fixed weekday.

## Pictures the seller uploads

| Slot | Shape | Where the customer sees it |
| --- | --- | --- |
| Menu picture (per menu) | 3:2 | Top of the menu page |
| Phone banner | 3:1 | Header on phone |
| Wide banner | 5:1 | Header on tablet and desktop |
| Small icon | Square, 512px | Home-screen icon, browser tab |
| Background | Picture or colour | Behind the banner |

## Code (React + styled-components)

```ts
// Onde Onde seller app: colour tokens, copied from the design boards.
// All text/background pairs checked to WCAG AA (text >= 4.5:1, controls >= 3:1).
// neutral: shared by every theme. brands: the 5 colour themes, each with dark and light.

export const neutral = {
      dark: { bg:'#121411', panel:'#0E100D', surf:'#181A16', surf2:'#20231E', line:'#2A2E27', ctrl:'#6B7266', text:'#F1EEE6', muted:'#A9AFA3', kbg:'#1D2A1A', conf:'#7EC4B0', ready:'#8DB4E8', warn:'#E9B949', warnTint:'rgba(233,185,73,.10)', danger:'#EE8B78' },
      light:{ bg:'#F6F2E8', panel:'#EFEADD', surf:'#FFFDF8', surf2:'#F4F0E6', line:'#E4DED0', ctrl:'#7F857A', text:'#1C1F1A', muted:'#5D6358', kbg:'#E9E3CF', conf:'#1F6B5C', ready:'#2B5C9E', warn:'#8A5A00', warnTint:'#FBF1D9', danger:'#A93724' }
    } as const;

export const brands = {
      onde: { dark:{ fill:'#8CC08A', on:'#0F1E10', atext:'#93C590', tint:'rgba(140,192,138,.14)', bg:'#121411', panel:'#0E100D', surf:'#181A16', surf2:'#20231E', line:'#2A2E27', kbg:'#1D2A1A' }, light:{ fill:'#2F6B36', on:'#FFFFFF', atext:'#2A5F30', tint:'#E5EFE2', bg:'#F6F2E8', panel:'#EFEADD', surf:'#FFFDF8', surf2:'#F4F0E6', line:'#E4DED0', kbg:'#E9E3CF' } },
      bali: { dark:{ fill:'#84C3D6', on:'#0B2129', atext:'#8CC6D8', tint:'rgba(132,195,214,.14)', bg:'#101417', panel:'#0C1013', surf:'#161B1F', surf2:'#1E2429', line:'#283037', kbg:'#17262E' }, light:{ fill:'#1D5C73', on:'#FFFFFF', atext:'#1A5469', tint:'#E0EDF1', bg:'#F1F4F4', panel:'#E7EDEE', surf:'#FCFEFE', surf2:'#EEF3F4', line:'#DAE2E4', kbg:'#DCE8EB' } },
      sumatra: { dark:{ fill:'#EBA0AA', on:'#2B0A10', atext:'#EDA6AF', tint:'rgba(235,160,170,.14)', bg:'#161112', panel:'#110D0E', surf:'#1C1617', surf2:'#251D1F', line:'#322729', kbg:'#2A171B' }, light:{ fill:'#8A2232', on:'#FFFFFF', atext:'#7E1F2E', tint:'#F5E1E3', bg:'#F7F0EE', panel:'#F0E6E3', surf:'#FFFBFA', surf2:'#F6EEEC', line:'#E6D9D6', kbg:'#EED9D6' } },
      sunda: { dark:{ fill:'#A9B6EC', on:'#121A3A', atext:'#AEBBEE', tint:'rgba(169,182,236,.15)', bg:'#111219', panel:'#0D0E14', surf:'#17181F', surf2:'#1F2029', line:'#2A2C37', kbg:'#1A1D33' }, light:{ fill:'#3A4C96', on:'#FFFFFF', atext:'#34448A', tint:'#E4E7F4', bg:'#F2F2F7', panel:'#E9EAF2', surf:'#FDFDFF', surf2:'#F0F1F7', line:'#DDDFEA', kbg:'#DFE2F1' } },
      jawa: { dark:{ fill:'#D9AE7E', on:'#2A1A08', atext:'#DDB38A', tint:'rgba(217,174,126,.15)', bg:'#15120E', panel:'#100E0B', surf:'#1B1813', surf2:'#24201A', line:'#312B23', kbg:'#2A2015' }, light:{ fill:'#7A4A1E', on:'#FFFFFF', atext:'#6E431B', tint:'#F2E7DA', bg:'#F6F0E6', panel:'#EEE5D7', surf:'#FFFBF4', surf2:'#F5EEE2', line:'#E5DACA', kbg:'#EBDCC4' } }
    } as const;

export type Mode = keyof typeof neutral;          // 'dark' | 'light'
export type Brand = keyof typeof brands;          // 'onde' | 'bali' | 'sumatra' | 'sunda' | 'jawa'

/** Brand values override the neutral bg/panel/surf/surf2/line/kbg, so each theme tints its own backgrounds. */
export function makeColors(brand: Brand, mode: Mode) {
  return { ...neutral[mode], ...brands[brand][mode] };
}
export type Colors = ReturnType<typeof makeColors>;

export const font = {
  ui: "'Plus Jakarta Sans', system-ui, sans-serif",   // 400/500/600/700
  mono: "'IBM Plex Mono', ui-monospace, monospace",   // 500/600, letter-spacing .06em, order codes and keys
};

export const size = {
  tap: 44,            // minimum touch target, px
  mainAction: 48,     // 48 to 56 tall
  rowCompact: 48,     // Kitchen, menus
  rowOrder: 56,       // two-line order rows (56 to 64)
  radiusControl: 10,
  radiusSheet: 16,
  orderPanel: 384,
  slideOver: 560,
  navOpen: 232,
  navCollapsed: 72,
  pagePadTablet: 24,
  pagePadPhone: 16,
};

// styled-components: <ThemeProvider theme={{ c: makeColors(brand, mode), font, size, mode }}>
// and pass mode to `color-scheme` on the root so native selects match.
```
