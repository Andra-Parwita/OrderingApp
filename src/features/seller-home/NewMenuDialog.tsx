import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { comingSaturday, cutoffAtFor, formatDay } from '../../../shared/dates';
import type { Language } from '../../../shared/domain';
import type { DishSet, MenuDefaults } from '../../../shared/menusContract';
import type { PastWeekSummary } from '../../../shared/pastWeeks';
import { Button, TextField } from '../../ui';
import { Dialog } from './Dialog';
import { HOME_NS, registerSellerHomeI18n } from './i18n/register';
import type { NewMenuInput, StartSource } from './types';

// The New menu dialog (520 px): cooking day, when orders close (from Settings · Menu defaults) and
// where the dishes come from. Presentational: the caller says what creating does, so Menu (plan
// 037) can use the same dialog.

const Row = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Group = styled.fieldset`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;

  legend {
    margin-bottom: ${({ theme }) => theme.spacing.sm};
    padding: 0;
    font-size: 0.875rem;
    font-weight: 600;
  }
`;
const Choice = styled.label<{ $on: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border: ${({ theme }) => theme.border.hairline} solid
    ${({ $on, theme }) => ($on ? theme.c.fill : theme.c.line)};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ $on, theme }) => ($on ? theme.c.tint : 'transparent')};
  cursor: pointer;

  input {
    flex: none;
    width: 1.25rem;
    height: 1.25rem;
    margin: 0;
    accent-color: ${({ theme }) => theme.c.fill};
  }
  span {
    display: flex;
    flex-direction: column;
  }
  strong {
    font-weight: 600;
  }
  small {
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.8125rem;
  }
`;
const SetSelect = styled.select`
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.text};
  font: inherit;
`;
const Note = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.875rem;
`;

export type NewMenuDialogProps = Readonly<{
  lang: Language;
  /** A kitchen's first menu: only "Empty menu" is offered. */
  firstTime?: boolean;
  defaults: MenuDefaults;
  /** Finished menus, newest first: the dishes of one can be copied. */
  past: ReadonlyArray<PastWeekSummary>;
  sets: ReadonlyArray<DishSet>;
  /** Opens with these dishes chosen (the earlier-menu panel's "New menu with these dishes"). */
  initialSource?: StartSource;
  onCreate: (input: NewMenuInput) => void;
  onClose: () => void;
  /** "Today", for the default cooking day (tests give a fixed one). */
  now?: Date;
}>;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

/** The default "Orders close" for a cooking day, as a wall-clock date and time. */
function defaultClose(cookingDate: string, defaults: MenuDefaults) {
  const at = cutoffAtFor(cookingDate, defaults.cutoffDaysBefore, defaults.cutoffTime);
  return { date: at.slice(0, 10), time: at.slice(11, 16) };
}

export function NewMenuDialog({
  lang,
  firstTime = false,
  defaults,
  past,
  sets,
  initialSource,
  onCreate,
  onClose,
  now,
}: NewMenuDialogProps) {
  registerSellerHomeI18n();
  const { t } = useTranslation(HOME_NS);
  const ids = useId();
  const [day, setDay] = useState(() => comingSaturday(now ?? new Date()));
  // Until the seller edits Orders close, it follows the cooking day.
  const [closeEdit, setCloseEdit] = useState<{ date: string; time: string } | null>(null);
  const close =
    closeEdit ?? (DATE.test(day) ? defaultClose(day, defaults) : { date: '', time: '' });

  const canPast = !firstTime && past.length > 0;
  const canSet = !firstTime && sets.length > 0;
  // Which earlier menu's dishes: the one the panel opened this from, else the last.
  const pastId = initialSource?.kind === 'past' ? initialSource.weekId : (past[0]?.id ?? '');
  const [setId, setSetId] = useState(
    initialSource?.kind === 'set' ? initialSource.setId : (sets[0]?.id ?? ''),
  );
  const [kind, setKind] = useState<StartSource['kind']>(() =>
    initialSource?.kind === 'set' && canSet
      ? 'set'
      : initialSource?.kind === 'past' || canPast
        ? 'past'
        : 'empty',
  );
  const fromWeek = past.find((week) => week.id === pastId) ?? past[0];
  const chosenSet = sets.find((candidate) => candidate.id === setId) ?? sets[0];

  const valid = DATE.test(day) && DATE.test(close.date) && TIME.test(close.time);
  const create = () => {
    if (!valid) return;
    const source: StartSource =
      kind === 'past' && fromWeek
        ? { kind: 'past', weekId: fromWeek.id }
        : kind === 'set' && chosenSet
          ? { kind: 'set', setId: chosenSet.id }
          : { kind: 'empty' };
    onCreate({
      cookingDate: day,
      // The cut-off is a wall-clock time in the cook's zone; day 0 gives its offset on that date.
      cutoffAt: cutoffAtFor(close.date, 0, close.time),
      source,
    });
  };

  const options: Array<{ id: StartSource['kind']; title: string; note: string }> = [
    { id: 'empty', title: t('newMenu.empty'), note: t('newMenu.emptyNote') },
  ];
  if (canPast && fromWeek) {
    options.push({
      id: 'past',
      title: t('newMenu.past', { date: formatDay(fromWeek.cookingDate, lang) }),
      note: t('newMenu.pastNote'),
    });
  }
  if (canSet && chosenSet) {
    options.push({
      id: 'set',
      title: t('newMenu.set'),
      note: t('newMenu.setNote', { name: chosenSet.name, count: chosenSet.dishIds.length }),
    });
  }

  return (
    <Dialog
      title={t('newMenu.title')}
      width="32.5rem"
      onClose={onClose}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button variant="primary" disabled={!valid} onClick={create}>
            {t('newMenu.create')}
          </Button>
        </>
      }
    >
      <TextField
        label={t('newMenu.cookingDay')}
        type="date"
        value={day}
        onChange={(event) => setDay(event.target.value)}
        data-autofocus
      />
      <Group>
        <legend>{t('newMenu.ordersClose')}</legend>
        <Row>
          <TextField
            label={t('newMenu.ordersCloseDate')}
            type="date"
            value={close.date}
            onChange={(event) => setCloseEdit({ ...close, date: event.target.value })}
          />
          <TextField
            label={t('newMenu.ordersCloseTime')}
            type="time"
            value={close.time}
            onChange={(event) => setCloseEdit({ ...close, time: event.target.value })}
          />
        </Row>
      </Group>
      <Group>
        <legend>{t('newMenu.startFrom')}</legend>
        {options.map((option) => (
          <Choice key={option.id} $on={kind === option.id}>
            <input
              type="radio"
              name={`${ids}-from`}
              checked={kind === option.id}
              onChange={() => setKind(option.id)}
            />
            <span>
              <strong>{option.title}</strong>
              <small>{option.note}</small>
            </span>
          </Choice>
        ))}
        {kind === 'set' && sets.length > 1 ? (
          <SetSelect
            aria-label={t('newMenu.chooseSet')}
            value={chosenSet?.id}
            onChange={(event) => setSetId(event.target.value)}
          >
            {sets.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </SetSelect>
        ) : null}
      </Group>
      <Note>{t('newMenu.note')}</Note>
    </Dialog>
  );
}
