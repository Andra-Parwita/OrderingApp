# 089 · Security touch-ups from the code health report

**Status:** ✅ built and gated 17 Oct, in 1.0.38; was: building (owner, 17 Oct: "so #1, 2, 3"; and "A" for the order limit). Source: docs/reports/2026-10-17-code-health.html, top-ten list.

| # | item | state |
|---|---|---|
| 1 | Salt the IP hash used by the limiters (find my order, client log, customer phone codes): HMAC with a random daily salt kept in D1 (today + yesterday only), so "no IP stored" is literally true | building |
| 2 | Browser security headers: CSP matching what the app loads, frame-ancestors none / X-Frame-Options DENY, Referrer-Policy, nosniff, Permissions-Policy (camera, geolocation, passkeys for self) | building |
| 3 | Remove dead code: `PrintJob` (LabelSheets.tsx) and the unused cook `label.*` strings | building |
| 5 | Per-client limit on placing orders: about 5 orders per 10 minutes per kitchen per phone/network (salted key from #1); friendly "Too many orders in a short time, please wait a few minutes or message the kitchen." (EN/ID) | built: 5 per 10 min per kitchen per client (signed-in account, else salted network key; no address = no limit); counted once the request is well-formed; `too_many_orders` 429; worker/api/orderLimit.ts, mocks/orderLimit.test.ts |
