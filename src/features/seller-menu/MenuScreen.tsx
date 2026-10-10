import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { styled } from 'styled-components';
import { comingSaturday, formatCutoff, formatDay } from '../../../shared/dates';
import type { Language } from '../../../shared/domain';
import { formatMoney } from '../../../shared/money';
import type { MenuDishView } from '../../../shared/menusContract';
import { Button, Icon, ListWithPanel, TextField, WarningDialog } from '../../ui';
import { DishEditorHost, useDishEditor } from './DishEditorHost';
import { MENU_NS } from './i18n/register';
import {
  AskDialog,
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
  useOpWatch,
  useRunOp,
  dishName,
} from './menuShared';
import type { MenuData } from './menuSlice';
import { PastDetail, PastList } from './PastMenusPanel';
import { STEPS, stepPath } from './steps';
import { useSold } from './useSold';

// The Menu screen (plan 001 stage 7; handoff, Menu screen). Three states: no active menu (Past menus
// and New menu), not published (progress and Continue) and live (the dishes, instant edits).

const HeaderLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  min-height: ${({ theme }) => theme.size.tap}px;
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
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
`;
const Big = styled.h2`
  margin: ${({ theme }) => theme.spacing.xs} 0;
  font-size: 2rem;
  font-weight: 700;
`;
const Top = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.lg};
`;
const Progress = styled.ol`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.xl};
  margin: ${({ theme }) => theme.spacing.lg} 0;
  padding: 0;
  list-style: none;
`;
const ProgressStep = styled.li<{ $done: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  color: ${({ $done, theme }) => ($done ? theme.c.text : theme.c.muted)};
  font-weight: 600;

  i {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
    border-radius: 50%;
    background: ${({ $done, theme }) => ($done ? theme.c.fill : 'transparent')};
    color: ${({ $done, theme }) => ($done ? theme.c.on : 'inherit')};
    font-size: 0.8125rem;
    font-style: normal;
  }
`;
const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;
const DishRow = styled.div<{ $head?: boolean; $off?: boolean }>`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 5rem 4rem 4rem 7.5rem 3rem;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: ${({ theme }) => theme.size.rowCompact + 8}px;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  color: ${({ $head, $off, theme }) => ($head || $off ? theme.c.muted : theme.c.text)};
  font-variant-numeric: tabular-nums;
  font-size: ${({ $head }) => ($head ? '0.8125rem' : '0.9375rem')};
  font-weight: ${({ $head }) => ($head ? 700 : 400)};

  .num {
    text-align: right;
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
const Pencil = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${({ theme }) => theme.size.tap}px;
  height: ${({ theme }) => theme.size.tap}px;
  border: 0;
  background: transparent;
  color: ${({ theme }) => theme.c.muted};
  cursor: pointer;
`;

function NewMenuDialog({
  onCancel,
  onStart,
}: Readonly<{ onCancel: () => void; onStart: (date: string) => void }>) {
  const { t } = useTranslation(MENU_NS);
  const [date, setDate] = useState(() => comingSaturday(new Date()));
  return (
    <AskDialog
      title={t('new.title')}
      confirmLabel={t('new.start')}
      cancelLabel={t('cancel')}
      disabled={!/^\d{4}-\d{2}-\d{2}$/.test(date)}
      onCancel={onCancel}
      onConfirm={() => onStart(date)}
    >
      <TextField
        label={t('new.day')}
        type="date"
        value={date}
        helper={t('new.dayHelper')}
        onChange={(event) => setDate(event.target.value)}
        data-autofocus
      />
    </AskDialog>
  );
}

function LiveMenu({
  data,
  lang,
  onEdit,
}: Readonly<{ data: MenuData; lang: Language; onEdit: (dish: MenuDishView) => void }>) {
  const { t } = useTranslation(MENU_NS);
  const navigate = useNavigate();
  const { run, busy } = useRunOp();
  const { view } = data;
  const { menu } = view;
  const { orders, sold } = useSold(true);
  const [asking, setAsking] = useState<'unpublish' | 'finish' | null>(null);
  const places = view.pickupPoints.map((place) => place.place).join(', ');
  const full = view.dishes.length >= 10;
  return (
    <Section>
      <Top>
        <div>
          <Kicker $live>
            <Icon name="check" />
            {t('live.kicker')}
          </Kicker>
          <Big>{formatDay(menu.cookingDate, lang)}</Big>
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
          <Button onClick={() => void navigate('/seller/menu/edit/details')}>
            <Icon name="pencil" />
            {t('live.editDetails')}
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
          <span />
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
            <span role="cell">
              <Pencil
                type="button"
                aria-label={t('live.edit', { name: dishName(dish, lang) })}
                onClick={() => onEdit(dish)}
              >
                <Icon name="pencil" />
              </Pencil>
            </span>
          </DishRow>
        ))}
      </div>
      <Actions style={{ marginTop: '1rem' }}>
        <Button disabled={full} onClick={() => void navigate('/seller/menu/edit/dishes')}>
          <Icon name="plus" />
          {t('live.addDish')}{' '}
          <Muted as="span">{t('live.nOf', { n: view.dishes.length, max: 10 })}</Muted>
        </Button>
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

function NotPublished({ data, lang }: Readonly<{ data: MenuData; lang: Language }>) {
  const { t } = useTranslation(MENU_NS);
  const navigate = useNavigate();
  const { run } = useRunOp();
  const [asking, setAsking] = useState(false);
  const { menu } = data.view;
  const next = Math.min(menu.wizardStep, STEPS.length - 1);
  return (
    <Section>
      <Kicker>
        <Icon name="note" />
        {t('draft.kicker')}
      </Kicker>
      <Big>{t('draft.title', { date: formatDay(menu.cookingDate, lang) })}</Big>
      <Muted>{t('draft.saved', { dishes: data.view.dishes.length })}</Muted>
      <Progress aria-label={t('draft.progress')}>
        {STEPS.map((step, index) => (
          <ProgressStep key={step} $done={index < menu.wizardStep}>
            <i>{index < menu.wizardStep ? <Icon name="check" /> : index + 1}</i>
            {t(`step.${step}`)}
          </ProgressStep>
        ))}
      </Progress>
      <Actions>
        <Button variant="primary" onClick={() => void navigate(stepPath('make', STEPS[next]!))}>
          {t('draft.continue', { n: next + 1 })}
          <Icon name="forward" />
        </Button>
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

export function MenuScreen() {
  const { t } = useTranslation(MENU_NS);
  const lang = useLang();
  const navigate = useNavigate();
  const { data, status } = useMenuData();
  const { run } = useRunOp();
  const editor = useDishEditor();
  const [asking, setAsking] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);
  const [pastId, setPastId] = useState<string | undefined>();
  const [reuse, setReuse] = useState(false);
  // New menu, then (when started from a past menu) its dishes, then the wizard.
  const [carry, setCarry] = useState<string | null>(null);
  useOpWatch(['createMenu'], {
    onDone: () => {
      if (carry) {
        run({ kind: 'usePast', weekId: carry });
        setCarry(null);
      }
      void navigate(stepPath('make', 'dishes'));
    },
  });

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
  const start = (date: string) => {
    setAsking(false);
    setCarry(reuse && pastId ? pastId : null);
    setReuse(false);
    run({ kind: 'createMenu', cookingDate: date });
  };
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
          setReuse(true);
          setAsking(true);
        } else {
          run({ kind: 'usePast', weekId: selected.id });
          setPastOpen(false);
          void navigate(stepPath('make', 'dishes'));
        }
      }}
    />
  ) : null;

  const main =
    state === 'live' ? (
      <LiveMenu data={data} lang={lang} onEdit={(dish) => editor.open({ itemId: dish.id })} />
    ) : state === 'not_published' ? (
      <NotPublished data={data} lang={lang} />
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
            <Button
              variant="primary"
              onClick={() => {
                setReuse(false);
                setAsking(true);
              }}
            >
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
      {asking ? <NewMenuDialog onCancel={() => setAsking(false)} onStart={start} /> : null}
      <DishEditorHost data={data} value={editor.value} onClose={editor.close} />
    </Page>
  );
}
