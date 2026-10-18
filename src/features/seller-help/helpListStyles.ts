import { styled } from 'styled-components';

// The Help page body: tabs, search, topic list and the open topic (moved out of HelpScreen).
export const Main = styled.main<{ $split: boolean }>`
  box-sizing: border-box;
  max-width: 73.75rem;
  margin: 0 auto;
  padding: 1.25rem ${({ theme }) => theme.spacing.xl} 2.5rem;

  @media (max-width: 51.25rem) {
    padding: 0.875rem ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xxl};
  }
  /* Two-column layout: the page is one screen tall; only the two panes scroll. */
  ${({ $split, theme }) =>
    $split
      ? `display: flex;
  flex: 1;
  flex-direction: column;
  width: 100%;
  min-height: 0;
  padding-bottom: ${theme.spacing.md};`
      : ''}
`;
export const SearchBox = styled.div`
  position: relative;
  margin-bottom: 0.875rem;

  svg {
    position: absolute;
    left: 0.8125rem;
    top: 0.8125rem;
    width: 1.125rem;
    height: 1.125rem;
    fill: none;
    stroke: ${({ theme }) => theme.c.muted};
    stroke-width: 2;
  }
  @media print {
    display: none;
  }
`;
export const SearchInput = styled.input`
  box-sizing: border-box;
  width: 100%;
  min-height: ${({ theme }) => theme.minTapTarget};
  padding: ${({ theme }) => theme.spacing.sm} 0.875rem ${({ theme }) => theme.spacing.sm} 2.5rem;
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
  border-radius: 0.625rem;
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.text};
  font: inherit;
`;
export const Layout = styled.div<{ $split: boolean }>`
  display: grid;
  grid-template-columns: ${({ $split }) => ($split ? '21.25rem 1fr' : '1fr')};
  gap: ${({ theme }) => theme.spacing.xl};
  align-items: start;
  ${({ $split }) =>
    $split
      ? `flex: 1;
  min-height: 0;
  grid-template-rows: minmax(0, 1fr);`
      : ''}
`;
export const List = styled.ol`
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  overflow-x: hidden;
  overflow-y: auto;
  max-height: 100%;
  list-style: none;
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.c.surf};

  li + li {
    border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  }
  @media print {
    border: 0;
    li {
      break-inside: avoid;
    }
  }
`;
export const TopicButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  box-sizing: border-box;
  width: 100%;
  min-height: 3.5rem;
  padding: ${({ theme }) => theme.spacing.md} 0.875rem;
  border: 0;
  background: transparent;
  text-align: left;

  &:hover {
    background: ${({ theme }) => theme.c.surf2};
  }
  &[aria-expanded='true'] {
    background: ${({ theme }) => theme.c.tint};
  }
  @media print {
    pointer-events: none;
    break-after: avoid;
  }
`;
export const Num = styled.span`
  flex: none;
  display: grid;
  place-items: center;
  width: 1.75rem;
  height: 1.75rem;
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: 50%;
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: ${({ theme }) => theme.type.weight.strong};

  [aria-expanded='true'] > & {
    border-color: ${({ theme }) => theme.c.fill};
    background: ${({ theme }) => theme.c.fill};
    color: ${({ theme }) => theme.c.on};
  }
`;
export const Name = styled.span`
  flex: 1;
  font-weight: ${({ theme }) => theme.type.weight.strong};
  line-height: ${({ theme }) => theme.type.lineHeight.tight};
`;
export const Summary = styled.span`
  display: block;
  margin-top: 0.0625rem;
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: ${({ theme }) => theme.type.weight.regular};
`;
export const Chevron = styled.svg<{ $open: boolean }>`
  flex: none;
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: ${({ theme }) => theme.c.muted};
  stroke-width: 2;
  transform: rotate(${({ $open }) => ($open ? '90deg' : '0deg')});
  transition: transform ${({ theme }) => theme.motion.fast};

  @media print {
    display: none;
  }
`;
export const Inline = styled.div`
  padding: 0.125rem 0.875rem 0.875rem;
  background: ${({ theme }) => theme.c.surf};

  @media print {
    padding-left: 2.5rem;
  }
`;
export const Detail = styled.section`
  box-sizing: border-box;
  min-height: 0;
  max-height: 100%;
  overflow-y: auto;
  padding: 1.375rem ${({ theme }) => theme.spacing.xl};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.c.surf};

  h2 {
    margin: 0 0 ${({ theme }) => theme.spacing.xs};
    font-size: 1.25rem;
    letter-spacing: -0.01em;
  }
`;
export const TabList = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing.md};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};

  @media print {
    display: none;
  }
`;
export const TabButton = styled.button`
  min-height: ${({ theme }) => theme.minTapTarget};
  margin-bottom: calc(-1 * ${({ theme }) => theme.border.hairline});
  padding: ${({ theme }) => theme.spacing.sm} 0.125rem;
  border: 0;
  border-bottom: 0.125rem solid transparent;
  background: transparent;
  color: ${({ theme }) => theme.c.muted};
  font-weight: ${({ theme }) => theme.type.weight.strong};

  &[aria-selected='true'] {
    border-bottom-color: ${({ theme }) => theme.c.fill};
    color: ${({ theme }) => theme.c.text};
  }
`;
export const OtherTab = styled.button`
  margin: 0;
  padding: 1.125rem;
  border: 0;
  background: transparent;
  color: ${({ theme }) => theme.c.atext};
  font-weight: ${({ theme }) => theme.type.weight.strong};
  text-align: left;
`;
export const None = styled.p`
  margin: 0;
  padding: 1.125rem;
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.md};
`;
export const Foot = styled.p`
  margin: ${({ theme }) => theme.spacing.xl} 0 0;
  color: ${({ theme }) => theme.c.muted};
  font-family: ${({ theme }) => theme.font.mono};
  font-size: 0.75rem;
  text-align: center;

  @media print {
    display: none;
  }
`;
