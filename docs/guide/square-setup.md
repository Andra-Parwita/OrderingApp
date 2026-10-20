# Square: one-time setup (the owner)

For [plan 111](../plans/111-square-payments.md), stage 0. Done **once**, by the owner, in the owner's own Square account. It creates "ShaggyBobo's Order" as an app that kitchens can connect to. It costs nothing and moves no money.

## 1 · Create the app
1. Open **https://developer.squareup.com** and sign in with your Square account (the same login as the Square Dashboard).
2. **Applications → +** (Create an application). Name: **ShaggyBobo's Order**. No template.
3. Open the app. At the top you can switch between **Sandbox** (practice) and **Production** (real). Do steps 2–4 below in **both**.

## 2 · Note the two IDs
On **Credentials**:
- **Application ID** (starts with `sq0idp-` in Production, `sandbox-sq0idb-` in Sandbox): **not secret**. Send it to the builder.
- **Application secret** (on the **OAuth** page, "Show"): **secret**. Never send it in a message, email or chat. The builder sets it straight into Cloudflare from their own terminal while you read it out, or you type it yourself:

  ```bash
  pnpm exec wrangler secret put SQUARE_APP_SECRET
  ```

## Our app's IDs (not secret, set up 20 Oct 2026)
- Production Application ID: `sq0idp-ygH58ICxRVqfKzkW8a0aiw`
- Sandbox Application ID: `sandbox-sq0idb-NVYkkxxg6kM9Cx5NjmdoIw`

## 3 · Where Square sends people back
On the **OAuth** page, **Redirect URL** (Production and Sandbox):

```
https://order.shaggybobo.app/api/square/oauth/callback
```

## 4 · The stall handoff return address
On the **Point of Sale API** page, **Web callback URL** (Production):

```
https://order.shaggybobo.app/seller/sell/square-return
```

It must match exactly, including `https` and no slash at the end.

## 5 · For the stall test (stage 0)
- One phone (iPhone or Android) with the **Square Point of Sale** app installed and signed in to a **real** Square account (yours, or a kitchen's), with **Tap to Pay** turned on or a Square Reader paired.
- The test uses the **cash** option for A$1.00, so no card is charged.
- Square's practice mode (Sandbox) cannot test the stall handoff; it can test "Connect Square" and online links later.

## What we never do
- No ShaggyBobo fee: each kitchen's money and Square fees stay in its own Square account (1.6% in person, 2.2% online, Square's AU prices on 20 Oct 2026).
- No card details ever reach our app or database.
