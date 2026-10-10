import {
  parseCustomerOrderResponse,
  parseFindOrderResponse,
  type CustomerOrderResponse,
  type FindOrderResponse,
} from '../../shared/orderContract';
import { request, type ApiResult } from './http';

/** D-075: a lost order back by its code and first name, in one kitchen. Answers the token only. */
export function findOrder(
  slug: string,
  code: string,
  firstName: string,
): Promise<ApiResult<FindOrderResponse>> {
  return request(`/api/s/${encodeURIComponent(slug)}/orders/find`, parseFindOrderResponse, {
    method: 'POST',
    body: { code, firstName },
  });
}

/**
 * "I've collected it" (D-069 Q4): the customer's own confirmation for a pickup order. The private
 * token is the auth. Idempotent: a second call returns the order as it already is.
 */
export function markCollected(token: string): Promise<ApiResult<CustomerOrderResponse>> {
  return request(`/api/orders/${encodeURIComponent(token)}/collected`, parseCustomerOrderResponse, {
    method: 'POST',
  });
}
