# 002 · Web push notifications

**Status:** replaced by [plan 004](004-customer-redesign-and-push.md) (2026-10-10; builder chose one plan for the customer redesign and web push).
**Goal:** a customer who turns on updates gets a notification on their phone for every message and status change on their order, even with the app closed.

## Scope (to detail)

- Service worker and web app manifest (Home Screen install, needed for push on iPhone).
- VAPID keys (Cloudflare secrets in production, `.dev.vars` locally).
- Customer "Turn on updates" (asks permission only after the tap); subscriptions stored per order or device, never per phone number.
- The Worker sends a push for: pickup place messages, delivery steps, status changes, the seller's own text. Sends in batches; drops expired subscriptions.
- Today every "Turn on updates" button is a disabled "Coming soon".

## Stages

To be written after plan 001.
