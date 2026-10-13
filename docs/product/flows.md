# Main UX flows

Written 2026-10-13 (plan 070) from the routes in `src/app/AppRoutes.tsx` and the screens in `src/features/`. The diagrams are Mermaid: GitHub draws them, and `pnpm run docs` draws them in the HTML site. When a main flow changes, change its diagram in the same change (CLAUDE.md, "Docs stay current"). What happens between the screens and the server is in [architecture/sequences.md](../architecture/sequences.md). The product in one page is [overview.md](overview.md).

## Customer: from the link to the updates

The customer opens the kitchen's link (`/:slug`), in English or Indonesian. There is no account and no payment. The order is confirmed on the **Order placed** page, where one button opens WhatsApp with the order already written; the customer sends it to the seller. The private link `/o/:token` is the way back to the order, and **My orders** (`/my-orders`) lists the orders this phone has placed.

```mermaid
flowchart TD
    A["Open the kitchen link<br/>/:slug (menu home)"] --> B["See dishes<br/>/:slug/dishes"]
    B --> C["Add to basket<br/>/:slug/basket"]
    C --> D["Pickup or delivery<br/>/:slug/basket/pickup"]
    D --> E["Name and note<br/>/:slug/basket/name"]
    E --> F{"Place order"}
    F -- "menu closed or sold out" --> G["Message, change the basket"]
    G --> C
    F -- "accepted" --> H["Order placed<br/>/o/:token/placed"]
    H --> I["Send to the cook on WhatsApp"]
    I --> J["Order page<br/>/o/:token"]
    J --> K["My orders<br/>/my-orders"]
    J --> L["Updates: status, messages,<br/>push if turned on"]
    J --> M["Edit or cancel<br/>/o/:token/edit"]
    K --> J
    J --> N["Show QR at pickup<br/>/o/:token/qr"]
```

## Seller: from dishes to a finished menu

The seller works in the app at `/seller`. A menu is made in a four-step wizard (**Dishes, Details, Check, Publish**), shown as a layer over the current screen. A live menu keeps three tabs (Dishes, Details, Prices) and has no Publish step. On the cooking day the seller packs, hands over and sells; **Finish** archives the orders and closes the menu, after which a new one can be made.

```mermaid
flowchart TD
    A["Home<br/>/seller"] --> B["Dishes<br/>/seller/menu/dishes"]
    B --> C["New menu<br/>wizard opens"]
    C --> D["Details<br/>date, pickup places, delivery"]
    D --> E["Check<br/>what customers will see"]
    E --> F{"Publish"}
    F -- "now" --> G["Live"]
    F -- "ordering paused" --> G2["Live, not taking orders"]
    G2 --> G
    G --> H["Share<br/>/seller/share: link, QR, message"]
    H --> I["Orders<br/>/seller/orders"]
    I --> J["Cook list<br/>/seller/cook"]
    I --> K["Hand over<br/>/seller/hand-over"]
    I --> L["Sell on the day<br/>/seller/sell"]
    K --> M["Finish menu"]
    L --> M
    M --> N["Past weeks<br/>/seller/past-weeks"]
    N --> B
```

## Admin: kitchens and the first sign-in

The admin is the developer, a separate login (`/admin/sign-in`, first created at `/admin/setup`). The admin sees kitchens, people, devices, keys and the error log, and **never order data**. To open a kitchen, the admin adds it and invites its first owner, who then follows [invite and setup](../architecture/sequences.md#4-invite-then-setup-with-the-key).

```mermaid
flowchart TD
    A["Sign in<br/>/admin/sign-in (passkey)"] --> B["Kitchens list<br/>/admin"]
    B --> C["Add a kitchen<br/>name and slug"]
    B --> D["Open a kitchen"]
    C --> D
    D --> E["Invite an owner<br/>key shown once, 24 h"]
    D --> F["Kitchen pictures<br/>set the five images"]
    D --> G["People and devices<br/>remove, sign out everywhere"]
    D --> H["Pause or resume<br/>customers only, or full"]
    E --> I["Owner sets up at /seller/setup"]
    B --> J["Error log"]
```
