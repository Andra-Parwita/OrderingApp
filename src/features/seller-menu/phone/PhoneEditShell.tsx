import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { LayerBar, LayerShell } from '../../../components/layer/LayerShell';
import { Icon, IconButton } from '../../../ui';
import { MENU_NS } from '../i18n/register';
import { PhoneFooterSlot } from './PhoneWizardShell';

// Plan 134: editing a live menu on the phone: the whole screen, above the menu it was opened from.
// A bar (Close, "Editing menu · date"), the three tabs, the amber "Edit mode" band, the screen of the
// tab scrolling to its last field, and the Save footer pinned. The tablet's version is EditSheet.

const Tabs = styled.nav`
  display: grid;
  flex: none;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const Tab = styled.button<{ $current: boolean }>`
  min-width: 0;
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: ${({ theme }) => theme.spacing.xs};
  border: 0;
  border-bottom: ${({ theme }) => theme.border.tab} solid
    ${({ $current, theme }) => ($current ? theme.c.fill : 'transparent')};
  background: transparent;
  color: ${({ $current, theme }) => ($current ? theme.c.text : theme.c.muted)};
  font: inherit;
  font-size: 0.875rem;
  font-weight: ${({ $current }) => ($current ? 700 : 500)};
  text-align: center;
  cursor: pointer;
  overflow-wrap: anywhere;
`;
const Band = styled.div`
  flex: none;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.size.pagePadPhone}px;
  background: ${({ theme }) => theme.c.warnTint};
  color: ${({ theme }) => theme.c.text};
  font-size: 0.875rem;
`;
const Scroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
`;
/** A step's footer chip (Dishes: "On this menu N") sits here, just above the Save footer. */
const Chips = styled.div`
  display: flex;
  flex: none;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.size.pagePadPhone}px;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};

  &:empty {
    display: none;
  }
`;

export type EditTab = Readonly<{ name: string; label: string; current: boolean }>;

export function PhoneEditShell({
  title,
  band,
  tabs,
  onTab,
  onClose,
  footer,
  floating,
  children,
}: Readonly<{
  title: string;
  band: string;
  tabs: ReadonlyArray<EditTab>;
  onTab: (name: string) => void;
  onClose: () => void;
  footer: ReactNode;
  /** Dialogs and editors: they sit inside the layer (a layer is its own stacking context). */
  floating: ReactNode;
  children: ReactNode;
}>) {
  const { t } = useTranslation(MENU_NS);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  // Each tab starts at its top.
  const scroll = useRef<HTMLDivElement>(null);
  const current = tabs.find((tab) => tab.current)?.name;
  useEffect(() => {
    scroll.current?.scrollTo?.({ top: 0 });
  }, [current]);
  return (
    <PhoneFooterSlot.Provider value={slot}>
      <LayerShell label={t('session.layer')} onClose={onClose}>
        <LayerBar>
          <IconButton label={t('close')} onClick={onClose}>
            <Icon name="x" />
          </IconButton>
          <h2>{title}</h2>
          <span />
        </LayerBar>
        <Tabs aria-label={t('make.tabs')}>
          {tabs.map((tab) => (
            <Tab
              key={tab.name}
              type="button"
              $current={tab.current}
              aria-current={tab.current ? 'page' : undefined}
              onClick={() => onTab(tab.name)}
            >
              {tab.label}
            </Tab>
          ))}
        </Tabs>
        <Band>{band}</Band>
        <Scroll ref={scroll}>{children}</Scroll>
        <Chips ref={setSlot} />
        {footer}
        {floating}
      </LayerShell>
    </PhoneFooterSlot.Provider>
  );
}
