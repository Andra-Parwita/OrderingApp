import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { Button } from '../Button';
import { Icon } from '../Icon';

export type ListWithPanelProps = Readonly<{
  /** Stays above the list while the list scrolls (search, toggles, tabs). */
  listHeader?: ReactNode;
  list: ReactNode;
  /** The detail beside the list (384 px); without it the list takes the whole width. */
  panel?: ReactNode;
  /** Accessible name of the panel. */
  panelLabel: string;
  /** The one main action, pinned at the bottom of the panel. */
  panelAction?: ReactNode;
  /** Phone: the panel replaces the list (full screen with Back). The list stays mounted. */
  stacked?: boolean;
  onBack?: () => void;
}>;

// In a parent with a fixed height (flex: 1, min-height: 0) the list and the panel each scroll on
// their own; in a parent that grows with its content nothing here scrolls.
const Wrap = styled.div<{ $split: boolean }>`
  display: grid;
  flex: 1;
  grid-template-columns: ${({ $split, theme }) =>
    $split ? `minmax(0, 1fr) ${theme.size.orderPanel}px` : 'minmax(0, 1fr)'};
  grid-template-rows: minmax(0, 1fr);
  min-height: 0;
`;
const ListArea = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  &[hidden] {
    display: none;
  }
`;
const ListScroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
`;
const Panel = styled.aside<{ $stacked: boolean }>`
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  border-left: ${({ $stacked, theme }) =>
    $stacked ? '0' : `${theme.border.hairline} solid ${theme.c.line}`};
  background: ${({ theme }) => theme.c.surf};
`;
const PanelBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${({ theme }) => theme.size.pagePadTablet}px;
`;
const PanelFoot = styled.div`
  position: sticky;
  bottom: 0;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.size.pagePadTablet}px;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: ${({ theme }) => theme.c.surf};
`;
const BackBar = styled.div`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.size.pagePadPhone}px;
`;

/** Orders and order detail: the detail opens beside the list; on a phone it is a page with Back. */
export function ListWithPanel({
  listHeader,
  list,
  panel,
  panelLabel,
  panelAction,
  stacked = false,
  onBack,
}: ListWithPanelProps) {
  const { t } = useTranslation();
  const hasPanel = panel != null;
  return (
    <Wrap $split={hasPanel && !stacked}>
      <ListArea hidden={hasPanel && stacked}>
        {listHeader}
        <ListScroll>{list}</ListScroll>
      </ListArea>
      {hasPanel ? (
        <Panel aria-label={panelLabel} $stacked={stacked}>
          {stacked && onBack ? (
            <BackBar>
              <Button variant="quiet" onClick={onBack}>
                <Icon name="back" />
                {t('patterns.back')}
              </Button>
            </BackBar>
          ) : null}
          <PanelBody>{panel}</PanelBody>
          {panelAction ? <PanelFoot>{panelAction}</PanelFoot> : null}
        </Panel>
      ) : null}
    </Wrap>
  );
}
