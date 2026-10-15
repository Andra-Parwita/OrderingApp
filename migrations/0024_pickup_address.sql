-- 0024_pickup_address.sql: plan 076. A saved pickup place may carry an address and a map pin.
-- Add-only; all three are NULL for places without one (lat and lng together, bounds checked by the Worker).
ALTER TABLE pickup_places ADD COLUMN address TEXT;
ALTER TABLE pickup_places ADD COLUMN lat REAL;
ALTER TABLE pickup_places ADD COLUMN lng REAL;
