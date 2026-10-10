import type { ReactNode } from 'react';
import { styled } from 'styled-components';
import { Icon } from './Icon';

export type PageHeaderProps = Readonly<{
  title: string;
  /** Accessible name of the back button. Back shows only when both `backLabel` and `onBack` are given. */
  backLabel?: string;
  onBack?: () => void;
  /** Right-hand slot (for example a language switch). */
  trailing?: ReactNode;
  /** The page's own content shows the title: render only the back arrow (and slot), no heading. */
  titleHidden?: boolean;
}>;

const Bar = styled.header`
  position: sticky;
  top: 0;
  z-index: 5;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: calc(env(safe-area-inset-top) + ${({ theme }) => theme.spacing.xs})
    ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xs};
  background: ${({ theme }) => theme.colour.bg};
  border-bottom: ${({ theme }) => theme.border.hairline} solid
    ${({ theme }) => theme.colour.hairline};
`;

const BackButton = styled.button`
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${({ theme }) => theme.minTapTarget};
  height: ${({ theme }) => theme.minTapTarget};
  margin-left: -${({ theme }) => theme.spacing.sm};
  padding: 0;
  border: 0;
  border-radius: ${({ theme }) => theme.radius.md};
  background: transparent;
  color: ${({ theme }) => theme.colour.text};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colour.surface};
  }
`;

const Heading = styled.h1`
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.lg};
  line-height: ${({ theme }) => theme.type.lineHeight.tight};
`;

const Trailing = styled.div`
  flex: none;
  display: flex;
  align-items: center;
`;

/** The native-style top bar of a sub-page: optional back arrow, the title, an optional right slot. */
export function PageHeader({ title, backLabel, onBack, trailing, titleHidden }: PageHeaderProps) {
  return (
    <Bar>
      {onBack && backLabel ? (
        <BackButton type="button" aria-label={backLabel} onClick={onBack}>
          <Icon name="back" />
        </BackButton>
      ) : null}
      {titleHidden ? null : <Heading>{title}</Heading>}
      {trailing ? <Trailing>{trailing}</Trailing> : null}
    </Bar>
  );
}
