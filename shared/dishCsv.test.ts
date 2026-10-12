import { describe, expect, it } from 'vitest';
import { CSV_BOM } from './csv';
import { dishesToCsv, dishTemplateCsv, parseDishCsv } from './dishCsv';

const H = 'name_en,name_id,description_en,description_id,size,price,limit,chef,preorder,day_stock';

describe('parseDishCsv', () => {
  it('reads quotes, commas inside fields, escaped quotes and line breaks in quotes', () => {
    const text = `${H}\r\n"Fried, rice","Nasi ""goreng""","a\nb",,1 box,4.5,20,Wati,yes,\r\n`;
    const { lines } = parseDishCsv(text);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.row).toEqual({
      nameEn: 'Fried, rice',
      nameId: 'Nasi "goreng"',
      descriptionEn: 'a\nb',
      descriptionId: '',
      size: '1 box',
      priceCents: 450,
      limit: 20,
      chef: 'Wati',
      preorder: true,
    });
  });

  it('detects semicolons, drops the BOM and blank lines, and reads comma decimals', () => {
    const text = `${CSV_BOM}${H.replace(/,/g, ';')}\n\nSoto;;;;;12,5;;;;\n`;
    const { lines } = parseDishCsv(text);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.row?.priceCents).toBe(1250);
    expect(lines[0]?.row?.nameId).toBe('Soto');
    expect(lines[0]?.line).toBe(3);
  });

  it('reports a problem per row and keeps the good ones', () => {
    const text = [
      H,
      'A,,,,,abc,,,,',
      'B,,,,,5,x,,,',
      'C,,,,,5,,Nobody,,',
      'D,,,,,5,,,no,',
      'E,,,,,5,,,maybe,',
      ',,,,,5,,,,',
      'F,,,,,5,,Wati,no,10',
    ].join('\n');
    const codes = parseDishCsv(text, ['Wati']).lines.map((l) => l.problem?.code ?? 'ok');
    expect(codes).toEqual([
      'price_invalid',
      'limit_invalid',
      'unknown_chef',
      'preorder_needs_stock',
      'preorder_invalid',
      'name_required',
      'ok',
    ]);
  });

  it('refuses a file without a name_en header', () => {
    expect(parseDishCsv('a,b\n1,2').fileProblem?.code).toBe('no_header');
    expect(parseDishCsv('').fileProblem?.code).toBe('no_header');
  });
});

describe('dishesToCsv', () => {
  it('writes the import format and round-trips through the parser', () => {
    const csv = dishesToCsv(
      [
        {
          id: '1',
          name: { en: 'Soto, hot', id: 'Soto' },
          description: { en: 'x', id: 'y' },
          size: { en: '1 bowl', id: '1 bowl' },
          priceCents: 1205,
          chefId: 'w',
          preorder: false,
          dayStock: 4,
        },
      ],
      [{ id: 'w', name: 'Wati' }],
    );
    expect(csv.startsWith(`${CSV_BOM}${H}\r\n`)).toBe(true);
    const row = parseDishCsv(csv, ['Wati']).lines[0]?.row;
    expect(row).toMatchObject({
      nameEn: 'Soto, hot',
      priceCents: 1205,
      chef: 'Wati',
      preorder: false,
      dayStock: 4,
    });
  });

  it('the template has two valid example rows', () => {
    const { lines } = parseDishCsv(dishTemplateCsv());
    expect(lines.map((l) => l.problem)).toEqual([undefined, undefined]);
  });
});
