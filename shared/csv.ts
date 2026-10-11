import type { DaySaleEntry } from './daySalesContract';
import type { SellerOrder } from './domain';
import { formatOrderCode } from './orderCode';
import { orderTotalCents } from './pastWeeks';

/** Lets Excel read the file as UTF-8. */
export const CSV_BOM = '﻿';

/**
 * One CSV field: quoted when it holds a comma, quote or line break (quotes doubled); a leading
 * = + - @ gets an apostrophe so a spreadsheet never runs a customer's text as a formula.
 */
export function csvField(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export const ORDERS_CSV_HEADER = [
  'code',
  'first name',
  'items',
  'total',
  'status',
  'paid',
  'pickup/delivery',
  'created',
] as const;

/** Orders as CSV (UTF-8 with BOM, CRLF lines): "2 x Name; 1 x Name" and the total as 27.50. */
export function ordersToCsv(orders: ReadonlyArray<SellerOrder>): string {
  const rows = orders.map((order) => {
    const cents = orderTotalCents(order);
    return [
      formatOrderCode(order.code),
      order.firstName,
      order.lines.map((line) => `${String(line.qty)} x ${line.name.en || line.name.id}`).join('; '),
      `${String(Math.floor(cents / 100))}.${String(cents % 100).padStart(2, '0')}`,
      order.status,
      order.paid ? 'yes' : 'no',
      order.fulfilment,
      order.createdAt,
    ].map(csvField);
  });
  const lines = [[...ORDERS_CSV_HEADER].map(csvField), ...rows].map((row) => row.join(','));
  return `${CSV_BOM}${lines.join('\r\n')}\r\n`;
}

export const DAY_SALES_CSV_HEADER = [
  'time',
  'type',
  'dish',
  'person',
  'change',
  'stock after',
  'undone',
] as const;

/** The day's sales log as CSV (same encoding as the orders file): one row per log entry, oldest first. */
export function daySalesToCsv(
  entries: ReadonlyArray<DaySaleEntry>,
  dishName: (itemId: string) => string,
): string {
  const rows = [...entries].reverse().map((entry) => [
    csvField(entry.at),
    csvField(entry.kind),
    csvField(dishName(entry.itemId)),
    csvField(entry.by),
    // Numbers are written as they are: a minus sign is not a formula here.
    String(entry.change),
    String(entry.stockAfter),
    entry.undone ? 'yes' : 'no',
  ]);
  const lines = [[...DAY_SALES_CSV_HEADER].map(csvField), ...rows].map((row) => row.join(','));
  return `${CSV_BOM}${lines.join('\r\n')}\r\n`;
}
