import { useCallback, useState, type ReactNode } from 'react';
import { styled } from 'styled-components';

export type TooltipProps = Readonly<{
  /** The short text to show; without it the children are rendered as they are. */
  text?: string;
  children: ReactNode;
}>;

const Wrap = styled.span`
  position: relative;
  display: block;
`;
const Bubble = styled.span`
  position: absolute;
  z-index: 5;
  top: 50%;
  left: calc(100% + ${({ theme }) => theme.spacing.sm});
  transform: translateY(-50%);
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.outline};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colour.surface};
  color: ${({ theme }) => theme.colour.text};
  font-size: ${({ theme }) => theme.type.size.sm};
  white-space: nowrap;
  pointer-events: none;
`;

/**
 * A label that shows beside its child on hover and on keyboard focus. The child must already have
 * its own accessible name: the bubble is a visual extra and is hidden from screen readers.
 */
export function Tooltip({ text, children }: TooltipProps) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const enter = useCallback(() => {
    setHover(true);
    setDismissed(false);
  }, []);
  const leave = useCallback(() => setHover(false), []);
  const focusIn = useCallback(() => {
    setFocus(true);
    setDismissed(false);
  }, []);
  const focusOut = useCallback(() => setFocus(false), []);
  const onKeyDown = useCallback((event: { key: string }) => {
    if (event.key === 'Escape') setDismissed(true);
  }, []);
  if (text === undefined) return <>{children}</>;
  return (
    <Wrap
      onMouseEnter={enter}
      onMouseLeave={leave}
      onFocus={focusIn}
      onBlur={focusOut}
      onKeyDown={onKeyDown}
    >
      {children}
      {(hover || focus) && !dismissed ? <Bubble aria-hidden="true">{text}</Bubble> : null}
    </Wrap>
  );
}
