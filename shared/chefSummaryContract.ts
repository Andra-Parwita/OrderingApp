// Plan 069: portions and income per chef for one menu. The server builds it from the order lines
// (not cancelled) and the stall sales (plan 029), grouped by each dish's chef on the menu.
import { isInt, isRecord, parseArray } from './parse';

/** One chef's line (chefId null = "Whole kitchen": dishes with no chef). */
export type ChefSummaryRow = {
  chefId: string | null;
  /** The chef's name; absent for the whole kitchen. */
  name?: string;
  /** Portions: pre-ordered and sold at the stall. */
  portions: number;
  preOrderCents: number;
  stallCents: number;
  incomeCents: number;
};

/** GET /api/seller/menus/<current|id>/chef-summary. A chef gets only her own row. */
export type ChefSummaryResponse = {
  menuId: string;
  /** Local date, YYYY-MM-DD. */
  cookingDate: string;
  rows: Array<ChefSummaryRow>;
  totalPortions: number;
  totalCents: number;
};

function parseRow(input: unknown): ChefSummaryRow | null {
  if (!isRecord(input)) return null;
  const { chefId, name, portions, preOrderCents, stallCents, incomeCents } = input;
  if (chefId !== null && typeof chefId !== 'string') return null;
  if (name !== undefined && typeof name !== 'string') return null;
  if (!isInt(portions, 0, 10_000_000) || !isInt(incomeCents, 0, 1_000_000_000_000)) return null;
  if (!isInt(preOrderCents, 0, 1_000_000_000_000) || !isInt(stallCents, 0, 1_000_000_000_000)) {
    return null;
  }
  return {
    chefId,
    ...(name !== undefined ? { name } : {}),
    portions,
    preOrderCents,
    stallCents,
    incomeCents,
  };
}

export function parseChefSummaryResponse(input: unknown): ChefSummaryResponse | null {
  if (!isRecord(input)) return null;
  const { menuId, cookingDate, totalPortions, totalCents } = input;
  const rows = parseArray(input['rows'], parseRow);
  if (typeof menuId !== 'string' || typeof cookingDate !== 'string' || !rows) return null;
  if (!isInt(totalPortions, 0, 10_000_000) || !isInt(totalCents, 0, 1_000_000_000_000)) {
    return null;
  }
  return { menuId, cookingDate, rows, totalPortions, totalCents };
}
