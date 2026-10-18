import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { styled } from 'styled-components';
import { formatCutoff, formatDay, localDate } from '../../../shared/dates';
import type { Language } from '../../../shared/domain';
import { formatMoney } from '../../../shared/money';
import { viewedKitchenZone } from '../../../shared/zone';
import type { MenuDishView } from '../../../shared/menusContract';
import { Button, Icon, ListWithPanel, Segmented, WarningDialog } from '../../ui';
import { ChefMenu } from './ChefMenu';
import { MENU_NS } from './i18n/register';
import {
  GroupLabel,
  Head,
  LinkButton,
  Muted,
  Page,
  Section,
  SwitchButton,
  Title,
  Tools,
  useLang,
  useMenuData,
  useRunOp,
  dishName,
} from './menuShared';
import type { MenuData } from './menuSlice';
import { PastDetail, PastList } from './PastMenusPanel';
import type { MenuSlots } from './slots';
import { StepTabs } from './StepTabs';
import type { Step, Tab } from './steps';
import { useMenuWizard, type NewMenuSource } from './useMenuWizard';
import { useSold } from './useSold';

// The Menu screen (plan 001 stage 7; handoff, Menu screen). Three states: no active menu (Past menus
// and New menu), not published (progress and Continue) and live (the dishes, instant edits).

const HeaderLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  min-height: 2.25rem;
  padding: 0 ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.c.atext};
  font-weight: 600;
  text-decoration: none;
  &:visited {
    color: ${({ theme }) => theme.c.atext};
  }
  &:hover,
  &:focus-visible {
    text-decoration: underline;
  }
`;
const Body = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;
const Kicker = styled.p<{ $live?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  margin: 0;
  color: ${({ $live, theme }) => ($live ? theme.c.conf : theme.c.atext)};
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
`;
const Big = styled.h2`
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
`;
const Top = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
`;
const Title2 = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 ${({ theme }) => theme.spacing.md};
  min-width: 0;
`;
const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const DishRow = styled.div<{ $head?: boolean; $off?: boolean }>`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 5rem 4rem 4rem 7.5rem;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: 2.5rem;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  color: ${({ $head, $off, theme }) => ($head || $off ? theme.c.muted : theme.c.text)};
  font-variant-numeric: tabular-nums;
  font-size: ${({ $head }) => ($head ? '0.8125rem' : '0.9375rem')};
  font-weight: ${({ $head }) => ($head ? 700 : 400)};

  .num {
    text-align: right;
  }
  /* the switch keeps its 44 px hit area although the row is slimmer */
  button {
    margin: -0.125rem 0;
  }
  .name {
    font-size: 1rem;
    font-weight: 600;
  }
  .name small {
    margin-left: ${({ theme }) => theme.spacing.sm};
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.875rem;
    font-weight: 400;
  }
`;
function LiveMenu({
  data,
  lang,
  onEditTab,
  onTheDay,
}: Readonly<{
  data: MenuData;
  lang: Language;
  onEditTab: (tab: Tab) => void;
  /** The On the day tab's content (the Sell screen); absent on a phone. */
  onTheDay: MenuSlots['onTheDay'] | undefined;
}>) {
  const { t } = useTranslation(MENU_NS);
  const navigate = useNavigate();
  const { run, busy } = useRunOp();
  const { view } = data;
  const { menu } = view;
  const { orders, sold } = useSold(true);
  const [asking, setAsking] = useState<'unpublish' | 'finish' | null>(null);
  const places = view.pickupPoints.map((place) => place.place).join(', ');
  // Plan 107: Menu opens on the On the day tab on its cooking day.
  const [shown, setShown] = useState<'pre' | 'day'>(
    onTheDay && localDate(new Date(), viewedKitchenZone()) >= menu.cookingDate ? 'day' : 'pre',
  );
  const tabs = onTheDay ? (
    <Segmented
      options={[
        { value: 'pre', label: t('live.tabPre') },
        { value: 'day', label: t('live.tabDay') },
      ]}
      value={shown}
      onChange={setShown}
      label={t('live.tabsLabel')}
    />
  ) : null;
  if (onTheDay && shown === 'day') {
    return (
      <Section>
        <Top style={{ marginBottom: '0.75rem' }}>{tabs}</Top>
        {onTheDay()}
      </Section>
    );
  }
  return (
    <Section>
      {tabs ? <Top>{tabs}</Top> : null}
      <Top>
        <div>
          <Title2>
            <Kicker $live>
              <Icon name="check" />
              {t('live.kicker')}
            </Kicker>
            <Big>{formatDay(menu.cookingDate, lang)}</Big>
          </Title2>
          <Muted>
            {[
              t('live.orders', { count: orders }),
              t('live.close', { when: formatCutoff(menu.cutoffAt, lang) }),
              places,
              menu.delivery.available ? t('live.deliveryOn') : t('live.deliveryOff'),
            ]
              .filter(Boolean)
              .join(' · ')}
          </Muted>
        </div>
        <Actions>
          <Button variant="primary" onClick={() => onEditTab('dishes')}>
            <Icon name="pencil" />
            {t('session.editMenu')}
          </Button>
          <Button onClick={() => void navigate('/seller/share')}>
            <Icon name="share" />
            {t('live.share')}
          </Button>
          <Button variant="quiet" onClick={() => setAsking('unpublish')}>
            {t('live.unpublish')}
          </Button>
        </Actions>
      </Top>
      <div role="table" aria-label={t('live.tableLabel')}>
        <DishRow $head role="row">
          <span role="columnheader">{t('live.dish')}</span>
          <span role="columnheader" className="num">
            {t('live.price')}
          </span>
          <span role="columnheader" className="num">
            {t('live.limit')}
          </span>
          <span role="columnheader" className="num">
            {t('live.sold')}
          </span>
          <span role="columnheader">{t('live.soldOut')}</span>
        </DishRow>
        {view.dishes.map((dish) => (
          <DishRow key={dish.id} role="row" $off={dish.soldOut}>
            <span role="cell" className="name">
              {dishName(dish, lang)}
              {pickSize(dish, lang) ? <small>{pickSize(dish, lang)}</small> : null}
            </span>
            <span role="cell" className="num">
              {formatMoney(dish.priceCents, lang)}
            </span>
            <span role="cell" className="num">
              {dish.limit ?? '–'}
            </span>
            <span role="cell" className="num">
              {sold.get(dish.id) ?? 0}
            </span>
            <span role="cell">
              <SwitchButton
                type="button"
                role="switch"
                aria-checked={dish.manualSoldOut === true}
                aria-label={t('live.soldOutFor', { name: dishName(dish, lang) })}
                $on={dish.manualSoldOut === true}
                disabled={busy}
                onClick={() =>
                  run({
                    kind: 'updateMenuDish',
                    id: dish.id,
                    request: { soldOut: dish.manualSoldOut !== true },
                  })
                }
              >
                <i />
                <span>{dish.manualSoldOut === true ? t('live.yes') : t('live.no')}</span>
              </SwitchButton>
            </span>
          </DishRow>
        ))}
      </div>
      <Actions style={{ marginTop: '0.5rem' }}>
        <LinkButton onClick={() => setAsking('finish')}>{t('live.finish')}</LinkButton>
      </Actions>
      {asking === 'unpublish' ? (
        <WarningDialog
          title={t('live.unpublishTitle')}
          cancelLabel={t('live.keepLive')}
          continueLabel={t('live.unpublishAnyway')}
          onCancel={() => setAsking(null)}
          onContinue={() => {
            setAsking(null);
            run({ kind: 'unpublish' });
          }}
        >
          {t('live.unpublishBody', { count: orders })}
        </WarningDialog>
      ) : null}
      {asking === 'finish' ? (
        <WarningDialog
          title={t('live.finishTitle')}
          cancelLabel={t('live.keepLive')}
          continueLabel={t('live.finishAnyway')}
          onCancel={() => setAsking(null)}
          onContinue={() => {
            setAsking(null);
            run({ kind: 'finish' });
          }}
        >
          {t('live.finishBody')}
        </WarningDialog>
      ) : null}
    </Section>
  );
}

function pickSize(dish: MenuDishView, lang: Language): string {
  const own = lang === 'id' ? dish.size.id : dish.size.en;
  return own || dish.size.en || dish.size.id;
}

function NotPublished({
  data,
  lang,
  onOpen,
}: Readonly<{ data: MenuData; lang: Language; onOpen: (step: Step) => void }>) {
  const { t } = useTranslation(MENU_NS);
  const { run } = useRunOp();
  const [asking, setAsking] = useState(false);
  const { menu } = data.view;
  return (
    <Section>
      <Kicker>
        <Icon name="note" />
        {t('draft.kicker')}
      </Kicker>
      <Big>{t('draft.title', { date: formatDay(menu.cookingDate, lang) })}</Big>
      <Muted>{t('draft.saved', { dishes: data.view.dishes.length })}</Muted>
      <StepTabs data={data} lang={lang} onOpen={onOpen} />
      <Actions style={{ marginTop: '1rem' }}>
        <Button variant="quiet" onClick={() => setAsking(true)}>
          {t('draft.delete')}
        </Button>
      </Actions>
      {asking ? (
        <WarningDialog
          title={t('draft.deleteTitle')}
          cancelLabel={t('draft.keep')}
          continueLabel={t('draft.deleteAnyway')}
          onCancel={() => setAsking(false)}
          onContinue={() => {
            setAsking(false);
            run({ kind: 'deleteMenu' });
          }}
        >
          {t('draft.deleteBody')}
        </WarningDialog>
      ) : null}
    </Section>
  );
}

export type ScreenSlots = Pick<MenuSlots, 'newMenu' | 'chefs'> &
  Partial<Pick<MenuSlots, 'onTheDay'>>;

/** The owner's Menu; a chef (plan 030, `chefId` is theirs) gets Your dishes only. */
export function MenuScreen({ slots, chefId }: Readonly<{ slots: ScreenSlots; chefId?: string }>) {
  return chefId ? <ChefMenu chefId={chefId} /> : <OwnerMenu slots={slots} />;
}

function OwnerMenu({ slots }: Readonly<{ slots: ScreenSlots }>) {
  const { t } = useTranslation(MENU_NS);
  const lang = useLang();
  const wizard = useMenuWizard();
  const { data, status } = useMenuData();
  const { run } = useRunOp();
  // The New menu dialog (Home's), opened with the dishes of an earlier menu when it came from one.
  const [asking, setAsking] = useState<{ source?: NewMenuSource } | null>(null);
  const [pastOpen, setPastOpen] = useState(false);
  const [pastId, setPastId] = useState<string | undefined>();

  if (!data) {
    return (
      <Page>
        <Head>
          <Title>{t('title')}</Title>
        </Head>
        {status}
      </Page>
    );
  }
  const state = data.view.menu.state;
  const none = state === 'finished';
  const past = data.past;
  const selected = past.find((week) => week.id === pastId);
  const detail = selected ? (
    <PastDetail
      summary={selected}
      lang={lang}
      {...(none
        ? { useLabel: t('past.use') }
        : state === 'not_published'
          ? { useLabel: t('past.addToThis') }
          : {})}
      {...(none ? {} : { onBack: () => setPastId(undefined) })}
      onUse={() => {
        if (none) {
          setAsking({ source: { kind: 'past', weekId: selected.id } });
        } else {
          run({ kind: 'usePast', weekId: selected.id });
          setPastOpen(false);
          wizard.open('dishes');
        }
      }}
    />
  ) : null;

  const main =
    state === 'live' ? (
      <LiveMenu data={data} lang={lang} onEditTab={wizard.edit} onTheDay={slots.onTheDay} />
    ) : state === 'not_published' ? (
      <NotPublished data={data} lang={lang} onOpen={wizard.open} />
    ) : (
      <Section>
        <Top>
          <div>
            <GroupLabel as="h2">{t('past.heading')}</GroupLabel>
            <Muted>{t('past.hint')}</Muted>
          </div>
        </Top>
        <PastList weeks={past} lang={lang} selectedId={pastId} onOpen={setPastId} />
      </Section>
    );

  const panel = none ? (
    detail
  ) : pastOpen ? (
    <div>
      <Tools style={{ justifyContent: 'space-between' }}>
        <GroupLabel>{t('past.heading')}</GroupLabel>
        <Button
          variant="quiet"
          onClick={() => {
            setPastOpen(false);
            setPastId(undefined);
          }}
        >
          {t('close')}
        </Button>
      </Tools>
      {detail ?? <PastList weeks={past} lang={lang} compact onOpen={setPastId} />}
    </div>
  ) : null;

  return (
    <Page>
      <Head>
        <Title>{t('title')}</Title>
        <Tools>
          <HeaderLink to="/seller/menu/dishes">
            {t('header.dishes', { count: data.dishes.length })}
          </HeaderLink>
          <HeaderLink to="/seller/menu/sets">
            {t('header.sets', { count: data.sets.length })}
          </HeaderLink>
          {none ? (
            <Button variant="primary" onClick={() => setAsking({})}>
              <Icon name="plus" />
              {t('header.newMenu')}
            </Button>
          ) : (
            <Button onClick={() => setPastOpen((open) => !open)} aria-expanded={pastOpen}>
              <Icon name="history" />
              {t('header.past', { count: past.length })}
            </Button>
          )}
        </Tools>
      </Head>
      <Body>
        <ListWithPanel list={main} {...(panel ? { panel } : {})} panelLabel={t('past.panel')} />
      </Body>
      {asking
        ? slots.newMenu({
            lang,
            defaults: data.prefs.menuDefaults,
            past,
            sets: data.sets,
            ...(asking.source ? { initialSource: asking.source } : {}),
            onCreate: (input) => {
              setAsking(null);
              wizard.start(input);
            },
            onClose: () => setAsking(null),
          })
        : null}
      {wizard.failed ? <Muted role="alert">{t('genericError')}</Muted> : null}
    </Page>
  );
}
