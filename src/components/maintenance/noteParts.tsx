// Plan 086: Bobo and his speech bubble, shared by the short message and the admin's preview of it.
import styled, { keyframes } from 'styled-components';

const boboFloat = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-0.1875rem); }
`;

export const Bobo = styled.img`
  flex: none;
  width: 1.625rem;
  height: 1.625rem;
  object-fit: contain;
  @media (prefers-reduced-motion: no-preference) {
    animation: ${boboFloat} 3.2s ease-in-out infinite;
  }
`;
export const Bubble = styled.span`
  position: relative;
  flex: 1;
  min-width: 0;
  margin-left: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.bubble.bg};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.bubble.line};
  border-radius: ${({ theme }) => theme.radius.md};
  line-height: ${({ theme }) => theme.type.lineHeight.tight};
  overflow-wrap: anywhere;
  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: -0.3125rem;
    width: 0.5rem;
    height: 0.5rem;
    margin-top: -0.25rem;
    background: ${({ theme }) => theme.bubble.bg};
    border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.bubble.line};
    border-left: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.bubble.line};
    transform: rotate(45deg);
  }
`;

/** A still copy of the note (no cross, no timer) for the admin's preview. */
const PreviewRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.c.surf2};
  border: ${({ theme }) => theme.border.hairline} dashed ${({ theme }) => theme.c.ctrl};
  border-radius: ${({ theme }) => theme.radius.md};
  font-size: ${({ theme }) => theme.type.size.sm};
`;

export function NotePreview({ text }: Readonly<{ text: string }>) {
  return (
    <PreviewRow>
      <Bobo src="/brand/logo-icon.webp" alt="" />
      <Bubble>{text}</Bubble>
    </PreviewRow>
  );
}
