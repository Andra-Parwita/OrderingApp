import { memo } from 'react';
import { createGlobalStyle, styled } from 'styled-components';
import type { Fulfilment, SellerOrder } from '../../../shared/domain';
import { formatOrderCode } from '../../../shared/orderCode';
import { OrderQr } from '../OrderQr';
import { printAreaCss } from './printArea';
import {
  LABELS_PER_SHEET,
  chunk,
  itemText,
  truncateNote,
  type LabelPaper,
  type LabelPart,
} from './labelModel';

/** What a label says, already translated by the screen that prints it. */
export type LabelText = Readonly<{
  qrName: string;
  /** "Pickup · Sat 10 Oct" / "Delivery · Sat 10 Oct"; a private order (plan 081) is asked with its order. */
  where: (fulfilment: Fulfilment, order: SellerOrder) => string;
  /** "1 of 2"; only asked for when an order has more than one label. */
  part: (index: number, of: number) => string;
}>;

// Print sizes. A4 sheet of 2 × 7 (99 × 38 mm labels, 2 mm between columns, 5 mm side margins,
// 15.5 mm top and bottom). Roll: one 62 × 40 mm label per page.

/** Page size and "print only the labels"; mount it only while labels can be printed. */
export const LabelPrintStyle = createGlobalStyle<{ $paper: LabelPaper }>`
  @page {
    size: ${({ $paper }) => ($paper === 'a4' ? 'A4 portrait' : '62mm 40mm')};
    margin: 0;
  }
  @media print {
    ${printAreaCss}
  }
`;

const Sheet = styled.div<{ $paper: LabelPaper }>`
  display: grid;
  grid-template-columns: ${({ $paper }) => ($paper === 'a4' ? 'repeat(2, minmax(0, 1fr))' : '1fr')};
  gap: ${({ theme }) => theme.spacing.md};
  max-width: ${({ $paper }) => ($paper === 'a4' ? 'none' : '20rem')};
  margin-bottom: ${({ theme }) => theme.spacing.lg};

  /* A phone shows one label a row; print keeps the sheet. */
  @media (max-width: 40rem) {
    grid-template-columns: minmax(0, 1fr);
  }

  @media print {
    box-sizing: border-box;
    max-width: none;
    margin: 0;
    break-after: page;
    ${({ $paper }) =>
      $paper === 'a4'
        ? `width: 210mm; height: 297mm; padding: 15.5mm 5mm;
           grid-template-columns: repeat(2, 99mm); grid-auto-rows: 38mm; gap: 0 2mm;
           align-content: start;`
        : `width: 62mm; height: 40mm; padding: 0; gap: 0;`}
  }
`;

const LabelBox = styled.article<{ $paper: LabelPaper }>`
  box-sizing: border-box;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    'code qr'
    'name qr'
    'items items'
    'where where'
    'note note';
  align-content: start;
  gap: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colour.surface};
  overflow: hidden;

  @media print {
    width: ${({ $paper }) => ($paper === 'a4' ? '99mm' : '62mm')};
    height: ${({ $paper }) => ($paper === 'a4' ? '38mm' : '40mm')};
    padding: 2mm 3mm;
    gap: 0.5mm 2mm;
    border: 0;
    border-radius: 0;
    background: white;
    color: black;
    font-size: 8pt;
    line-height: 1.15;
    break-inside: avoid;
    ${({ $paper }) => ($paper === 'roll' ? 'break-after: page;' : '')}
  }
`;
const Code = styled.div`
  grid-area: code;
  font-size: ${({ theme }) => theme.type.size.xl};
  font-weight: ${({ theme }) => theme.type.weight.strong};
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
  line-height: ${({ theme }) => theme.type.lineHeight.tight};

  @media print {
    font-size: 17pt;
  }
`;
/** The QR is a vector SVG, so it scales to the box and stays crisp; it carries its own white quiet zone. */
const Qr = styled.div`
  grid-area: qr;
  width: 4.5rem;
  height: 4.5rem;
  line-height: 0;

  svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  @media print {
    width: 16mm;
    height: 16mm;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
`;
const Name = styled.div`
  grid-area: name;
  font-size: ${({ theme }) => theme.type.size.lg};
  font-weight: ${({ theme }) => theme.type.weight.strong};

  @media print {
    font-size: 11pt;
  }
`;
const Items = styled.ul`
  grid-area: items;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: ${({ theme }) => theme.type.size.sm};

  @media print {
    /* One printed line per item line, so the lines-per-label count in labelModel holds. */
    li {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
  }
`;
const Where = styled.div`
  grid-area: where;
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: ${({ theme }) => theme.type.weight.strong};

  @media print {
    white-space: nowrap;
  }
`;
const NoteLine = styled.div`
  grid-area: note;
  margin-top: ${({ theme }) => theme.spacing.xs};
  padding: 0 ${({ theme }) => theme.spacing.xs};
  background: ${({ theme }) => theme.colour.surfaceAlt};
  font-size: ${({ theme }) => theme.type.size.sm};

  @media print {
    /* Plan 104: 8 pt, space above the rule, at most two lines then an ellipsis (see noteSlots). */
    margin-top: 0.8mm;
    padding: 0.4mm 0 0;
    background: transparent;
    border-top: 0.2mm solid black;
    font-size: 8pt;
    line-height: 1.1;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
  }
`;

type LabelProps = Readonly<{ part: LabelPart; paper: LabelPaper; text: LabelText }>;

/** No chef names, address or phone: the label carries only what packing needs (D-007, D-012). */
const Label = memo(function Label({ part, paper, text }: LabelProps) {
  const { order } = part;
  const code = formatOrderCode(order.code);
  const partText = part.of > 1 ? text.part(part.index, part.of) : '';
  const where = partText
    ? `${text.where(order.fulfilment, order)} · ${partText}`
    : text.where(order.fulfilment, order);
  return (
    <LabelBox $paper={paper} aria-label={partText ? `${code} ${partText}` : code}>
      <Code>{code}</Code>
      <Qr>
        <OrderQr code={order.code} size={72} label={text.qrName} />
      </Qr>
      <Name>{order.firstName}</Name>
      <Items>
        {part.lines.map((line) => (
          <li key={line.itemId}>{itemText(line)}</li>
        ))}
      </Items>
      <Where>{where}</Where>
      {part.showNote && order.note ? <NoteLine>{truncateNote(order.note)}</NoteLine> : null}
    </LabelBox>
  );
});

/** The labels laid out in sheets: 14 to an A4 page, one per page on a roll. */
export function LabelSheets({
  parts,
  paper,
  text,
}: Readonly<{ parts: ReadonlyArray<LabelPart>; paper: LabelPaper; text: LabelText }>) {
  return chunk(parts, paper === 'a4' ? LABELS_PER_SHEET : 1).map((sheet) => (
    <Sheet key={`${sheet[0]?.order.id}-${sheet[0]?.index}`} $paper={paper}>
      {sheet.map((part) => (
        <Label key={`${part.order.id}-${part.index}`} part={part} paper={paper} text={text} />
      ))}
    </Sheet>
  ));
}
