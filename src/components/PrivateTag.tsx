import { styled } from 'styled-components';

// Plan 081: the small "Private" mark where private orders mix with menu orders (Cook, Pack, Orders).
const Tag = styled.span`
  display: inline-block;
  padding: 0 ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.c.tint};
  color: ${({ theme }) => theme.c.atext};
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.25rem;
  white-space: nowrap;
`;

export function PrivateTag({ label }: Readonly<{ label: string }>) {
  return <Tag>{label}</Tag>;
}
