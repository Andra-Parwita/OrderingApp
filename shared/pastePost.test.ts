import { describe, expect, it } from 'vitest';
import { parseWhatsAppPost } from './pastePost';

// The brief's real post (briefs/food-ordering-concept-brief.md), as a seller would paste it.
const POST = `Halo semuanya! Menu hari Sabtu 10 Oktober:

1. Nasi campur daun jeruk (lauk: ayam goreng tepung tumis cabe garam, tempe mendoan, tumis kubis) – $15
2. Pesmol ikan nila – $15
3. Lemper ayam, 4 biji – $10
4. Empek-empek kapal selam – $10
5) Ayam goreng tepung tumis cabe garam, 250 gr - $12.50
6. Tempe mendoan, 4 biji – $10

Kirim nomor pesanan ya. Terima kasih!`;

describe('parseWhatsAppPost', () => {
  it("reads the brief's six items and leaves the greeting and closing unparsed", () => {
    const { items, unparsedLines } = parseWhatsAppPost(POST);
    expect(items).toEqual([
      {
        nameId: 'Nasi campur daun jeruk',
        descriptionId: 'lauk: ayam goreng tepung tumis cabe garam, tempe mendoan, tumis kubis',
        priceCents: 1500,
      },
      { nameId: 'Pesmol ikan nila', priceCents: 1500 },
      { nameId: 'Lemper ayam', sizeId: '4 biji', priceCents: 1000 },
      { nameId: 'Empek-empek kapal selam', priceCents: 1000 },
      {
        nameId: 'Ayam goreng tepung tumis cabe garam',
        sizeId: '250 gr',
        priceCents: 1250,
      },
      { nameId: 'Tempe mendoan', sizeId: '4 biji', priceCents: 1000 },
    ]);
    expect(unparsedLines).toEqual([
      'Halo semuanya! Menu hari Sabtu 10 Oktober:',
      'Kirim nomor pesanan ya. Terima kasih!',
    ]);
  });

  it('accepts every dash variant and a colon', () => {
    for (const dash of ['-', '–', '—', ':']) {
      expect(parseWhatsAppPost(`1. Soto ayam ${dash} $14`).items).toEqual([
        { nameId: 'Soto ayam', priceCents: 1400 },
      ]);
    }
    expect(parseWhatsAppPost('1. Soto ayam-$14').items).toHaveLength(1);
  });

  it('reads prices with . or , cents, one or two digits, and an A$ prefix', () => {
    const price = (text: string) => parseWhatsAppPost(`1. X - ${text}`).items[0]?.priceCents;
    expect(price('$15')).toBe(1500);
    expect(price('$12.50')).toBe(1250);
    expect(price('$12,50')).toBe(1250);
    expect(price('$12.5')).toBe(1250);
    expect(price('$0.99')).toBe(99);
    expect(price('A$ 7')).toBe(700);
  });

  it('knows the units, case-insensitively', () => {
    for (const unit of ['biji', 'pcs', 'pieces', 'potong', 'gr', 'g', 'kg', 'ml', 'PCS']) {
      expect(parseWhatsAppPost(`1. Kue, 6 ${unit} - $9`).items[0]?.sizeId).toBe(`6 ${unit}`);
    }
    expect(parseWhatsAppPost('1. Es teh 500 ml - $5').items[0]).toEqual({
      nameId: 'Es teh',
      sizeId: '500 ml',
      priceCents: 500,
    });
    expect(parseWhatsAppPost('1. Daging 1.5 kg - $30').items[0]?.sizeId).toBe('1.5 kg');
  });

  it('does not take a number that is not followed by a unit as the size', () => {
    expect(parseWhatsAppPost('1. Nasi 2 telur - $9').items[0]).toEqual({
      nameId: 'Nasi 2 telur',
      priceCents: 900,
    });
  });

  it('puts parentheses in the description, and a size-only parenthesis in the size', () => {
    expect(parseWhatsAppPost('2. Lemper (ayam), 4 biji - $10').items[0]).toEqual({
      nameId: 'Lemper',
      descriptionId: 'ayam',
      sizeId: '4 biji',
      priceCents: 1000,
    });
    expect(parseWhatsAppPost('2. Lemper (4 biji) - $10').items[0]).toEqual({
      nameId: 'Lemper',
      sizeId: '4 biji',
      priceCents: 1000,
    });
    expect(parseWhatsAppPost('2. Nasi (pedas) (tanpa telur) - $10').items[0]?.descriptionId).toBe(
      'pedas; tanpa telur',
    );
  });

  it('reports lines it cannot read, keeps blank lines out, and handles CRLF', () => {
    const { items, unparsedLines } = parseWhatsAppPost(
      '1. Soto - $14\r\n\r\n2. Rawon - harga ditanya\r\n3. - $5\r\nSabtu ya',
    );
    expect(items.map((item) => item.nameId)).toEqual(['Soto']);
    expect(unparsedLines).toEqual(['2. Rawon - harga ditanya', '3. - $5', 'Sabtu ya']);
  });

  it('returns nothing for empty text', () => {
    expect(parseWhatsAppPost('')).toEqual({ items: [], unparsedLines: [] });
    expect(parseWhatsAppPost('  \n \n')).toEqual({ items: [], unparsedLines: [] });
  });
});
