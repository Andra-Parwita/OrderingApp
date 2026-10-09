/** An item read from a pasted WhatsApp post; the seller checks it before it becomes a menu item. */
export type DraftItem = {
  nameId: string;
  descriptionId?: string;
  sizeId?: string;
  priceCents: number;
};

export type ParsedPost = { items: Array<DraftItem>; unparsedLines: Array<string> };

// "1." or "1)", the text, a dash / en dash / em dash / colon, then "$12", "$12.50" or "$12,5".
const LINE = /^\s*\d{1,2}[.)]\s*(.+?)\s*[-–—:]\s*A?\$\s*(\d+(?:[.,]\d{1,2})?)\s*$/;
const UNIT = '(?:biji|pcs|pieces|potong|gr|g|kg|ml)';
const TRAILING_SIZE = new RegExp(`(?:^|[\\s,])(\\d+(?:[.,]\\d+)?\\s*${UNIT})\\s*$`, 'i');
const WHOLE_SIZE = new RegExp(`^\\d+(?:[.,]\\d+)?\\s*${UNIT}$`, 'i');

function priceToCents(text: string): number {
  const [whole = '0', fraction = ''] = text.split(/[.,]/);
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

function tidy(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/^[\s,;]+|[\s,;]+$/g, '');
}

function parseLine(text: string): DraftItem | null {
  const match = LINE.exec(text);
  const body = match?.[1];
  const price = match?.[2];
  if (body === undefined || price === undefined) return null;

  // Parentheses are the description; one that is only a size ("(4 biji)") is the size.
  const notes: Array<string> = [];
  let size: string | undefined;
  let name = body.replace(/\(([^()]*)\)/g, (_, inside: string) => {
    const note = tidy(inside);
    if (note === '') return ' ';
    if (size === undefined && WHOLE_SIZE.test(note)) size = note;
    else notes.push(note);
    return ' ';
  });
  name = tidy(name);

  const trailing = TRAILING_SIZE.exec(name);
  const found = trailing?.[1];
  if (size === undefined && found !== undefined && trailing) {
    size = tidy(found);
    name = tidy(name.slice(0, trailing.index));
  }
  if (name === '') return null;
  return {
    nameId: name,
    ...(notes.length > 0 ? { descriptionId: notes.join('; ') } : {}),
    ...(size !== undefined ? { sizeId: size } : {}),
    priceCents: priceToCents(price),
  };
}

/**
 * Reads a numbered WhatsApp menu post (D-027): "1. Name (description), 4 biji – $12.50".
 * Lines that are not an item (greeting, closing, blank-ish text) are returned as unparsedLines;
 * empty lines are ignored.
 */
export function parseWhatsAppPost(text: string): ParsedPost {
  const items: Array<DraftItem> = [];
  const unparsedLines: Array<string> = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '') continue;
    const item = parseLine(line);
    if (item) items.push(item);
    else unparsedLines.push(line);
  }
  return { items, unparsedLines };
}
