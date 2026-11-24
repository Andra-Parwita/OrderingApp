import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useInRouterContext, useLocation, useNavigate } from 'react-router';
import { styled } from 'styled-components';
import { formatCutoff, formatDay } from '../../../../shared/dates';
import type { Language } from '../../../../shared/domain';
import type { MenuView } from '../../../../shared/menusContract';
import { currentSellerSlug } from '../../../api/device/sellerContext';
import { publishMenu } from '../../../api/menus';
import { Button, Icon } from '../../../ui';
import { NoticeAsk } from '../NoticeAsk';
import { NotifySheet } from '../NotifySheet';
import { useMenuNotice } from '../NotifyBell';
import type { MenuSlots } from '../slots';
import { stepPath } from '../steps';
import { ShareButtons, StatusPill } from './CardParts';
import { cardStateOf, showsButtons, type CardState } from './cardState';
import { PHONE_MENU_NS } from './i18n/register';
import { MenuLayer } from './MenuLayer';
import { PhoneNewMenu } from './PhoneNewMenu';
import { ShareLayer } from './ShareLayer';
import { LiveSheet, PublishSheet } from './Sheets';
import { useLayerStack, type Layer } from './useLayerStack';
import { firstStepState, onWizardClosed } from './wizardNav';

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
  /** Plan 134: "+ New menu" is offered (the app gave the New menu dialog). */
  canStart: boolean;
  /** Plan 134: starting a menu did not get through. */
  startFailed: boolean;
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
  canEditDays = true,
  newMenu,
  children,
}: Readonly<{
  view: MenuView | null;
  /** Reloads the current menu after a publish. */
  reload: () => void;
  /** "Now", for tests. */
  now?: Date;
  /** Plan 127: the owner may change the delivery days from the menu view (the app mounts this only for the owner). */
  canEditDays?: boolean;
  /** Plan 134: the New menu dialog (a slot of the app); without it the card offers no "+ New menu". */
  newMenu?: MenuSlots['newMenu'];
  children: ReactNode;
}>) {
  const { i18n } = useTranslation(PHONE_MENU_NS);
  const lang: Language = i18n.resolvedLanguage === 'id' ? 'id' : 'en';
  const notice = useMenuNotice();
  const layers = useLayerStack({ belowWizard: true });
  const { stack, back } = layers;
  const has = (layer: Layer) => stack.includes(layer);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'generic' | 'conflict' | null>(null);
  // Plan 133: the send was tried from the question just now (so an old failure is not shown there).
  const [askTried, setAskTried] = useState(false);
  // Plan 134: the New menu pieces load the menu bundle, so they mount on the first tap of "+ New menu".
  const [newMenuUsed, setNewMenuUsed] = useState(false);
  const [startFailed, setStartFailed] = useState(false);
  const clock = useMemo(() => now ?? new Date(), [now]);
  // A publish or a Save in the wizard shows on the card (and in the menu layer) when it closes.
  useEffect(() => onWizardClosed(reload), [reload]);
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
    // Plan 133: always ask, right after a publish; closing it leaves the "Menu is live" sheet.
    setAskTried(false);
    layers.push('ask');
  }, [reload, notice, layers, setAskTried]);

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
  const { push } = layers;
  const show = useCallback(
    (what: Layer) => {
      if (what === 'newMenu') setNewMenuUsed(true);
      push(what);
    },
    [push],
  );
  const canStart = newMenu !== undefined;
  // Plan 134: "Edit menu" opens the edit sheet over Orders (it needs the router; the card tests have none).
  const Layer = useInRouterContext() && canStart ? MenuLayerWithEdit : MenuLayer;
  const shared = useMemo(
    () => (view ? { view, state, lang, buttons, onNotice, show, canStart, startFailed } : null),
    [view, state, lang, buttons, onNotice, show, canStart, startFailed],
  );
  return (
    <PhoneMenuContext.Provider value={shared}>
      {children}
      {newMenu && newMenuUsed ? (
        <PhoneNewMenu
          open={has('newMenu')}
          render={newMenu}
          onClose={close}
          onFailed={setStartFailed}
        />
      ) : null}
      {view && state.kind !== 'none' ? (
        <>
          {has('menu') ? (
            <Layer
              view={view}
              state={state}
              lang={lang}
              canEditDays={canEditDays}
              reload={reload}
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
          {has('live') && !has('ask') ? (
            <LiveSheet
              phones={notice.status?.canSend ? notice.status.phones : null}
              onShare={() => layers.replaceTop('share')}
              onNotice={openNotice}
              onClose={close}
            />
          ) : null}
          {has('ask') ? (
            <NoticeAsk
              layout="sheet"
              saving={notice.saving}
              failed={askTried && notice.failed}
              onSend={() => {
                setAskTried(true);
                void notice.send(notice.needsAgain).then((sent) => sent && close());
              }}
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

/** The read-only menu with its Edit menu button (plan 134): the edit sheet opens over Orders. */
function MenuLayerWithEdit(props: ComponentProps<typeof MenuLayer>) {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <MenuLayer
      {...props}
      onEdit={() => void navigate(stepPath('edit', 'dishes'), { state: firstStepState(location) })}
    />
  );
}

/** The card: it goes inside the Orders list's scroller, so it scrolls away with the list. */
export function PhoneMenuCard() {
  const { t } = useTranslation(PHONE_MENU_NS);
  const shared = useContext(PhoneMenuContext);
  if (!shared) return null;
  const { view, state, lang, buttons, onNotice, show, canStart, startFailed } = shared;
  // Plan 134: no menu open (or the last one finished): the card starts the next one.
  const noMenu = state.kind === 'none' || (state.kind === 'closed' && state.finished);
  const newMenu =
    canStart && noMenu ? (
      <>
        <Button
          variant={state.kind === 'none' ? 'primary' : 'secondary'}
          fullWidth
          onClick={() => show('newMenu')}
        >
          <Icon name="plus" />
          {t('card.newMenu')}
        </Button>
        {startFailed ? <Missing role="alert">{t('card.startFailed')}</Missing> : null}
      </>
    ) : null;
  if (state.kind === 'none') {
    return newMenu ? (
      <Card aria-label={t('card.noMenu')}>
        <Title>{t('card.noMenu')}</Title>
        <Sub>{t('card.noMenuHint')}</Sub>
        {newMenu}
      </Card>
    ) : null;
  }
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
            {t('card.stillNeeded', {
              missing: state.missing.map((id) => t(`card.missing.${id}`)).join(' · '),
            })}
          </Missing>
        ) : null}
      </Tap>
      {state.kind === 'notReady' && canStart ? (
        <ContinueButton step={state.missing.includes('noDishes') ? 'dishes' : 'details'} />
      ) : null}
      {state.kind === 'ready' ? (
        <Button variant="primary" fullWidth onClick={() => show('publish')}>
          {t('card.publish')}
        </Button>
      ) : null}
      {newMenu}
      {buttons ? <ShareButtons onShare={() => show('share')} onNotice={onNotice} /> : null}
    </Card>
  );
}

/** Plan 134: Continue opens the wizard at the first step that needs work. */
function ContinueButton({ step }: Readonly<{ step: 'dishes' | 'details' }>) {
  const { t } = useTranslation(PHONE_MENU_NS);
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <Button
      variant="primary"
      fullWidth
      onClick={() => void navigate(stepPath('make', step), { state: firstStepState(location) })}
    >
      {t('card.continue')}
    </Button>
  );
}
