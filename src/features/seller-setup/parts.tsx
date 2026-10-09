import { styled } from 'styled-components';

// Shared look of the three setup screens: tokens only, spacing and hairlines, no heavy borders.

export const Page = styled.main`
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  max-width: min(100%, 45rem);
  margin: 0 auto;
`;
export const Title = styled.h1`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.lg}
    ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.type.size.lg};
  line-height: ${({ theme }) => theme.type.lineHeight.tight};
`;
export const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg}
    ${({ theme }) => theme.spacing.xxl};
`;
export const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding-top: ${({ theme }) => theme.spacing.md};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
`;
export const SectionTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.base};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
export const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.md};

  & > * {
    flex: 1 1 8rem;
  }
`;
export const Hint = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.sm};
  color: ${({ theme }) => theme.colour.textMuted};
`;
export const Failure = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.status.cancelled.fg};
`;
export const Centered = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.colour.textMuted};
`;
export const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
`;
