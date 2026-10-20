import type { ReactNode } from 'react';
import { styled } from 'styled-components';

// The pieces every Home state is built from: the header (eyebrow, title, one line, the one main
// button), a two-column body, and small labels. Muted colours, hairlines, no heavy borders.

export const Page = styled.main`
  display: flex;
  flex-direction: column;
  min-width: 0;
  font-size: 0.9375rem;
`;
const HeaderBox = styled.header`
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.size.pagePadTablet}px;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};

  @media (max-width: 52rem) {
    flex-wrap: wrap;
  }
`;
const Eyebrow = styled.p<{ $warn?: boolean; $muted?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  margin: 0;
  color: ${({ $warn, $muted, theme }) =>
    $warn ? theme.c.warn : $muted ? theme.c.muted : theme.c.atext};
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
`;
const Dot = styled.i<{ $filled: boolean }>`
  width: 0.5rem;
  height: 0.5rem;
  border: ${({ theme }) => theme.border.hairline} solid currentColor;
  border-radius: 50%;
  background: ${({ $filled }) => ($filled ? 'currentColor' : 'transparent')};
`;
const Title = styled.h1`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.25;
`;
const Line = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  flex: 1 1 14rem;
  min-width: 0;
`;
export const Sub = styled.p`
  margin: 0;
  font-size: 0.875rem;
  color: ${({ theme }) => theme.c.muted};
`;

/** The header's buttons: an optional extra (the bell) beside the main button. */
const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

export function Header({
  eyebrow,
  filled = false,
  tone,
  title,
  sub,
  action,
  extra,
}: Readonly<{
  eyebrow: string;
  filled?: boolean;
  tone?: 'warn' | 'muted';
  title: string;
  sub?: ReactNode;
  action: ReactNode;
  /** Shown beside the action (plan 112: the notify bell). */
  extra?: ReactNode;
}>) {
  return (
    <HeaderBox>
      <Line>
        <Eyebrow $warn={tone === 'warn'} $muted={tone === 'muted'}>
          <Dot $filled={filled} aria-hidden="true" />
          {eyebrow}
        </Eyebrow>
        <Title>{title}</Title>
        {sub ? <Sub>{sub}</Sub> : null}
      </Line>
      {extra ? (
        <HeaderActions>
          {extra}
          {action}
        </HeaderActions>
      ) : (
        action
      )}
    </HeaderBox>
  );
}

export const Columns = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: ${({ theme }) => theme.spacing.xxl};
  padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.size.pagePadTablet}px;

  @media (max-width: 52rem) {
    grid-template-columns: minmax(0, 1fr);
  }
`;
export const Section = styled.section`
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.size.pagePadTablet}px;
`;
export const Label = styled.h2`
  margin: 0 0 ${({ theme }) => theme.spacing.md};
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
`;
export const Aside = styled.aside`
  p {
    margin: 0 0 ${({ theme }) => theme.spacing.md};
  }
  h2 + p {
    margin-top: 0;
  }
`;
/** A "Go to …" link-style button: it changes screen, so it reads as a link. */
export const GoLink = styled.button`
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.sm};
  border: 0;
  background: transparent;
  color: ${({ theme }) => theme.c.atext};
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
`;
