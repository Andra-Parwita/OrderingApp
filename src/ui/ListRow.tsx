import { memo, type ReactNode } from 'react';
import { css, styled } from 'styled-components';

export type ListRowProps = Readonly<{
  primary: ReactNode;
  secondary?: ReactNode;
  trailing?: ReactNode;
  /** With `href` the row is a link, otherwise a button. */
  href?: string;
  onClick?: () => void;
}>;

const rowStyle = css`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  width: 100%;
  min-height: ${({ theme }) => theme.minTapTarget};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  border: 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid
    ${({ theme }) => theme.colour.hairline};
  background: transparent;
  color: ${({ theme }) => theme.colour.text};
  font: inherit;
  text-align: left;
  text-decoration: none;
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colour.surface};
  }
  &:focus-visible {
    outline-offset: -${({ theme }) => theme.border.focus};
  }
`;

const RowButton = styled.button`
  ${rowStyle}
`;
const RowLink = styled.a`
  ${rowStyle}
`;

const Primary = styled.span`
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
const Secondary = styled.span`
  grid-column: 1;
  font-size: ${({ theme }) => theme.type.size.sm};
  color: ${({ theme }) => theme.colour.textMuted};
`;
const Trailing = styled.span`
  grid-column: 2;
  grid-row: 1 / span 2;
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

export const ListRow = memo(function ListRow({
  primary,
  secondary,
  trailing,
  href,
  onClick,
}: ListRowProps) {
  const content = (
    <>
      <Primary>{primary}</Primary>
      {trailing ? <Trailing>{trailing}</Trailing> : null}
      {secondary ? <Secondary>{secondary}</Secondary> : null}
    </>
  );
  return href ? (
    <RowLink href={href}>{content}</RowLink>
  ) : (
    <RowButton type="button" onClick={onClick}>
      {content}
    </RowButton>
  );
});
