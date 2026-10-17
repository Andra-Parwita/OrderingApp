import { styled } from 'styled-components';

// Small shared pieces of the Remember me screens: quiet text, lists, one error line.

export const Heading = styled.h3`
  margin: ${({ theme }) => theme.spacing.md} 0 ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.type.size.base};
  font-weight: 700;
`;
export const Text = styled.p`
  margin: ${({ theme }) => theme.spacing.xs} 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.md};
  line-height: 1.5;
`;
export const Ticks = styled.ul`
  margin: ${({ theme }) => theme.spacing.xs} 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.type.size.md};

  li {
    display: flex;
    gap: ${({ theme }) => theme.spacing.sm};
    align-items: flex-start;
  }
  svg {
    color: ${({ theme }) => theme.c.atext};
    margin-top: 0.125rem;
  }
`;
export const Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.lg};
`;
export const ErrorLine = styled.p`
  margin: ${({ theme }) => theme.spacing.sm} 0 0;
  color: ${({ theme }) => theme.c.danger};
  font-size: ${({ theme }) => theme.type.size.md};
`;
export const Code = styled.output`
  display: block;
  margin: ${({ theme }) => theme.spacing.md} 0;
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: 0.4em;
  text-align: center;
  font-variant-numeric: tabular-nums;
`;
