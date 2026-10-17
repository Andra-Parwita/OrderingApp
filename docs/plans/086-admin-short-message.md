# 086 · Admin short message: a 30-second note everyone can see

**Status:** draft (17 Oct); timing for after 1.0.37 unless the owner says otherwise.
**Owner, 17 Oct:** "in admin we have announcement .. what if I just want to send an announcement to say everything is okay etc, or a short message that everyone can see, and it will be shown max 30 seconds and disappear?" Delivery: **A** (instant for open seller screens and customers following an order through the live connection; on the next page open for everyone else while the message is active).

## How it works
- Admin → "Short message": text (EN + ID, or one text), audience (everyone / sellers / customers), Send. No update or stop needed; optional "Stop now".
- Each message has an id and an **active window** (how long new visitors can still get it). When the window ends nobody new sees it; nothing to clear.
- On a device: a small note with Bobo slides in at the top, stays up to **30 seconds** (or until ✕), then fades. The device remembers the message id, so **reopening the app or reloading does not show it again**.
- Uses the existing live connections (seller DO socket, customer order socket) for instant delivery, and `/api/status` (or the menu/order fetch) for page opens.

## Owner rulings
- **Active window:** the admin picks each time: 15 min / 1 hour / today (until midnight in the admin's time) (owner "C", 17 Oct).
- **Who receives it:** the admin can pick kitchens (all, or specific ones), plus the audience everyone / sellers / customers (owner, 17 Oct: "if admin can pick is better").
- **In-app only:** no phone notification, ever (owner "B", 17 Oct).

## Open questions
- none left; mock-up next, build after 1.0.37.
