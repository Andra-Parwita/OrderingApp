import { memo, useCallback, type KeyboardEvent, type ReactNode } from 'react';
import { styled } from 'styled-components';

export type TableColumn = Readonly<{
  id: string;
  header: string;
  /** Any CSS width; leave out to size the column to its content. "100%" takes the rest. */
  width?: string;
  align?: 'start' | 'end';
}>;

export type TableProps = Readonly<{
  /** Accessible name of the table. */
  label: string;
  columns: ReadonlyArray<TableColumn>;
  children: ReactNode;
}>;

const Root = styled.table`
  width: 100%;
  table-layout: auto;
  border-collapse: collapse;
`;
const Th = styled.th<{ $end: boolean }>`
  height: ${({ theme }) => theme.minTapTarget};
  padding: 0 ${({ theme }) => theme.spacing.md};
  border-bottom: ${({ theme }) => theme.border.hairline} solid
    ${({ theme }) => theme.colour.outline};
  color: ${({ theme }) => theme.colour.textMuted};
  font-weight: ${({ theme }) => theme.type.weight.strong};
  text-align: ${({ $end }) => ($end ? 'right' : 'left')};
  white-space: nowrap;
`;

export function Table({ label, columns, children }: TableProps) {
  return (
    <Root aria-label={label}>
      <colgroup>
        {columns.map((column) => (
          <col key={column.id} style={column.width ? { width: column.width } : undefined} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {columns.map((column) => (
            <Th key={column.id} scope="col" $end={column.align === 'end'}>
              {column.header}
            </Th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </Root>
  );
}

export type TableRowProps = Readonly<{
  /** Identifies the row to the caller, e.g. to return focus to it. */
  rowId: string;
  selected?: boolean;
  onOpen: (rowId: string) => void;
  children: ReactNode;
}>;

const Tr = styled.tr<{ $selected: boolean }>`
  cursor: pointer;
  background: ${({ theme, $selected }) => ($selected ? theme.colour.surfaceAlt : 'transparent')};
  box-shadow: ${({ theme, $selected }) =>
    $selected ? `inset ${theme.border.focus} 0 0 ${theme.colour.accent}` : 'none'};

  &:hover {
    background: ${({ theme }) => theme.colour.surfaceAlt};
  }
  &:focus-visible {
    outline-offset: -${({ theme }) => theme.border.focus};
  }
  /* The full text of a cut-off cell, on hover and on keyboard focus. */
  &:hover td[data-full]::after,
  &:focus-visible td[data-full]::after {
    display: block;
  }
`;

/** A row you can open with a click or Enter. */
export const TableRow = memo(function TableRow({
  rowId,
  selected = false,
  onOpen,
  children,
}: TableRowProps) {
  const open = useCallback(() => onOpen(rowId), [onOpen, rowId]);
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTableRowElement>) => {
      if (event.key !== 'Enter' || event.target !== event.currentTarget) return;
      event.preventDefault();
      onOpen(rowId);
    },
    [onOpen, rowId],
  );
  return (
    <Tr
      tabIndex={0}
      data-row-id={rowId}
      aria-current={selected ? 'true' : undefined}
      $selected={selected}
      onClick={open}
      onKeyDown={onKeyDown}
    >
      {children}
    </Tr>
  );
});

export type TableCellProps = Readonly<{
  align?: 'start' | 'end';
  strong?: boolean;
  /** One line with an ellipsis; the full text shows on hover and focus. Use in the one column that takes the rest. */
  fullText?: string;
  /** Let a long value wrap instead of widening the column; the default is one line. */
  wrap?: boolean;
  /** With `wrap`: the narrowest the column may get before the value breaks; default 8rem. */
  minWidth?: string;
  /** With `wrap`: also break inside a long word, for text such as names that has no spaces. */
  breakWords?: boolean;
  children: ReactNode;
}>;

const Td = styled.td<{
  $end: boolean;
  $strong: boolean;
  $wrap: boolean;
  $minWidth: string;
  $anywhere: boolean;
}>`
  position: relative;
  height: 3.5rem;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-bottom: ${({ theme }) => theme.border.hairline} solid
    ${({ theme }) => theme.colour.hairline};
  text-align: ${({ $end }) => ($end ? 'right' : 'left')};
  font-weight: ${({ theme, $strong }) =>
    $strong ? theme.type.weight.strong : theme.type.weight.regular};
  white-space: ${({ $wrap }) => ($wrap ? 'normal' : 'nowrap')};
  /* Breaks at spaces; only a name too long for its column is broken inside a word. */
  overflow-wrap: ${({ $wrap, $anywhere }) => ($wrap && !$anywhere ? 'break-word' : 'anywhere')};
  /* A value allowed to wrap still gets a readable column before it breaks. */
  min-width: ${({ $wrap, $minWidth }) => ($wrap ? $minWidth : '0')};

  /* A cut-off cell asks for no width of its own, so every other column keeps its full text. */
  &[data-full] {
    max-width: 0;
  }
  &[data-full]::after {
    content: attr(data-full);
    display: none;
    position: absolute;
    z-index: 2;
    top: 100%;
    left: ${({ theme }) => theme.spacing.md};
    width: max-content;
    max-width: 28rem;
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.outline};
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colour.surface};
    color: ${({ theme }) => theme.colour.text};
    font-weight: ${({ theme }) => theme.type.weight.regular};
    white-space: normal;
    pointer-events: none;
  }
`;
const Clip = styled.span`
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export function TableCell({
  align = 'start',
  strong = false,
  fullText,
  wrap = false,
  minWidth = '8rem',
  breakWords = false,
  children,
}: TableCellProps) {
  return (
    <Td
      $end={align === 'end'}
      $strong={strong}
      $wrap={wrap}
      $minWidth={minWidth}
      $anywhere={breakWords}
      data-full={fullText}
    >
      {fullText !== undefined ? <Clip>{children}</Clip> : children}
    </Td>
  );
}
