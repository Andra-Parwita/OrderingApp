import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { formatDay } from '../../../shared/dates';
import type { Language } from '../../../shared/domain';
import type { MenuView } from '../../../shared/menusContract';
import { Aside, Columns, GoLink, Label } from './homeParts';
import { PhaseStrip, StateIcon, type Progress } from './PhaseStrip';
import { HOME_NS } from './i18n/register';
import type { GoTarget } from './types';

// State 2, the body: the four phases of a menu (Make the menu is current) and the four making
// steps with the one the seller stopped at. Read-only: "Continue making it" is the main button.

export const MAKING_STEPS = ['dishes', 'details', 'check', 'publish'] as const;

const Rows = styled.ol`
  margin: 0;
  padding: 0;
  list-style: none;
`;
const Row = styled.li<{ $todo: boolean }>`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: ${({ theme }) => theme.size.rowOrder}px;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  color: ${({ $todo, theme }) => ($todo ? theme.c.muted : theme.c.text)};
  font-weight: 600;

  small {
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.875rem;
    font-weight: 400;
  }
`;
export function Draft({
  view,
  lang,
  onGo,
}: Readonly<{
  view: MenuView;
  lang: Language;
  /** A making step opens the matching tab of the Menu screen (`?step=`, plan 053). */
  onGo: (target: GoTarget, search?: string) => void;
}>) {
  const { t } = useTranslation(HOME_NS);
  const { menu, dishes } = view;
  const stopped = Math.min(menu.wizardStep, MAKING_STEPS.length - 1);
  const phases = [
    { id: 'make', note: t('draft.stepOf', { step: stopped + 1 }) },
    { id: 'taking', note: t('draft.until', { when: formatDay(menu.cutoffAt, lang) }) },
    { id: 'cooking', note: formatDay(menu.cookingDate, lang) },
    { id: 'finished', note: '' },
  ].map((phase) => ({ ...phase, label: t(`draft.phase.${phase.id}`) }));
  const noteOf = (step: (typeof MAKING_STEPS)[number], state: Progress): string => {
    if (state === 'current') return t('draft.stoppedHere');
    if (state === 'todo') return '';
    if (step === 'dishes') return t('draft.stepDishes', { count: dishes.length });
    return step === 'details' ? t('draft.stepDetails') : '';
  };
  return (
    <>
      <PhaseStrip
        label={t('draft.phases')}
        phases={phases.map((phase, index) => ({
          ...phase,
          state: index === 0 ? 'current' : 'todo',
        }))}
      />
      <Columns>
        <section aria-labelledby="home-making">
          <Label id="home-making">{t('draft.stepsTitle')}</Label>
          <Rows>
            {MAKING_STEPS.map((step, index) => {
              const state: Progress =
                index < menu.wizardStep ? 'done' : index === stopped ? 'current' : 'todo';
              return (
                <Row key={step} $todo={state === 'todo'}>
                  <StateIcon state={state} />
                  <GoLink onClick={() => onGo('menu', `step=${step}`)}>
                    {t(`draft.step.${step}`)}
                  </GoLink>
                  <small>{noteOf(step, state)}</small>
                </Row>
              );
            })}
          </Rows>
        </section>
        <Aside>
          <Label>{t('draft.cantOrderTitle')}</Label>
          <p>{t('draft.cantOrder')}</p>
        </Aside>
      </Columns>
    </>
  );
}
