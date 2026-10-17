// Plan 087 ("Remember me"): an order placed by a customer with a full session is "confirmed" for
// the seller. The server sets it (the request body can never), writes the account's per-kitchen
// code over the body's, links the order to the account and notes the order time (which keeps the
// sealed address for another 30 days).
import type { SellerOrder } from '../../shared/domain';
import type { D1Statement, Db } from './d1';

export function confirmedOrderStatements(
  db: Db,
  accountId: string,
  order: SellerOrder,
  customerCode: string,
  at: string,
): Array<D1Statement> {
  return [
    db.stmt(
      'UPDATE orders SET customer_confirmed = 1, customer_code = ? WHERE seller_id = ? AND id = ?',
      customerCode,
      order.sellerId,
      order.id,
    ),
    db.stmt(
      `INSERT OR IGNORE INTO customer_order_links (account_id, token, seller_id, created_at)
       VALUES (?, ?, ?, ?)`,
      accountId,
      order.token,
      order.sellerId,
      at,
    ),
    db.stmt(
      'UPDATE customer_accounts SET last_order_at = ?, first_name = ? WHERE id = ?',
      at,
      order.firstName,
      accountId,
    ),
  ];
}
