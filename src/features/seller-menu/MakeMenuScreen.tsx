import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { styled } from 'styled-components';
import { formatDay } from '../../../shared/dates';
import { MAX_MENU_ITEMS } from '../../../shared/limits';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { draftKey } from '../../components/draft';
import { Button, Icon, WarningDialog } from '../../ui';
import { AutoSaveGate, type Leavable } from './autoSave';
import { CheckStep } from './CheckStep';
import { DetailsStep } from './DetailsStep';
import { DishEditorHost, useDishEditor } from './DishEditorHost';
import { diffSession, DraftSession } from './draftSession';
import { EditSheet } from './EditSheet';
import { DishesStep } from './DishesStep';
import { MENU_NS } from './i18n/register';
import { Head, Muted, Page, Title, useLang, useMenuData, useOpWatch, useRunOp } from './menuShared';
import type { MenuData } from './menuSlice';
import { PricesTable } from './PricesTable';
import { PublishStep } from './PublishStep';
import { MarksContext, SessionContext, useSessionData } from './sessionIntercept';
import { DraftPill, SaveChangesDialog, SessionFooter } from './SessionParts';
import type { MenuSlots } from './slots';
import { STEPS, TABS, stepPath, type Mode, type Step, type Tab } from './steps';
import { setCloseGuard, useCloseWizardNow } from './useMenuWizard';
import { SAVED_MS, useSessionControls } from './useSessionControls';

// Make a menu (the wizard, tablet) and editing a live menu (the same screens, no wizard). Plan 103
// fix 8: both work in a session: changes stay on this device until Save. A live menu is edited in
// a sheet (tabs, no Publish step) with a Save footer; the wizard saves on Next and shows a pill.

const Bar = styled.nav`
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  min-width: 0;
`;
const StepButton = styled.button<{ $current: boolean; $done: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.xs};
  border: 0;
  background: transparent;
  color: ${({ $current, theme }) => ($current ? theme.c.text : theme.c.muted)};
  font: inherit;
  font-weight: ${({ $current }) => ($current ? 700 : 500)};
  cursor: pointer;

  &:disabled {
    cursor: default;
  }
  i {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: ${({ theme }) => theme.border.hairline} solid
      ${({ $current, theme }) => ($current ? theme.c.fill : theme.c.ctrl)};
    border-radius: 50%;
    background: ${({ $current, $done, theme }) =>
      $current || $done ? theme.c.fill : 'transparent'};
    color: ${({ $current, $done, theme }) => ($current || $done ? theme.c.on : 'inherit')};
    font-size: 0.8125rem;
    font-style: normal;
  }
`;
const TabBar = styled.nav`
  display: flex;
  flex: none;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: 0 ${({ theme }) => theme.spacing.md};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const TabButton = styled.button<{ $current: boolean }>`
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: 0;
  border-bottom: ${({ theme }) => theme.border.tab} solid
    ${({ $current, theme }) => ($current ? theme.c.fill : 'transparent')};
  background: transparent;
  color: ${({ $current, theme }) => ($current ? theme.c.text : theme.c.muted)};
  font: inherit;
  font-weight: ${({ $current }) => ($current ? 700 : 500)};
  cursor: pointer;
`;
const TitleBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
`;
const Status = styled.span<{ $live: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  color: ${({ $live, theme }) => ($live ? theme.c.conf : theme.c.muted)};
  font-size: 0.875rem;
`;
const Body = styled.div`
  flex: 1;
  min-height: 0;
`;
const Foot = styled.footer`
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.size.pagePadTablet}px;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: ${({ theme }) => theme.c.bg};
`;
const FootRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.lg};
`;
const Section = styled.div`
  padding: ${({ theme }) => theme.size.pagePadTablet}px;
`;

/** How long "Saved ✓" shows in the sheet before it closes. */
const CLOSE_AFTER_MS = Math.min(SAVED_MS, 900);

export function MakeMenuScreen({
  mode,
  step,
  slots,
  layered = false,
}: Readonly<{
  mode: Mode;
  step: Step | Tab;
  slots: MenuSlots;
  /** Shown in a layer that has its own Close button (plan 037). */
  layered?: boolean;
}>) {
  const { t } = useTranslation(MENU_NS);
  // The layer stays open from step to step: the screen it was opened over travels with the address.
  const state: unknown = useLocation().state;
  const { data, status } = useMenuData();
  // Plan 103 fix 8: the session lives as long as this screen; the wizard's is kept on this device.
  const menuId = data?.view.menu.id;
  const session = useMemo(
    () =>
      new DraftSession(
        mode === 'make' && menuId
          ? draftKey(currentSellerSlug(), 'menu-session', menuId)
          : undefined,
      ),
    [mode, menuId],
  );
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
  const { menu } = data.view;
  if (menu.state === 'finished') return <Navigate to="/seller/menu" replace />;
  // Wizard for a menu being made, tabs for a live one; the last wizard step also shows the post.
  if (mode === 'make' && menu.state === 'live' && step !== 'publish') {
    return (
      <Navigate to={stepPath('edit', step === 'check' ? 'prices' : step)} replace state={state} />
    );
  }
  if (mode === 'edit' && menu.state !== 'live') {
    return (
      <Navigate to={stepPath('make', step === 'prices' ? 'check' : step)} replace state={state} />
    );
  }
  const active =
    (mode === 'edit' && menu.state === 'live') ||
    (mode === 'make' && menu.state === 'not_published');
  return (
    <SessionContext.Provider value={active ? session : null}>
      <MakeMenuBody
        mode={mode}
        step={step}
        slots={slots}
        layered={layered}
        saved={data}
        session={session}
        active={active}
      />
    </SessionContext.Provider>
  );
}

function MakeMenuBody({
  mode,
  step,
  slots,
  layered,
  saved,
  session,
  active,
}: Readonly<{
  mode: Mode;
  step: Step | Tab;
  slots: MenuSlots;
  layered: boolean;
  /** The menu as the server holds it; `data` below has the session's changes in. */
  saved: MenuData;
  session: DraftSession;
  active: boolean;
}>) {
  const { t } = useTranslation(MENU_NS);
  const lang = useLang();
  const navigate = useNavigate();
  const state: unknown = useLocation().state;
  const closeNow = useCloseWizardNow();
  const { run } = useRunOp();
  const editor = useDishEditor();
  const data = useSessionData(saved, active ? session : null);
  const controls = useSessionControls(session, saved);
  const { menu, dishes } = data.view;
  // Plan 072: the step on screen saves its pending changes before the seller leaves it; if an
  // earlier save did not get through, a calm warning asks first.
  const gate = useRef(new Set<Leavable>());
  const [leaving, setLeaving] = useState<{ go: () => void } | null>(null);
  const [asking, setAsking] = useState<{ go: () => void } | null>(null);
  const [savingAsk, setSavingAsk] = useState(false);
  const flush = () => [...gate.current].forEach((saver) => saver.flushIfDue());
  const leave = (proceed: () => void) => {
    const savers = [...gate.current];
    flush();
    if (savers.some((saver) => saver.hasFailed())) setLeaving({ go: proceed });
    else proceed();
  };
  /** How many changes are waiting right now (the steps hand theirs on first). */
  const waiting = () => {
    if (!active) return 0;
    flush();
    return diffSession(saved, session.getState()).total;
  };
  const index = mode === 'make' ? STEPS.indexOf(step as Step) : -1;
  const reached = menu.wizardStep;
  // The furthest step reached is saved, so Continue on the Menu screen comes back here.
  useEffect(() => {
    if (mode === 'make' && menu.state === 'not_published' && index > reached) {
      run({ kind: 'updateMenu', request: { wizardStep: index } });
    }
  }, [mode, menu.state, index, reached, run]);
  // A dish made in the editor with "add to this menu" ticked becomes a tick in the session.
  useOpWatch(['createDish'], {
    onDone: (result) => {
      const add = session.takeNextCreated() ? result.dishId : undefined;
      if (!add || !active) return;
      const current =
        session.getState().dishIds ??
        saved.view.dishes.flatMap((dish) =>
          dish.dishId && dish.groupId === undefined ? [dish.dishId] : [],
        );
      if (current.length < MAX_MENU_ITEMS && !current.includes(add)) {
        session.patchMenu({ dishIds: [...current, add] });
      }
    },
    onFail: () => void session.takeNextCreated(),
  });

  /** Save, then carry on (a step of the wizard, the sheet closing); a failure stays put. */
  const saveThen = async (go: () => void, after = 0) => {
    flush();
    const ok = await controls.save();
    if (!ok) return false;
    if (after > 0) setTimeout(go, after);
    else go();
    return true;
  };
  /** Leaving the session (Close, the sheet's ✕, another page): asks first when changes wait. */
  const requestLeave = (go: () => void) => {
    if (waiting() > 0) setAsking({ go });
    else leave(go);
  };
  const requestClose = () => requestLeave(closeNow);
  const closeRef = useRef(requestClose);
  useEffect(() => {
    closeRef.current = requestClose;
  });
  // The layer's own Close (outside this screen) asks the same question.
  useEffect(() => {
    setCloseGuard(() => closeRef.current());
    return () => setCloseGuard(null);
  }, []);

  const go = (to: Step | Tab) => {
    const there = () => void navigate(stepPath(mode, to), { state });
    // The wizard saves its changes on the way to another step; the sheet's tabs share one session.
    if (mode === 'make' && waiting() > 0) void saveThen(there);
    else leave(there);
  };
  const live = menu.state === 'live';
  const date = formatDay(menu.cookingDate, lang);
  const goOrders = () => {
    const there = () => void navigate('/seller/orders');
    if (waiting() > 0) void saveThen(there);
    else leave(there);
  };
  const openEditor = (dishId: string) => {
    // A dish already on the menu is edited as the menu's copy, so the change waits for Save.
    const item = active ? saved.view.dishes.find((dish) => dish.dishId === dishId) : undefined;
    editor.open(item ? { itemId: item.id } : { dishId });
  };
  const newDish = () =>
    mode === 'edit' ? requestLeave(() => void navigate('/seller/menu/dishes')) : editor.open('new');

  const content =
    step === 'dishes' ? (
      <DishesStep data={data} lang={lang} live={live} onEdit={openEditor} onNewDish={newDish} />
    ) : step === 'details' ? (
      <DetailsStep data={data} lang={lang} />
    ) : step === 'check' ? (
      <CheckStep data={data} lang={lang} onGo={go} renderPreview={slots.preview} />
    ) : step === 'prices' ? (
      <Section>
        <PricesTable data={data} lang={lang} />
      </Section>
    ) : (
      <PublishStep data={data} lang={lang} onGoToOrders={goOrders} renderShare={slots.share} />
    );

  const dialogs = (
    <>
      <DishEditorHost
        data={data}
        value={editor.value}
        onClose={editor.close}
        renderChefs={slots.chefs}
      />
      {leaving ? (
        <WarningDialog
          title={t('autosave.leaveTitle')}
          cancelLabel={t('autosave.leaveTry')}
          continueLabel={t('autosave.leaveAnyway')}
          onCancel={() => {
            [...gate.current].forEach((saver) => saver.retry());
            setLeaving(null);
          }}
          onContinue={() => {
            const target = leaving;
            setLeaving(null);
            target.go();
          }}
        >
          {t('autosave.leaveBody')}
        </WarningDialog>
      ) : null}
      {asking ? (
        <SaveChangesDialog
          count={controls.diff.total}
          draft={mode === 'make'}
          saving={savingAsk}
          onKeep={() => setAsking(null)}
          onDont={() => {
            const target = asking;
            setAsking(null);
            session.reset();
            target.go();
          }}
          onSave={() => {
            const target = asking;
            setSavingAsk(true);
            void saveThen(target.go, mode === 'edit' ? CLOSE_AFTER_MS : 0).then(() => {
              setSavingAsk(false);
              setAsking(null);
            });
          }}
        />
      ) : null}
    </>
  );

  if (mode === 'edit') {
    return (
      <MarksContext.Provider value={active ? controls.diff : null}>
        <AutoSaveGate.Provider value={gate}>
          <EditSheet
            title={t('session.title', { date })}
            onClose={requestClose}
            tabs={
              <TabBar aria-label={t('make.tabs')}>
                {TABS.map((name) => (
                  <TabButton
                    key={name}
                    type="button"
                    $current={name === step}
                    aria-current={name === step ? 'page' : undefined}
                    onClick={() => go(name)}
                  >
                    {t(`tab.${name}`)}
                  </TabButton>
                ))}
              </TabBar>
            }
            band={t('session.band')}
            footer={
              <SessionFooter
                diff={controls.diff}
                phase={controls.phase}
                onSave={() => {
                  void saveThen(closeNow, CLOSE_AFTER_MS);
                }}
                onDiscard={() => {
                  flush();
                  controls.discard();
                }}
              />
            }
          >
            <Body>{content}</Body>
          </EditSheet>
          {dialogs}
        </AutoSaveGate.Provider>
      </MarksContext.Provider>
    );
  }

  const next = index < STEPS.length - 1 ? STEPS[index + 1] : undefined;
  const back = index > 0 ? STEPS[index - 1] : undefined;
  return (
    <AutoSaveGate.Provider value={gate}>
      <Page>
        <Head>
          <TitleBlock>
            <Title>{t('make.title', { date })}</Title>
            <Status $live={live}>
              <Icon name={live ? 'check' : 'note'} />
              {live ? t('make.live') : t('make.notPublished')}
            </Status>
          </TitleBlock>
          <Bar aria-label={t('make.steps')}>
            {STEPS.map((name, position) => {
              const done = position < Math.max(reached, index);
              return (
                <StepButton
                  key={name}
                  type="button"
                  $current={position === index}
                  $done={done}
                  aria-current={position === index ? 'step' : undefined}
                  disabled={position > Math.max(reached, index)}
                  onClick={() => go(name)}
                >
                  <i>{done && position !== index ? <Icon name="check" /> : position + 1}</i>
                  {t(`step.${name}`)}
                  {name === 'dishes' && done && position !== index
                    ? ` · ${String(dishes.length)}`
                    : ''}
                </StepButton>
              );
            })}
          </Bar>
          {!layered ? (
            <Button variant="quiet" onClick={requestClose}>
              {t('close')}
            </Button>
          ) : null}
        </Head>
        <Body>{content}</Body>
        <Foot>
          {back ? (
            <Button onClick={() => go(back)}>
              <Icon name="back" />
              {t('make.back')}
            </Button>
          ) : (
            <span />
          )}
          <FootRight>
            <Muted>
              {step === 'dishes'
                ? t('make.stepDishes', { n: index + 1, count: dishes.length })
                : t('make.stepOf', { n: index + 1, total: STEPS.length })}
            </Muted>
            {next ? (
              <Button variant="primary" onClick={() => go(next)}>
                {t('make.next', { name: t(`step.${next}`) })}
                <Icon name="forward" />
              </Button>
            ) : null}
          </FootRight>
        </Foot>
        {active ? (
          <DraftPill
            diff={controls.diff}
            phase={controls.phase}
            onSave={() => {
              flush();
              void controls.save();
            }}
          />
        ) : null}
        {dialogs}
      </Page>
    </AutoSaveGate.Provider>
  );
}
