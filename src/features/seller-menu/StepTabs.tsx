import { useMemo, useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { styled } from 'styled-components';
import { formatCookingDate, formatCutoff, formatWindow } from '../../../shared/dates';
import type { Language } from '../../../shared/domain';
import { formatMoney } from '../../../shared/money';
import { pickText } from '../../../shared/text';
import { Button, Icon } from '../../ui';
import { MENU_NS } from './i18n/register';
import { Muted } from './menuShared';
import type { MenuData } from './menuSlice';
import { STEPS, type Step } from './steps';
import { worries } from './worry';

// Plan 053: a menu that is not published shows its four steps as tabs. A tab shows its step
// read-only; Edit opens the wizard layer at that step, Continue at the first step not done yet.
// `?step=` picks the tab (Home's rows link to it).

type StepState = 'done' | 'current' | 'todo';

const Tabs = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.lg};

  @media (max-width: 37.4375rem) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;
const Tab = styled.button<{ $on: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-bottom: 0;
  border-radius: ${({ theme }) => theme.size.radiusControl}px
    ${({ theme }) => theme.size.radiusControl}px 0 0;
  background: ${({ $on, theme }) => ($on ? theme.c.surf : theme.c.surf2)};
  box-shadow: ${({ $on, theme }) => ($on ? `inset 0 0.1875rem 0 ${theme.c.fill}` : 'none')};
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  font-weight: ${({ $on }) => ($on ? 700 : 600)};
  text-align: left;
  cursor: pointer;

  small {
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.8125rem;
    font-weight: 400;
  }
`;
const Panel = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: 12rem;
  padding: ${({ theme }) => theme.spacing.lg};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: 0 0 ${({ theme }) => theme.size.radiusControl}px
    ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme }) => theme.c.surf};
`;
const Pill = styled.span`
  align-self: flex-start;
  padding: 0 ${({ theme }) => theme.spacing.sm};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: ${({ theme }) => theme.radius.pill};
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.75rem;
`;
const Rows = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
`;
const DishLine = styled.li`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto minmax(0, 8rem);
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  font-variant-numeric: tabular-nums;

  .name {
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .sub {
    color: ${({ theme }) => theme.c.muted};
  }

  @media (max-width: 37.4375rem) {
    grid-template-columns: minmax(0, 1fr) auto;

    .sub {
      grid-column: 1 / -1;
    }
  }
`;
const Facts = styled.dl`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
  margin: 0;

  dt {
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.8125rem;
  }
  dd {
    margin: 0;
    font-weight: 600;
  }
`;
const Check = styled.li<{ $warn: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.xs} 0;
  color: ${({ $warn, theme }) => ($warn ? theme.c.warn : theme.c.text)};
`;
const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: auto;
`;

/** The tab named by `?step=`, or the step the seller stopped at. */
function parseTabParam(value: string | null): Step | null {
  return STEPS.find((step) => step === value) ?? null;
}

export function StepTabs({
  data,
  lang,
  onOpen,
}: Readonly<{ data: MenuData; lang: Language; onOpen: (step: Step) => void }>) {
  const { t } = useTranslation(MENU_NS);
  const [params, setParams] = useSearchParams();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const { menu } = data.view;
  const reached = Math.min(menu.wizardStep, STEPS.length - 1);
  const stateOf = (index: number): StepState =>
    index < menu.wizardStep ? 'done' : index === reached ? 'current' : 'todo';
  const firstNotDone = Math.max(
    0,
    STEPS.findIndex((_, index) => stateOf(index) !== 'done'),
  );
  const selected = parseTabParam(params.get('step')) ?? STEPS[reached] ?? 'dishes';
  const selectedIndex = STEPS.indexOf(selected);
  const pick = (step: Step) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set('step', step);
        return next;
      },
      { replace: true },
    );
  const summary = (step: Step, state: StepState): string => {
    if (state === 'current') return t('draft.stoppedHere');
    if (state === 'todo') return t('draft.todo');
    if (step === 'dishes')
      return t('draft.stepDishes', {
        count: data.view.dishes.filter((dish) => dish.groupId === undefined).length,
      });
    if (step === 'details') {
      const count = data.view.pickupPoints.length;
      return [
        formatCookingDate(menu.cookingDate, lang),
        count > 0 ? t('draft.pickupPlaces', { count }) : '',
      ]
        .filter(Boolean)
        .join(' · ');
    }
    return t('draft.checked');
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = STEPS.length - 1;
    const to =
      event.key === 'ArrowRight'
        ? (selectedIndex + 1) % STEPS.length
        : event.key === 'ArrowLeft'
          ? (selectedIndex + last) % STEPS.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (to === null) return;
    event.preventDefault();
    const step = STEPS[to];
    if (step) pick(step);
    refs.current[to]?.focus();
  };
  const nextStep = STEPS[firstNotDone] ?? 'dishes';
  return (
    <div>
      <Tabs role="tablist" aria-label={t('draft.progress')} onKeyDown={onKeyDown}>
        {STEPS.map((step, index) => {
          const state = stateOf(index);
          const on = step === selected;
          return (
            <Tab
              key={step}
              ref={(element) => {
                refs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`menu-tab-${step}`}
              aria-selected={on}
              aria-controls="menu-step-panel"
              tabIndex={on ? 0 : -1}
              $on={on}
              onClick={() => pick(step)}
            >
              <span>
                {state === 'done' ? <Icon name="check" /> : null} {index + 1} {t(`step.${step}`)}
              </span>
              <small>{summary(step, state)}</small>
            </Tab>
          );
        })}
      </Tabs>
      <Panel role="tabpanel" id="menu-step-panel" aria-labelledby={`menu-tab-${selected}`}>
        <Pill>{t('draft.readOnly')}</Pill>
        <ReadOnlyStep step={selected} data={data} lang={lang} />
        <Actions>
          <Button onClick={() => onOpen(selected)}>
            <Icon name="pencil" />
            {t('draft.edit', { step: t(`step.${selected}`).toLowerCase() })}
          </Button>
          <Button variant="primary" onClick={() => onOpen(nextStep)}>
            {t('draft.continue', { n: firstNotDone + 1 })}
            <Icon name="forward" />
          </Button>
        </Actions>
      </Panel>
    </div>
  );
}

function ReadOnlyStep({
  step,
  data,
  lang,
}: Readonly<{ step: Step; data: MenuData; lang: Language }>) {
  const { t } = useTranslation(MENU_NS);
  const { view } = data;
  const { menu } = view;
  const found = useMemo(() => worries(view, new Date()), [view]);
  if (step === 'dishes') {
    if (view.dishes.length === 0) return <Muted>{t('draft.noDishes')}</Muted>;
    return (
      <Rows aria-label={t('check.dishesOn')}>
        {view.dishes.map((dish) => (
          <DishLine key={dish.id}>
            <span className="name">
              {dish.groupId === undefined ? '' : '– '}
              {pickText(dish.name, lang)}
            </span>
            <span>{dish.groupId === undefined ? formatMoney(dish.priceCents, lang) : ''}</span>
            <span className="sub">
              {dish.limit === undefined ? '–' : t('draft.limitOf', { count: dish.limit })}
            </span>
            <span className="sub">
              {dish.groupId === undefined
                ? (data.chefs.find((chef) => chef.id === dish.chefId)?.name ??
                  t('dish.wholeKitchen'))
                : ''}
            </span>
          </DishLine>
        ))}
      </Rows>
    );
  }
  if (step === 'details') {
    const places = view.pickupPoints
      .map((place) => `${place.place} ${formatWindow(place.window.start, place.window.end, lang)}`)
      .join(', ');
    return (
      <Facts>
        <div>
          <dt>{t('check.cookingDay')}</dt>
          <dd>{formatCookingDate(menu.cookingDate, lang)}</dd>
        </div>
        <div>
          <dt>{t('check.ordersClose')}</dt>
          <dd>{formatCutoff(menu.cutoffAt, lang)}</dd>
        </div>
        <div>
          <dt>{t('check.pickup')}</dt>
          <dd>{places || t('check.nowhere')}</dd>
        </div>
        <div>
          <dt>{t('check.delivery')}</dt>
          <dd>{menu.delivery.available ? t('check.on') : t('check.off')}</dd>
        </div>
      </Facts>
    );
  }
  if (step === 'check') {
    return found.length === 0 ? (
      <Muted role="status">{t('check.allGood')}</Muted>
    ) : (
      <Rows aria-label={t('check.worth')}>
        {found.map((worry) => (
          <Check key={worry.id} $warn>
            <Icon name="warning" />
            {t(`worry.${worry.id}`, { count: worry.count ?? 0 })}
          </Check>
        ))}
      </Rows>
    );
  }
  return <p style={{ margin: 0 }}>{t('draft.publishInfo')}</p>;
}
