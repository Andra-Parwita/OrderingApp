import { parseCustomerOrderResponse, type CustomerOrderResponse } from '../../shared/orderContract';
import { request, type ApiResult } from './http';

/**
 * "I've collected it" (D-069 Q4): the customer's own confirmation for a pickup order. The private
 * token is the auth. Idempotent: a second call returns the order as it already is.
 */
export function markCollected(token: string): Promise<ApiResult<CustomerOrderResponse>> {
  return request(`/api/orders/${encodeURIComponent(token)}/collected`, parseCustomerOrderResponse, {
    method: 'POST',
  });
}
