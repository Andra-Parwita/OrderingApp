# 118 · Join another kitchen, switch by the kitchen name, language in Settings

**Target: 1.0.44** (with 101 + 102). **Status:** mock-up approved, building (owner, 24 Oct: "I think we can build it now, don't forget to update the help and FAQ").
**Mock-up:** https://claude.ai/artifact/FjbpAF2wEXN3n2wYTQWsVt (private; delete it after the build, owner).
**Source:** Rina (DellaVee seller) will join Onde Onde. Inside an installed seller app there is no address bar, so she cannot open `/seller/setup` to enter an invite key.

## Rulings (owner, 24 Oct)
- **Join in Settings:** "I think in settings to join is good." One button **Join another kitchen** under **Add a device** in Settings → Devices (tablet pane and the phone's Your devices). It opens a sheet: invite key (paste) → **Join**. After Join the app opens the new kitchen (today's `SellerSetupRoute` behaviour for a signed-in person).
- **Switch by the kitchen name:** "on top of left menu under the logo, the kitchen name has an arrow … while in left main menu just ability to switch easily." The kitchen name under the logo becomes a button with a ▾; tapping opens a short list of the person's kitchens (name · role, ✓ on the active one); tapping one switches (today's switch + clean reload). On phones the same button sits at the top of More. **Only with 2 or more kitchens;** with one kitchen the name is plain text, no arrow ("if there is only one seller on left menu, it does not have a switch or arrow"). The old "Kitchen" dropdown under the name goes.
- **Language only in Settings:** "move the language switcher from left menu and simply leave it at the settings page only." The EN/ID switch leaves the rail and More; Settings gets a **Language** row (English / Bahasa Indonesia) under Appearance.

**Phones unchanged (owner, 24 Oct 13:10):** "join it only in tablet for now .. let's not make more change for phone seller." So the phone seller app stays as in 1.0.43: More keeps its kitchen select and its EN/ID language row; Your devices gets no Join button. Tablet only: name switcher ▾, Join in Settings → Devices, Language row in Settings, no EN/ID in the rail.

## Stages
| # | what | proof |
|---|---|---|
| 1 | Join sheet + button in Devices (tablet + phone), reusing the setup key field, `signInWithKey`, error and "Checking…" states | unit: join success opens the kitchen; wrong key shows the error |
| 2 | Kitchen-name switcher in the rail and at the top of More; hidden with one kitchen; old KitchenSwitcher select removed | unit: 1 kitchen = plain name; 2 = menu, switch calls the existing switch |
| 3 | Language row in Settings; rail and More language switches removed | unit: row changes the language |
| 4 | Help (EN/ID): gettingStarted "join another kitchen" steps (Settings → Devices → Join another kitchen), switching by the name, language in Settings | help text present in both languages |

New texts: "Join another kitchen" / "Gabung dapur lain", "Language" / "Bahasa". No FAQ exists in the app (only Help). No migration, no route change.
