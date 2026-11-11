# 129 · Make "send it on WhatsApp" impossible to miss; hide the change-or-cancel line

**Target: hotfix 1.0.46.2.** **Status:** mock-up `uxDesign/customer/mockups/129-send-on-whatsapp.html` approved (owner "A", 11 Nov), building.

## Why (owner, 11 Nov)
- "In customer app I see that order can be changed or cancelled before some time … I just want to hide the text for now." The line "You can change or cancel until <cut-off>" (customer-menu i18n `changeUntil`, `editCutoff`) shows in checkout, Order placed and the order page; the time is the menu's "Orders close" (the seller can also lock one order earlier).
- "People order but not sending WhatsApp or call, and no phone number … we need to highlight that in customer app, since seller will not be able to confirm." No phone numbers are stored in the cloud (by design), so a customer who skips the WhatsApp step can't be reached. Today Order placed even tells returning customers "sending this on WhatsApp is optional".

## What (mock-up)
1. Hide the "You can change or cancel until …" line everywhere; the Change or cancel link stays.
2. **Order placed:** title "Almost done" + "Your order is saved, but not sent yet."; an amber line: "Send it to <kitchen> on WhatsApp. She doesn't have your number, so she can only confirm your order after your message."; the green button stays; remove the "optional" line for returning customers.
3. **Order page:** while the order is still Ordered (not confirmed, WhatsApp not marked received by the seller), an amber card "Not sent to <kitchen> yet? …" with Send on WhatsApp on top.
4. **My orders:** such an order gets a small amber "⚠ Send on WhatsApp" tag.
EN/ID for all.

5. **Menu first page:** an amber card per unconfirmed order of this kitchen on this phone ("⚠ Your order K7Q-2LB isn't confirmed yet. Send it to DellaVee on WhatsApp to get it confirmed." + Send on WhatsApp); for everyone a small line under "orders close": "After ordering, send your order on WhatsApp so <kitchen> can confirm it."

## Owner rulings (11 Nov)
- "Even if customer already ordered, if it's not confirmed, we show 'send WhatsApp to get confirmation'" → reminders on the first page, the order page and My orders for every unconfirmed order on the phone (new and earlier ones); they disappear only when the seller confirms or ticks "WhatsApp received".
- **"A":** no phone number for now (keeps "no phone numbers in the cloud"); this plus hiding the change-or-cancel line as hotfix **1.0.46.2**, mock-up update first.
- **Customer change/cancel deadline (owner "A for now", 11 Nov):** "the change and cancel can only be done before 6 pm seller time the day before event" → customers may change or cancel until **the earlier of 6:00 pm (kitchen time zone) the day before the cooking day and the order cut-off**; same rule for every kitchen; the **server** refuses customer changes after it; the Change or cancel link hides after it. Seller edits unchanged. **Tomorrow:** a simple kitchen setting for that time (owner "tomorrow we can add simple setting").
- **Correction (owner, 11 Nov): fixed 6 pm, independent of the cut-off.** "Change and cancel, make it fixed at 6 pm now … for the setting the seller later can configure … it can be after or before last order" → customers may change or cancel until **6:00 pm (kitchen time) the day before the cooking day**, whether that is before or after the order cut-off (so with a 3 pm cut-off, changes stay open until 6 pm; with a 9 pm cut-off, they close at 6 pm). Replaces "the earlier of". A seller lock on one order still closes it earlier. Setting later.
- **Name check (owner "B", 11 Nov):** order ECN-VZ7 (11 Nov 17:22, customer) had the name "Bshsh". → a customer first name needs **at least 2 letters and at least one vowel (a e i o u y, any case)**; checked in the app ("Please enter your real first name." / ID) and on the server (invalid_request) for customer orders and customer edits; seller-entered names unchanged. Existing orders untouched.
- **At the button (owner "A", 11 Nov):** "when placing an order we need to make sure we show that they need to send WhatsApp, if not it will not be confirmed … more prominently" → last checkout step: an amber line right above the button, "⚠ Next you send your order on WhatsApp. Without your message, <kitchen> can't confirm it."; the button reads **"Place order & send on WhatsApp"**; after a successful place the app **opens WhatsApp at once** with the prefilled order message; coming back shows Order placed "Almost done". Mock-up frame A.
- **No phone number (owner, 11 Nov):** "it won't help if bad people just do a fake order with a fake name or fake phone, so WhatsApp is the proper confirmation needed" → no phone-number field; the WhatsApp message stays the confirmation step (it also gives the seller the real number). Keeps "no phone numbers in the cloud".
