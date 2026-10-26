import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { formatCutoff, formatDay } from '../../../../shared/dates';
import type { Language } from '../../../../shared/domain';
import type { MenuView } from '../../../../shared/menusContract';
import { currentSellerSlug } from '../../../api/device/sellerContext';
import { publishMenu } from '../../../api/menus';
import { Button, Icon } from '../../../ui';
import { NotifySheet } from '../NotifySheet';
import { useMenuNotice } from '../NotifyBell';
import { ShareButtons, StatusPill } from './CardParts';
import { cardStateOf, showsButtons, type CardState } from './cardState';
import { PHONE_MENU_NS } from './i18n/register';
import { MenuLayer } from './MenuLayer';
import { ShareLayer } from './ShareLayer';
import { LiveSheet, PublishSheet } from './Sheets';
import { useLayerStack, type Layer } from './useLayerStack';

// Plan 124: the Menu card in the phone's Orders list (owner only; the app gives it only to the owner).
// It shows the menu's status and does the four things the kitchen tablet cannot do for a seller without
// WhatsApp on it: publish, send the new-menu notice, share the menu, look at the menu.

const Card = styled.section`
  display: flex;
  flex: none;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  margin: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.size.pagePadPhone}px;
  padding: ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: ${({ theme }) => theme.size.radiusSheet}px;
  background: ${({ theme }) => theme.c.surf};
`;
const Tap = styled.button`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
`;
const Top = styled.span`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};

  em {
    color: ${({ theme }) => theme.c.muted};
    font-size: ${({ theme }) => theme.type.size.sm};
    font-style: normal;
  }
  svg {
    margin-inline-start: auto;
    color: ${({ theme }) => theme.c.muted};
  }
`;
const Title = styled.strong`
  font-size: 1rem;
`;
const Sub = styled.span`
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.md};
`;
const Missing = styled(Sub)`
  color: ${({ theme }) => theme.c.warn};
`;

type Shared = Readonly<{
  view: MenuView;
  state: CardState;
  lang: Language;
  /** Share (and Notice) are offered. */
  buttons: boolean;
  onNotice: (() => void) | undefined;
  show: (what: Layer) => void;
}>;
const PhoneMenuContext = createContext<Shared | null>(null);

/**
 * The state behind the Menu card and every sheet and layer it opens. It sits at the top of the Orders
 * screen, outside the scrolling list, so an open sheet survives the list changing under it (a publish
 * turns "not live" into "live"). The card itself (PhoneMenuCard) scrolls with the list.
 */
export function PhoneMenuProvider({
  view,
  reload,
  now,
  children,
}: Readonly<{
  view: MenuView | null;
  /** Reloads the current menu after a publish. */
  reload: () => void;
  /** "Now", for tests. */
  now?: Date;
  children: ReactNode;
}>) {
  const { i18n } = useTranslation(PHONE_MENU_NS);
  const lang: Language = i18n.resolvedLanguage === 'id' ? 'id' : 'en';
  const notice = useMenuNotice();
  const layers = useLayerStack();
  const { stack, back } = layers;
  const has = (layer: Layer) => stack.includes(layer);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'generic' | 'conflict' | null>(null);
  const clock = useMemo(() => now ?? new Date(), [now]);
  const state = cardStateOf(view, clock);

  const close = back;
  const publish = useCallback(async () => {
    setBusy(true);
    setError(null);
    const result = await publishMenu(false, undefined, currentSellerSlug(), true);
    setBusy(false);
    if (!result.ok) {
      setError(result.status === 409 ? 'conflict' : 'generic');
      return;
    }
    reload();
    void notice.reload();
    layers.replaceTop('live');
  }, [reload, notice, layers]);

  const buttons = showsButtons(state);
  const canNotice = state.kind === 'live' && notice.status?.canSend === true;
  const share = () => layers.push('share');
  const openNotice = () => {
    notice.show();
    layers.push('notice');
  };
  // Back closed the notice sheet, or a send finished and closed it: keep the two in step.
  const noticeOpen = notice.open;
  const noticeClose = notice.close;
  const noticeInStack = has('notice');
  useEffect(() => {
    if (!noticeInStack && noticeOpen) noticeClose();
  }, [noticeInStack, noticeOpen, noticeClose]);
  useEffect(() => {
    if (!noticeOpen && noticeInStack) back();
  }, [noticeOpen, noticeInStack, back]);
  const onNotice = canNotice ? openNotice : undefined;
  const shared = useMemo(
    () => (view ? { view, state, lang, buttons, onNotice, show: layers.push } : null),
    [view, state, lang, buttons, onNotice, layers.push],
  );
  return (
    <PhoneMenuContext.Provider value={shared}>
      {children}
      {view && state.kind !== 'none' ? (
        <>
          {has('menu') ? (
            <MenuLayer
              view={view}
              state={state}
              lang={lang}
              onClose={close}
              onShare={buttons ? share : undefined}
              onNotice={onNotice}
            />
          ) : null}
          {has('share') ? <ShareLayer onClose={close} /> : null}
          {has('publish') ? (
            <PublishSheet
              view={view}
              lang={lang}
              busy={busy}
              error={error}
              onPublish={() => void publish()}
              onClose={close}
            />
          ) : null}
          {has('live') ? (
            <LiveSheet
              phones={notice.status?.canSend ? notice.status.phones : null}
              onShare={() => layers.replaceTop('share')}
              onNotice={openNotice}
              onClose={close}
            />
          ) : null}
          {notice.open && has('notice') && notice.status ? (
            <NotifySheet
              status={notice.status}
              saving={notice.saving}
              failed={notice.failed}
              onSend={(again) => void notice.send(again)}
              onClose={close}
              {...(now ? { now } : {})}
            />
          ) : null}
        </>
      ) : null}
    </PhoneMenuContext.Provider>
  );
}

/** The card: it goes inside the Orders list's scroller, so it scrolls away with the list. */
export function PhoneMenuCard() {
  const { t } = useTranslation(PHONE_MENU_NS);
  const shared = useContext(PhoneMenuContext);
  if (!shared || shared.state.kind === 'none') return null;
  const { view, state, lang, buttons, onNotice, show } = shared;
  const { menu } = view;
  const cutoff = formatCutoff(menu.cutoffAt, lang);
  const dishes = view.dishes.filter((dish) => dish.groupId === undefined).length;
  const title = t('card.menuFor', { date: formatDay(menu.cookingDate, lang) });
  return (
    <Card aria-label={title}>
      <Tap type="button" aria-label={t('card.open')} onClick={() => show('menu')}>
        <Top>
          <StatusPill state={state} />
          {state.kind === 'live' ? <em>{t('card.until', { when: cutoff })}</em> : null}
          <Icon name="forward" />
        </Top>
        <Title>{title}</Title>
        {state.kind === 'ready' || state.kind === 'notReady' ? (
          <Sub>
            {t('card.summary', { dishes: t('card.dishes', { count: dishes }), when: cutoff })}
          </Sub>
        ) : null}
        {state.kind === 'notReady' ? (
          <Missing>
            {t('card.finishOnTablet', {
              missing: state.missing.map((id) => t(`card.missing.${id}`)).join(' · '),
            })}
          </Missing>
        ) : null}
      </Tap>
      {state.kind === 'ready' ? (
        <Button variant="primary" fullWidth onClick={() => show('publish')}>
          {t('card.publish')}
        </Button>
      ) : null}
      {buttons ? <ShareButtons onShare={() => show('share')} onNotice={onNotice} /> : null}
    </Card>
  );
}
