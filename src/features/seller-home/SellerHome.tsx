import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCutoff, formatDay, localDate } from '../../../shared/dates';
import type { Language } from '../../../shared/domain';
import type { PastWeekSummary } from '../../../shared/pastWeeks';
import { Button, Icon } from '../../ui';
import { Draft } from './Draft';
import { FirstTime } from './FirstTime';
import { GoLink, Header, Page, Section } from './homeParts';
import { CookingDay, Taking } from './Live';
import { liveNumbers, timeLeft } from './liveData';
import { agoOf, homeStateOf, type LiveStage } from './homeState';
import { HOME_NS, registerSellerHomeI18n } from './i18n/register';
import { NewMenuDialog } from './NewMenuDialog';
import { PastMenuPanel } from './PastMenuPanel';
import { EarlierMenus, LastMenu, lastMenuOf, useAgoText } from './Quiet';
import type { GoTarget, HomeData, NewMenuInput, StartSource } from './types';
import { WhatsAppDialog } from './WhatsAppDialog';

// Home (plan 039): a read-only summary of where the kitchen is. One main button, top right; the
// rest opens a dialog or a panel in place. Only "Go to …" buttons change screen.

export type SellerHomeProps = Readonly<{
  data: HomeData;
  lang: Language;
  /** Creates the menu (or starts the new kitchen's first one) from the dialog's answers. */
  onStartMenu: (input: NewMenuInput) => void;
  /** The last start did not work. */
  startFailed?: boolean;
  /**
   * "Continue making it": the one place that opens the wizard at the step reached. Today it is a
   * page; plan 037 turns it into the layer over Menu.
   */
  onContinue: (wizardStep: number) => void;
  /** A "Go to …" button; Orders may come with a filter, as address parameters (`status=ordered`). */
  onGo: (target: GoTarget, search?: string) => void;
  /** "Now", for tests. */
  now?: Date;
}>;

const STARTED_KEY = 'sellerHome.started';

// A new kitchen's first menu is an untouched draft on the server even after the New menu dialog
// saved it, so "the seller started it" is remembered on this device, for that menu only.
function wasStarted(menuId: string): boolean {
  try {
    return localStorage.getItem(STARTED_KEY) === menuId;
  } catch {
    return false;
  }
}
function rememberStarted(menuId: string): void {
  try {
    localStorage.setItem(STARTED_KEY, menuId);
  } catch {
    // Private mode or blocked storage: the flag lasts until the page reloads.
  }
}

type Dialog = Readonly<{ kind: 'new'; source?: StartSource }> | Readonly<{ kind: 'whatsapp' }>;

const LIVE_EYEBROW: Readonly<Record<LiveStage, string>> = {
  taking: 'live.taking',
  paused: 'live.paused',
  closed: 'live.closed',
  cookingDay: 'live.cookingDay',
};

export function SellerHome({
  data,
  lang,
  onStartMenu,
  startFailed = false,
  onContinue,
  onGo,
  now: nowProp,
}: SellerHomeProps) {
  registerSellerHomeI18n();
  const { t } = useTranslation(HOME_NS);
  const agoText = useAgoText();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [panel, setPanel] = useState<PastWeekSummary | null>(null);
  const [started, setStarted] = useState(() => wasStarted(data.view.menu.id));
  const [whatsappSaved, setWhatsappSaved] = useState(false);

  const now = nowProp ?? new Date();
  const { view, past, sets, defaults, orders = [] } = data;
  const { menu } = view;
  const state = homeStateOf({ view, pastCount: past.length, started, now });
  const newMenu = () => setDialog({ kind: 'new' });

  const create = (input: NewMenuInput) => {
    setDialog(null);
    setStarted(true);
    rememberStarted(menu.id);
    onStartMenu(input);
  };

  const header = (() => {
    switch (state) {
      case 'noMenu':
        return (
          <Header
            eyebrow={t('firstTime.eyebrow')}
            title={t('firstTime.title')}
            sub={t('firstTime.sub')}
            action={
              <Button variant="primary" onClick={newMenu}>
                <Icon name="plus" />
                {t('firstTime.action')}
              </Button>
            }
          />
        );
      case 'draft':
        return (
          <Header
            eyebrow={t('draft.eyebrow')}
            tone="muted"
            title={t('draft.title', { date: formatDay(menu.cookingDate, lang) })}
            sub={t('draft.sub', { count: view.dishes.length })}
            action={
              <Button variant="primary" onClick={() => onContinue(menu.wizardStep)}>
                {t('draft.action')}
                <Icon name="forward" />
              </Button>
            }
          />
        );
      case 'quiet': {
        const { finishedAt } = lastMenuOf(menu, past);
        return (
          <Header
            eyebrow={t('quiet.eyebrow')}
            tone="muted"
            title={t('quiet.title')}
            sub={t('quiet.sub', { when: agoText(agoOf(finishedAt, now)) })}
            action={
              <Button variant="primary" onClick={newMenu}>
                <Icon name="plus" />
                {t('quiet.newMenu')}
              </Button>
            }
          />
        );
      }
      default: {
        const stage = state;
        const toKitchen = stage === 'closed' || stage === 'cookingDay';
        const numbers = liveNumbers(orders);
        const day = formatDay(menu.cookingDate, lang);
        const cutoff = formatCutoff(menu.cutoffAt, lang);
        const first = [...view.pickupPoints].sort((a, b) =>
          a.window.start.localeCompare(b.window.start),
        )[0];
        const left = timeLeft(menu.cutoffAt, now);
        const leftText =
          left.kind === 'dh'
            ? t('live.leftDh', { days: left.days, hours: left.hours })
            : left.kind === 'hm'
              ? t('live.leftHm', { hours: left.hours, minutes: left.minutes })
              : t('live.leftM', { minutes: left.minutes });
        const sub = toKitchen
          ? [
              t('live.subClosed', { when: cutoff }),
              t('live.subCookingOrders', { count: numbers.orders }),
              first ? t('live.firstPickup', { place: first.place, time: first.window.start }) : '',
            ]
              .filter(Boolean)
              .join(' · ')
          : t('live.subTaking', { when: cutoff, left: leftText });
        const eyebrow =
          stage === 'cookingDay' && localDate(now) === menu.cookingDate
            ? t('live.cookingDayToday')
            : t(LIVE_EYEBROW[stage], { day });
        return (
          <Header
            eyebrow={eyebrow}
            filled
            tone={stage === 'paused' ? 'warn' : undefined}
            title={stage === 'cookingDay' ? day : t('live.title', { date: day })}
            sub={sub}
            action={
              <Button variant="primary" onClick={() => onGo(toKitchen ? 'kitchen' : 'orders')}>
                <Icon name={toKitchen ? 'pot' : 'list'} />
                {toKitchen
                  ? t('live.goKitchen')
                  : numbers.toConfirm > 0
                    ? t('live.goOrdersN', { count: numbers.toConfirm })
                    : t('live.goOrders')}
              </Button>
            }
          />
        );
      }
    }
  })();

  const lastWeek = state === 'quiet' ? lastMenuOf(menu, past).week : undefined;
  const earlier = past.filter((week) => week !== lastWeek);

  const body = (() => {
    switch (state) {
      case 'noMenu':
        return (
          <FirstTime
            whatsappSaved={whatsappSaved}
            menuStarted={started}
            onSetUpWhatsApp={() => setDialog({ kind: 'whatsapp' })}
            onMakeMenu={newMenu}
            onGo={onGo}
          />
        );
      case 'draft':
        return <Draft view={view} lang={lang} onGo={onGo} />;
      case 'quiet':
        return (
          <>
            <LastMenu
              menu={menu}
              past={past}
              lang={lang}
              now={now}
              onGoOrders={() => onGo('orders')}
            />
            <EarlierMenus
              weeks={earlier}
              total={past.length}
              lang={lang}
              onOpen={(week) => setPanel(week)}
              onGoMenu={() => onGo('menu')}
            />
          </>
        );
      default: {
        const live = { view, orders, lang, now, stage: state, onGo };
        const hint =
          state === 'closed' || state === 'paused' ? (
            <Section>
              {t('live.hint')} <GoLink onClick={() => onGo('menu')}>{t('live.goMenu')}</GoLink>
            </Section>
          ) : null;
        return (
          <>
            {state === 'taking' || state === 'paused' ? (
              <Taking {...live} />
            ) : (
              <CookingDay {...live} />
            )}
            {hint}
          </>
        );
      }
    }
  })();

  return (
    <Page>
      {header}
      {startFailed ? <Section role="alert">{t('startFailed')}</Section> : null}
      {body}
      {dialog?.kind === 'new' ? (
        <NewMenuDialog
          lang={lang}
          firstTime={state === 'noMenu'}
          defaults={defaults}
          past={past}
          sets={sets}
          {...(dialog.source ? { initialSource: dialog.source } : {})}
          {...(nowProp ? { now: nowProp } : {})}
          onCreate={create}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'whatsapp' ? (
        <WhatsAppDialog
          onSaved={(number) => {
            setWhatsappSaved(number !== '');
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {panel ? (
        <PastMenuPanel
          week={panel}
          lang={lang}
          onClose={() => setPanel(null)}
          onUseDishes={() => {
            setDialog({ kind: 'new', source: { kind: 'past', weekId: panel.id } });
            setPanel(null);
          }}
          onGoOrders={() => onGo('orders')}
        />
      ) : null}
    </Page>
  );
}
