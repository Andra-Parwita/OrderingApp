-- 0018_order_address.sql: plan 071 stage 1 (D-099). A delivery address is kept ENCRYPTED on the order
-- ("iv.ciphertext", both base64, AES-GCM with the ADDRESS_KEY secret) and set to NULL a day after the
-- menu finishes, when the order is cancelled, or when the team deletes it. Add-only; NULL = no address.
ALTER TABLE orders ADD COLUMN address_enc TEXT;
