# Concept brief: Weekly food ordering for family and friends

*Paste this into a new conversation to start planning. It reuses ideas from an event ticketing app I designed earlier. Keep it as simple as possible.*

## The idea in one paragraph

A seller (home cook) publishes a short list of food every **Wednesday**, ready for **pickup or delivery on Saturday**. Customers (family and friends, in English or Bahasa Indonesia) pick what they want and get an **order number**. They send that number to the seller by **WhatsApp**, so the seller has their phone number in their own records. Customers can change their order, and get a notification when the food is **ready for pickup**, or when it's **out for delivery and arriving soon**. **The app does not handle payment.** Customers and the seller sort that out between themselves; the seller just updates the order's status.

## How it's done today (WhatsApp)

Right now the seller posts in a community WhatsApp group:
- **One collage image** of the dishes (some labelled "sample photo"), plus a text message in Indonesian.
- The text says which Saturday they're cooking, then a **numbered list of items with prices**, and ends with "DM me at [seller's number] for questions or orders."
- Customers then send private messages to order, and the seller keeps track by hand.

**Problems this app should solve:** orders scattered across many chats, counting portions by hand, changes getting lost, and no easy way to tell everyone "your food is ready."

**Important for adoption:** keep the WhatsApp habit. The app should **generate a ready-to-share WhatsApp post**: the collage or images, the item list in the same friendly style (Indonesian and English), and an **order link**. The seller pastes it into the group just like today. Customers tap the link to order, then send their order number to the seller by WhatsApp.

### Sample menu (from a real post, for testing)

| # | Item (Indonesian) | English | Price |
|---|---|---|---|
| 1 | Nasi campur daun jeruk (lauk: ayam goreng tepung tumis cabe garam, tempe mendoan, tumis kubis) | Lime-leaf mixed rice with salt-and-chilli fried chicken, crispy tempeh and stir-fried cabbage | $15 |
| 2 | Pesmol ikan nila | Tilapia in turmeric pesmol sauce | $15 |
| 3 | Lemper ayam, 4 biji | Chicken sticky rice rolls in banana leaf, 4 pieces | $10 |
| 4 | Empek-empek kapal selam | Palembang fish cake with egg ("submarine") | $10 |
| 5 | Ayam goreng tepung tumis cabe garam, 250 gr | Salt-and-chilli battered fried chicken, 250 g | $12.50 |
| 6 | Tempe mendoan, 4 biji | Thin battered tempeh, 4 pieces | $10 |

Note the real-world details: some items are sold by pieces (4 biji) or weight (250 gr), one item is a combo with its sides listed, and prices can have cents.

## Two languages: English and Bahasa Indonesia

- **Everything is available in English and Bahasa Indonesia:** screens, buttons, statuses, notifications, the WhatsApp message and order labels.
- The app picks the language from the phone's settings, with an easy **EN / ID** switch on every screen. The choice is remembered.
- The seller enters each **menu item in both languages** (name and short description). If one is left empty, the other is shown.
- The **WhatsApp message** and **notifications** use the customer's chosen language. The seller sees which language each customer uses.
- **Labels** show the item names in both languages, so anyone packing or collecting can read them.
- Dates and days follow the language (Saturday / Sabtu). Prices stay in Australian dollars.
- Build it multilingual from the start (for example with react-i18next), so adding another language later is easy. Have a native speaker check the Indonesian wording.

## Weekly cycle

| Day | What happens |
|---|---|
| **Wednesday** | Seller publishes this week's list (up to 10 items, up to 5 images) |
| **Wed–Fri** | Customers order and can change their order until the cut-off (for example Friday night) |
| **Saturday** | Seller cooks, marks orders ready or out for delivery; customers are notified; seller marks orders collected or delivered |

## Seller

- Publish the weekly list: up to **10 items** (name, price, short description, size or quantity such as "4 pieces" or "250 g", optional portion limit) and up to **5 images** (often one collage).
- **Share to WhatsApp:** one tap creates the group post (images, item list, order link), in the seller's chosen language or both.
- Set the cut-off time, and pickup or delivery details for Saturday.
- **Reuse menus:** keep a small rotation of **4–5 saved menus** ("sets") to pick from each week, or edit last week's.
- See all orders and their statuses, and the **total of each item to cook**.
- Match a WhatsApp message to an order by its number, and save the customer's phone on the seller's own device.
- Update each order's status with one tap (see below).
- **Print order labels** to stick on each food container (see below).
- Saturday: mark orders **Ready for pickup** or **Out for delivery**, then **Collected** or **Delivered**.

## Customer

1. Opens the seller's link (or QR) and sees this week's list.
2. Chooses items and quantities, pickup or delivery, and enters their name.
3. Gets an order number (for example `K7F-2QX`) and a QR, saved on their phone ("My orders").
4. Taps **"Send to seller on WhatsApp"**, which opens a pre-filled message with the order number, items and total.
5. Can **change or cancel** the order until the cut-off.
6. Gets a notification whenever the seller updates the status: order confirmed, **ready for pickup**, **out for delivery / arriving soon**.

## Order labels and pickup

- The seller prints a **label for each order** from the app (a sheet of labels on A4 or a small label printer) and sticks it on the food container.
- Each label shows the **order number, QR code, customer's first name, items and quantities**, and pickup or delivery.
- **At pickup, the customer scans the QR on their container** with their phone. If the order is in their "My orders", they tap **Collected**; if not, the app says "This isn't your order", which catches mix-ups.
- The seller (or a helper) can also scan the label, or type the order number, to check the right container goes to the right person and mark it collected.
- **For delivery,** the driver scans the label at the door to mark it **Delivered**, and the customer is notified. "Arriving soon" can be sent by the driver with one tap when they're on the way.

## Order statuses (the seller updates them)

**Ordered → Confirmed → Ready for pickup / Out for delivery → Collected / Delivered**, or **Cancelled** at any point.

- The seller moves an order along with one tap, and the customer is notified each time.
- An optional **Paid** tick the seller can set for their own reference. The app doesn't track amounts or payment methods.

## Storage (keep it minimal)

- Only the **current week's** list, images and orders are needed day to day.
- Keep up to **4–5 saved menu sets** with their images for rotation. Nothing older.
- Old orders are deleted (or reduced to simple weekly totals) after a few weeks.
- Images are resized and compressed on upload, so storage stays tiny.

## What we learned from the ticketing app

**Order codes**
- 6 characters, capital letters and numbers only, skipping look-alikes (no O/0, I/1). Easy to read out and type.
- Typing is forgiving: lowercase, spaces and a missing dash all work, and the order opens as soon as the 6th character is typed.
- The private link for an order uses a separate long random token, so guessing a 6-character code doesn't expose someone's order. Limit how fast codes can be looked up.

**Hosting (checked September 2026, prices change)**
| Option | Cost per year | Pros | Cons |
|---|---|---|---|
| **Cloudflare free plan** (Workers, D1 database, Durable Objects for live updates, R2 for images) | A$0 | Always on, generous free limits, live updates included, fast in Australia | Technical address unless you buy a domain; no phone support |
| Cloudflare paid plan | about A$95 | Removes daily limits | Not needed at this size |
| Firebase (Google) | A$0–45 | Live updates built in, Sydney data centre | Needs a credit card; no automatic spending cap |
| Supabase | A$0 or about A$480 | Quick to build with | Free projects **pause after a week idle**, bad for a weekly app |
| Own small server | A$60–150 | Full control | Needs someone to maintain it |

Recommendation from the ticketing work: **start on the Cloudflare free plan.** A weekly app with 50 orders uses a tiny fraction of the free allowance. A custom web address adds about A$15–30 a year. Check R2's current free storage allowance for images.

**Web push notifications**
- Use standard Web Push (VAPID keys). It's free, with no third-party service needed.
- **iPhone:** push only works after the customer taps "Add to Home Screen" (iOS 16.4 or later). Show a short guide on the order page.
- Ask for notification permission only after the customer taps "Turn on updates", never on page load.
- Always keep an **in-app inbox** on the order page, so customers without notifications still see updates when they open it.
- Address notifications to the order (or the phone that saved it), never to a phone number.
- One permission on the phone covers all the customer's orders, week after week.
- On Cloudflare's free plan, one request can only make 50 outgoing calls, so send notifications to many customers in batches. Remove subscriptions that come back as expired.

**Live updates**
- The seller's order list should update instantly when an order comes in or changes. On Cloudflare this is done with a Durable Object holding a live connection to each seller device, and it's still free.

**Other lessons**
- Keep phone numbers off the cloud: the WhatsApp handoff gives the seller the number in their own phone. Let the seller save their contacts to a file and load them back.
- Destructive actions (cancel, delete) need a second tap.
- Build a **clickable prototype first**, with a button to add sample orders, before writing a spec or real code.
- Test on real phones, especially iPhone, early.

## Principles from the ticketing app

- **No phone numbers in the cloud.** The seller gets them through WhatsApp and keeps them on their own device.
- **No customer accounts.** The phone remembers the customer's orders.
- **Web app from a normal link,** optionally added to the iPhone Home Screen (needed for notifications on iPhone). No App Store.
- **Feels like a native app** on phones.
- **Bilingual:** English and Bahasa Indonesia throughout.
- **Free hosting.**
- For a proper build later: React with TypeScript, Redux Toolkit and redux-saga, open source on GitHub.

## Scale

One seller, about 10–50 orders a week, one ordering round per week.

## Questions to settle while planning

- Delivery address: collected in the app, or only by WhatsApp (to keep it off the cloud)?
- Pickup time slots, or one pickup window?
- What happens to orders the seller never confirms by the cut-off?

**Start by planning the flow and a simple clickable prototype.**
