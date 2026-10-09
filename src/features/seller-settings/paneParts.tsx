import { styled } from 'styled-components';

// Shared look of the Settings panes: colours from `theme.c`, spacing and hairlines only.

export const PaneForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
`;
export const PaneGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;
export const Two = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
`;
export const GroupTitle = styled.h3`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.base};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
export const Muted = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.sm};
  color: ${({ theme }) => theme.c.muted};
`;
export const ErrorLine = styled.p`
  margin: 0;
  font-weight: ${({ theme }) => theme.type.weight.strong};
  color: ${({ theme }) => theme.c.danger};
`;
export const NoticeLine = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme }) => theme.c.warnTint};
  color: ${({ theme }) => theme.c.text};
`;
export const ButtonRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;
