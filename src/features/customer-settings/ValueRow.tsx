import { styled } from 'styled-components';
import { Icon } from '../../ui';

// Plan 092 (option D): "Language   English ›". The whole row is one button; its accessible name is
// the label and the value together. The value sits right-aligned, like "Read".

const Button = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  width: 100%;
  min-height: 3.5rem;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  border: 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: transparent;
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  font-size: ${({ theme }) => theme.type.size.base};
  text-align: left;
  cursor: pointer;
`;
const Value = styled.span`
  display: inline-flex;
  align-items: center;
  flex: none;
  gap: 0.125rem;
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.md};
  white-space: nowrap;
`;

export function ValueRow({
  label,
  value,
  onOpen,
}: Readonly<{ label: string; value: string; onOpen: () => void }>) {
  return (
    <Button type="button" aria-haspopup="dialog" onClick={onOpen}>
      <span>{label}</span>
      <Value>
        {value}
        <Icon name="forward" />
      </Value>
    </Button>
  );
}
