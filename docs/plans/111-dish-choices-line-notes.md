# 111 · Dish choices and a note per order line

**Status:** owner questions answered 20 Oct; mock-ups in review; plan stages not written yet. Target **1.0.43**, together with plan 112 (owner: 101 + 102 move later).
**Source:** DellaVee's "Aneka Snack Kering" ($6 a pack, 7 kinds): the customer had to type the kinds in the order note and the basket, Orders and Cook only showed "× 3".

## Goal
A dish can have **choices** (kinds sold at the dish's price). The customer picks how many of each; Orders, Cook, the kitchen print and labels count per choice. Every basket line can carry a short **note**.

## Owner rulings (20 Oct)
1. **B:** one choice list per dish, same price; plus a note per line. (A = notes only, C = full store options, both rejected for now; C belongs with the v1.1.0 store work.)
2. A choice is a **dish grouped under a parent**. A choice has only a **name (EN/ID) and a limit**. Price, size, photo, description, chef, Pre-order and Sold on the day belong to the group. A different price stays a separate dish.
3. No chef per choice in the UI for now (the choice copies the group's chef, so a later UI can show it without a migration).
4. Customer picks in a **bottom sheet** from the dish card (− / + per choice, "Add N to basket").
5. Seller makes it in the **New dish** sheet: "Choices (optional) · + Add a choice".
6. **Sold out per choice** and for the whole dish; a choice also sells out at limit 0.
7. Choice names: English + Indonesian like dishes; empty Indonesian shows English; one-language kitchens show one box.
8. Adding choices to a dish already in a published menu applies **from the next menu**; the current menu and its orders stay as they are.
9. Line note: a **pencil** beside − / + opens a bottom sheet with one text box; the note shows as one line only when there is one. The order note stays.

## Data (one migration, new empty columns only)
- `dishes.group_id`, `menu_items.group_id`: a choice row points to its parent; the parent cannot be ordered by itself.
- `order_lines.note`: the line note, same limit as the order note.

## Mock-ups
- A vs B: `uxDesign/seller/mockups/111-choices-a-vs-b.html`
- New dish with choices: `uxDesign/seller/mockups/111-new-dish-with-choices.html`
- Basket line note: `uxDesign/customer/mockups/111-basket-line-note.html`
- Menu, choice sheet, Cook, kitchen print, order detail, and plan 112 screens: `uxDesign/seller/mockups/111-112-screens.html`
