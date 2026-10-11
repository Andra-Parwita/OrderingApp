// Seller calls for selling on the day (plan 029): sale, set count, undo, and the day's log.
import {
  parseDayLogResponse,
  parseDayStockResponse,
  type DayCountRequest,
  type DayLogResponse,
  type DaySaleRequest,
  type DayStockResponse,
  type DayUndoRequest,
} from '../../shared/daySalesContract';
import { request, type ApiResult } from './http';

const post = <T>(
  path: string,
  body: unknown,
  parse: (input: unknown) => T | null,
  seller?: string,
) => request(path, parse, { method: 'POST', body, ...(seller ? { seller } : {}) });

export function fetchDayLog(seller?: string): Promise<ApiResult<DayLogResponse>> {
  return request('/api/seller/day/log', parseDayLogResponse, seller ? { seller } : {});
}

/** Takes `qty` off the day stock; `sold_out` (409) when too few are left. */
export function sellOnDay(
  body: DaySaleRequest,
  seller?: string,
): Promise<ApiResult<DayStockResponse>> {
  return post('/api/seller/day/sale', body, parseDayStockResponse, seller);
}

export function setDayCount(
  body: DayCountRequest,
  seller?: string,
): Promise<ApiResult<DayStockResponse>> {
  return post('/api/seller/day/count', body, parseDayStockResponse, seller);
}

export function undoDaySale(
  body: DayUndoRequest,
  seller?: string,
): Promise<ApiResult<DayStockResponse>> {
  return post('/api/seller/day/undo', body, parseDayStockResponse, seller);
}
