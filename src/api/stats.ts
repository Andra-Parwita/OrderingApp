// Plan 121 B: the admin's anonymous order counts (admin only).
import { parseStatsResponse, type StatsResponse } from '../../shared/orderStats';
import { request, type ApiResult } from './http';

export function fetchStats(): Promise<ApiResult<StatsResponse>> {
  return request('/api/admin/stats', parseStatsResponse);
}
