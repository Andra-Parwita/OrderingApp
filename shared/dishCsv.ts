// Plan 050: the dish library as CSV. A small RFC-4180 reader (quotes, doubled quotes, line breaks in
// quotes), the exporter and the template. No dependency.
import { CSV_BOM, csvField } from './csv';
import {
  IMPORT_MAX_ROWS,
  importRowProblem,
  type ImportDishRow,
  type ImportProblem,
  type ImportProblemCode,
} from './menusContract';
import type { Dish } from './menusContract';

export const DISH_CSV_HEADER = [
  'name_en',
  'name_id',
  'description_en',
  'description_id',
  'size',
  'price',
  'limit',
  'chef',
  'preorder',
  'day_stock',
] as const;

/** One data line of the file: a row, or what is wrong with it. `line` counts from 1 (the header). */
export type ParsedDishLine = { line: number; row?: ImportDishRow; problem?: ImportProblem };
export type ParsedDishCsv = { lines: Array<ParsedDishLine>; fileProblem?: ImportProblem };

/** The text split into records of fields. Blank lines are dropped. */
function readRecords(
  text: string,
  delimiter: string,
): Array<{ line: number; fields: Array<string> }> {
  const records: Array<{ line: number; fields: Array<string> }> = [];
  let fields: Array<string> = [];
  let field = '';
  let quoted = false;
  let line = 1;
  let startLine = 1;
  const endRecord = () => {
    fields.push(field);
    if (fields.length > 1 || fields[0]?.trim() !== '') records.push({ line: startLine, fields });
    fields = [];
    field = '';
  };
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charAt(i);
    if (quoted) {
      if (ch === '"') {
        if (text.charAt(i + 1) === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else {
        if (ch === '\n') line += 1;
        field += ch;
      }
    } else if (ch === '"' && field === '') {
      quoted = true;
    } else if (ch === delimiter) {
      fields.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text.charAt(i + 1) === '\n') i += 1;
      endRecord();
      line += 1;
      startLine = line;
    } else field += ch;
  }
  if (field !== '' || fields.length > 0) endRecord();
  return records;
}

/** Comma or semicolon, whichever the header line uses more (outside quotes). */
function detectDelimiter(text: string): string {
  let commas = 0;
  let semicolons = 0;
  let quoted = false;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted) {
      if (ch === '\n' || ch === '\r') break;
      if (ch === ',') commas += 1;
      else if (ch === ';') semicolons += 1;
    }
  }
  return semicolons > commas ? ';' : ',';
}

const problem = (code: ImportProblemCode, message: string): ImportProblem => ({ code, message });

/** "12", "12.5", "12,50" -> cents; null when it is not a price with up to 2 decimals. */
function priceToCents(text: string): number | null {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(text.trim());
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

function wholeNumber(text: string): number | null {
  return /^\d+$/.test(text) ? Number(text) : null;
}

/**
 * Reads the file. Every data line gives a row or a problem; `cookNames` (optional) makes an unknown
 * cook a problem here too (the server checks it again). Extra columns are ignored.
 */
export function parseDishCsv(text: string, cookNames?: ReadonlyArray<string>): ParsedDishCsv {
  const body = text.startsWith(CSV_BOM) ? text.slice(1) : text;
  const records = readRecords(body, detectDelimiter(body));
  const header = records[0]?.fields.map((name) => name.trim().toLowerCase().replace(/\s+/g, '_'));
  if (!records[0] || !header?.includes('name_en')) {
    return {
      lines: [],
      fileProblem: problem(
        'no_header',
        'The first line must name the columns, starting with name_en',
      ),
    };
  }
  if (records.length - 1 > IMPORT_MAX_ROWS) {
    return {
      lines: [],
      fileProblem: problem(
        'too_many_rows',
        `At most ${String(IMPORT_MAX_ROWS)} dishes in one file`,
      ),
    };
  }
  const cooks = cookNames?.map((name) => name.trim().toLowerCase());
  const lines = records.slice(1).map(({ line, fields }): ParsedDishLine => {
    const cell = (name: string) => (fields[header.indexOf(name)] ?? '').trim();
    const fail = (p: ImportProblem): ParsedDishLine => ({ line, problem: p });
    const nameEn = cell('name_en');
    const priceText = cell('price');
    const priceCents = priceToCents(priceText);
    if (priceCents === null) {
      return fail(problem('price_invalid', `Price "${priceText}" is not a number such as 12.50`));
    }
    const limitText = cell('limit');
    const limit = limitText === '' ? undefined : wholeNumber(limitText);
    if (limit === null)
      return fail(problem('limit_invalid', `Limit "${limitText}" is not a whole number`));
    const stockText = cell('day_stock');
    const dayStock = stockText === '' ? undefined : wholeNumber(stockText);
    if (dayStock === null) {
      return fail(problem('day_stock_invalid', `day_stock "${stockText}" is not a whole number`));
    }
    const preorderText = cell('preorder').toLowerCase();
    let preorder: boolean;
    if (['', 'yes', 'y', 'true', '1', 'ya'].includes(preorderText)) preorder = true;
    else if (['no', 'n', 'false', '0', 'tidak'].includes(preorderText)) preorder = false;
    else return fail(problem('preorder_invalid', `preorder "${preorderText}" must be yes or no`));
    const chef = cell('chef');
    if (cooks && chef !== '' && !cooks.includes(chef.toLowerCase())) {
      return fail(problem('unknown_chef', `Unknown cook "${chef}"`));
    }
    const row: ImportDishRow = {
      nameEn,
      nameId: cell('name_id') || nameEn,
      descriptionEn: cell('description_en'),
      descriptionId: cell('description_id'),
      size: cell('size'),
      priceCents,
      ...(limit !== undefined ? { limit } : {}),
      chef,
      preorder,
      ...(dayStock !== undefined ? { dayStock } : {}),
    };
    const wrong = importRowProblem(row);
    return wrong ? fail(wrong) : { line, row };
  });
  return { lines };
}

const money = (cents: number) =>
  `${String(Math.floor(cents / 100))}.${String(cents % 100).padStart(2, '0')}`;

function toCsv(rows: Array<Array<string>>): string {
  const lines = [[...DISH_CSV_HEADER], ...rows].map((row) => row.map(csvField).join(','));
  return `${CSV_BOM}${lines.join('\r\n')}\r\n`;
}

/** The library as CSV (UTF-8 with BOM, CRLF), in the import format; a cook is written by name. */
export function dishesToCsv(
  dishes: ReadonlyArray<Dish>,
  cooks: ReadonlyArray<{ id: string; name: string }>,
): string {
  return toCsv(
    dishes.map((dish) => [
      dish.name.en,
      dish.name.id,
      dish.description.en,
      dish.description.id,
      dish.size.en,
      money(dish.priceCents),
      dish.limit === undefined ? '' : String(dish.limit),
      cooks.find((cook) => cook.id === dish.chefId)?.name ?? '',
      dish.preorder === false ? 'no' : 'yes',
      dish.dayStock === undefined ? '' : String(dish.dayStock),
    ]),
  );
}

/** A starter file with two example rows. */
export function dishTemplateCsv(): string {
  return toCsv([
    [
      'Fried rice',
      'Nasi goreng',
      'Egg, chicken and sambal',
      'Telur, ayam dan sambal',
      '1 box',
      '4.50',
      '20',
      '',
      'yes',
      '',
    ],
    ['Iced tea', 'Es teh', '', '', '1 cup', '1.20', '', '', 'no', '30'],
  ]);
}
