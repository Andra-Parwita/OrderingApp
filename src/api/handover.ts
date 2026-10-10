// Seller calls for Pickup & delivery (plan 001, stage 9): the message log, a message to a pickup
// place and the delivery steps. A call that would warn answers 409 with `warning` (D-062); send it
// again with `force: true` to go ahead. Each call ends with `(actor?, seller?)` like client.ts.
import type { StaffActor } from '../../shared/domain';
import {
  parseDeliveryStepResponse,
  parseMessagePlaceResponse,
  parseMessagesResponse,
  type DeliveryStepRequest,
  type DeliveryStepResponse,
  type MessagePlaceRequest,
  type MessagePlaceResponse,
  type MessagesResponse,
} from '../../shared/handoverContract';
import { request } from './http';
import type { ApiResult } from './http';

const enc = encodeURIComponent;

function who(actor?: StaffActor, seller?: string) {
  return { ...(actor ? { actor } : {}), ...(seller ? { seller } : {}) };
}

/** The message log of the current menu, newest first. */
export function fetchMessages(
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<MessagesResponse>> {
  return request('/api/seller/messages', parseMessagesResponse, who(actor, seller));
}

/** Reaches every open pickup order of that place; `ready_now` also marks them Ready (D-069 Q3). */
export function messagePlace(
  placeId: string,
  input: MessagePlaceRequest,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<MessagePlaceResponse>> {
  return request(`/api/seller/messages/place/${enc(placeId)}`, parseMessagePlaceResponse, {
    method: 'POST',
    body: input,
    ...who(actor, seller),
  });
}

/** Out for delivery, Arriving soon (optional minutes) or Delivered, for one order. */
export function sendDeliveryStep(
  code: string,
  input: DeliveryStepRequest,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<DeliveryStepResponse>> {
  return request(`/api/seller/orders/${enc(code)}/delivery-step`, parseDeliveryStepResponse, {
    method: 'POST',
    body: input,
    ...who(actor, seller),
  });
}
