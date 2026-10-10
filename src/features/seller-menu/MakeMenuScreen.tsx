import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { styled } from 'styled-components';
import { formatDay } from '../../../shared/dates';
import { Button, Icon } from '../../ui';
import { CheckStep } from './CheckStep';
import { DetailsStep } from './DetailsStep';
import { DishEditorHost, useDishEditor } from './DishEditorHost';
import { DishesStep } from './DishesStep';
import { MENU_NS } from './i18n/register';
import { Head, Muted, Page, Title, useLang, useMenuData, useRunOp } from './menuShared';
import { PricesTable } from './PricesTable';
import { PublishStep } from './PublishStep';
import type { MenuSlots } from './slots';
import { STEPS, TABS, stepPath, type Mode, type Step, type Tab } from './steps';

// Make a menu (the wizard, tablet) and editing a live menu (the same screens, no wizard). The
// wizard autosaves on every change and has a plain Close. A live menu has tabs, no Publish step,
// and changes reach customers as they are made, so it ends with Done (D-069 Q2).

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

export function MakeMenuScreen({
  mode,
  step,
  slots,
}: Readonly<{ mode: Mode; step: Step | Tab; slots: MenuSlots }>) {
  const { t } = useTranslation(MENU_NS);
  const lang = useLang();
  const navigate = useNavigate();
  const { data, status } = useMenuData();
  const { run } = useRunOp();
  const editor = useDishEditor();
  const index = mode === 'make' ? STEPS.indexOf(step as Step) : -1;
  const reached = data?.view.menu.wizardStep ?? 0;
  // The furthest step reached is saved, so Continue on the Menu screen comes back here.
  useEffect(() => {
    if (mode === 'make' && data && data.view.menu.state === 'not_published' && index > reached) {
      run({ kind: 'updateMenu', request: { wizardStep: index } });
    }
  }, [mode, data, index, reached, run]);

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
  const { menu, dishes } = data.view;
  if (menu.state === 'finished') return <Navigate to="/seller/menu" replace />;
  // Wizard for a menu being made, tabs for a live one; the last wizard step also shows the post.
  if (mode === 'make' && menu.state === 'live' && step !== 'publish') {
    return <Navigate to={stepPath('edit', step === 'check' ? 'prices' : step)} replace />;
  }
  if (mode === 'edit' && menu.state !== 'live') {
    return <Navigate to={stepPath('make', step === 'prices' ? 'check' : step)} replace />;
  }

  const go = (to: Step | Tab) => void navigate(stepPath(mode, to));
  const close = () => void navigate('/seller/menu');
  const live = menu.state === 'live';
  const date = formatDay(menu.cookingDate, lang);
  const goOrders = () => void navigate('/seller');
  const openEditor = (dishId: string) => editor.open({ dishId });

  const content =
    step === 'dishes' ? (
      <DishesStep
        data={data}
        lang={lang}
        live={live}
        onEdit={openEditor}
        onNewDish={() => editor.open('new')}
      />
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

  const next = mode === 'make' && index < STEPS.length - 1 ? STEPS[index + 1] : undefined;
  const back = mode === 'make' && index > 0 ? STEPS[index - 1] : undefined;
  return (
    <Page>
      <Head>
        <TitleBlock>
          <Title>{t('make.title', { date })}</Title>
          <Status $live={live}>
            <Icon name={live ? 'check' : 'note'} />
            {live ? t('make.live') : t('make.notPublished')}
          </Status>
        </TitleBlock>
        {mode === 'make' ? (
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
        ) : (
          <Bar aria-label={t('make.tabs')}>
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
          </Bar>
        )}
        {mode === 'make' ? (
          <Button variant="quiet" onClick={close}>
            {t('close')}
          </Button>
        ) : null}
      </Head>
      <Body>{content}</Body>
      <Foot>
        {mode === 'make' ? (
          <>
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
          </>
        ) : (
          <>
            <Muted>{t('make.instant')}</Muted>
            <Button variant="primary" onClick={close}>
              {t('make.done')}
            </Button>
          </>
        )}
      </Foot>
      <DishEditorHost data={data} value={editor.value} onClose={editor.close} />
    </Page>
  );
}
