// Seller call for plan 069: portions and income per chef for one menu.
import {
  parseChefSummaryResponse,
  type ChefSummaryResponse,
} from '../../shared/chefSummaryContract';
import { request, type ApiResult } from './http';

/** `menuId` is 'current' or a menu's id; 403 for a helper (or a chef when the kitchen turned it off). */
export function fetchChefSummary(
  menuId: string,
  seller?: string,
): Promise<ApiResult<ChefSummaryResponse>> {
  return request(
    `/api/seller/menus/${encodeURIComponent(menuId)}/chef-summary`,
    parseChefSummaryResponse,
    seller ? { seller } : {},
  );
}
