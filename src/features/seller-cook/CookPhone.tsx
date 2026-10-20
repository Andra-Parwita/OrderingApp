import { memo, useCallback, useState, type ChangeEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Language } from '../../../shared/domain';
import { pickText } from '../../../shared/text';
import { AutoSaveStatus } from '../../components/autoSave/AutoSaveStatus';
import { PrivateTag } from '../../components/PrivateTag';
import { useMediaQuery } from '../../components/useMediaQuery';
import { Icon, Segmented, type SegmentedOption } from '../../ui';
import { ChefFilterControl, type useChefFilter } from './ChefFilterControl';
import type { CookRow, GroupBy } from './cookModel';
import { COOK_NS } from './i18n/register';
import { LineNotes } from './LineNotes';
import type { useMadeCounts } from './madeCounts';

// Plan 100 (ruling B2): the Cook tab below the tablet breakpoint. One row per dish, folded
// controls, one "Notes (N)" row. The tablet and desktop layout is CookTab's own and unchanged.

// Same width as DESKTOP_QUERY in app/layout.ts (a feature may not import app): from 600 px up the
// tablet layout applies, below it the phone one.
const TABLET_QUERY = '(min-width: 600px)';

/** True below the tablet breakpoint. */
export function usePhone(): boolean {
  return !useMediaQuery(TABLET_QUERY);
}

const GROUPS: ReadonlyArray<GroupBy> = ['item', 'chef'];

const ControlRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.lg};
`;
const CountRow = styled(ControlRow)`
  justify-content: space-between;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const Switch = styled.label`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  flex: none;
  min-height: ${({ theme }) => theme.size.tap}px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;

  input {
    width: 1.25rem;
    height: 1.25rem;
    accent-color: ${({ theme }) => theme.c.fill};
  }
`;
const Hidden = styled.span`
  position: absolute;
  width: 0.0625rem;
  height: 0.0625rem;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`;
const Status = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing.sm};
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
`;

type PhoneControlsProps = Readonly<{
  groupBy: GroupBy;
  onGroupBy: (next: GroupBy) => void;
  chef: ReturnType<typeof useChefFilter>;
  counting: boolean;
  onCounting: (event: ChangeEvent<HTMLInputElement>) => void;
  cooked: number;
  total: number;
  saver: ReturnType<typeof useMadeCounts>['saver'];
}>;

/** Dish | Chef with the chef select, then Count mode with "x of y cooked · Saved ✓". */
export function PhoneControls({
  groupBy,
  onGroupBy,
  chef,
  counting,
  onCounting,
  cooked,
  total,
  saver,
}: PhoneControlsProps) {
  const { t } = useTranslation(COOK_NS);
  const options: ReadonlyArray<SegmentedOption<GroupBy>> = GROUPS.map((value) => ({
    value,
    label: t(`group.${value === 'item' ? 'dish' : value}`),
  }));
  return (
    <>
      <ControlRow>
        <Segmented
          compact
          options={options}
          value={groupBy}
          onChange={onGroupBy}
          label={t('group.label')}
        />
        <ChefFilterControl {...chef} phone />
      </ControlRow>
      <CountRow>
        <Switch title={t('countHint')}>
          <input
            type="checkbox"
            role="switch"
            checked={counting}
            onChange={onCounting}
            aria-describedby="cook-count-hint"
          />
          {t('countMode')}
          <Hidden id="cook-count-hint">{t('countHint')}</Hidden>
        </Switch>
        {counting ? (
          <Status>
            <span>{t('cooked', { made: cooked, total })}</span>
            <AutoSaveStatus state={saver.state} onRetry={saver.retry} ns={COOK_NS} />
          </Status>
        ) : null}
      </CountRow>
    </>
  );
}

const Item = styled.li<{ $done: boolean }>`
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-height: 3.625rem;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md}
    ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  /* Done is muted text (still AA), not opacity. */
  color: ${({ theme, $done }) => ($done ? theme.c.muted : theme.c.text)};
`;
const Big = styled.span`
  flex: none;
  width: 2rem;
  text-align: right;
  font-size: 1.375rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
`;
const Names = styled.span<{ $choice?: boolean }>`
  flex: 1;
  min-width: 0;
  padding-left: ${({ $choice, theme }) => ($choice ? theme.spacing.md : '0')};
`;
const Name = styled.b<{ $done: boolean }>`
  display: block;
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.2;
  overflow-wrap: anywhere;
  text-decoration: ${({ $done }) => ($done ? 'line-through' : 'none')};
`;
const Unit = styled.em`
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.8125rem;
  font-style: normal;
  font-weight: 400;
`;
const Split = styled.span`
  display: block;
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.8125rem;
  line-height: 1.25;
`;
const Who = styled.button`
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.xs};
  min-width: ${({ theme }) => theme.size.tap}px;
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.sm};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
  border-radius: ${({ theme }) => theme.radius.md};
  background: transparent;
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  font-weight: 600;
  cursor: pointer;
`;
const Steps = styled.span`
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};

  output {
    min-width: 1.375rem;
    text-align: center;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
`;
const Step = styled.button<{ $primary?: boolean }>`
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  border: ${({ theme }) => theme.border.hairline} solid
    ${({ theme, $primary }) => ($primary ? theme.c.fill : theme.c.ctrl)};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme, $primary }) => ($primary ? theme.c.fill : 'transparent')};
  color: ${({ theme, $primary }) => ($primary ? theme.c.on : theme.c.text)};
  font: inherit;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;
const Bar = styled.span`
  position: absolute;
  right: ${({ theme }) => theme.spacing.md};
  bottom: 0;
  left: ${({ theme }) => theme.spacing.lg};
  height: 0.1875rem;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.c.surf2};
  overflow: hidden;
`;
const Fill = styled.span<{ $percent: number }>`
  display: block;
  width: ${({ $percent }) => $percent}%;
  height: 100%;
  background: ${({ theme }) => theme.c.fill};
`;

type PhoneRowProps = Readonly<{
  row: CookRow;
  lang: Language;
  counting: boolean;
  made: number;
  onChange: (itemId: string, delta: number, total: number) => void;
  onWho: (itemId: string) => void;
}>;

/** One dish: count · name and unit · pickup/delivery · people · − n +, progress along the bottom. */
export const PhoneRow = memo(function PhoneRow({
  row,
  lang,
  counting,
  made,
  onChange,
  onWho,
}: PhoneRowProps) {
  const { t } = useTranslation(COOK_NS);
  const shown = pickText(row.name, lang);
  const pickup = row.who
    .filter((who) => who.fulfilment === 'pickup')
    .reduce((n, w) => n + w.qty, 0);
  const delivery = row.qty - pickup;
  const split = [
    pickup > 0 ? t('splitPickup', { count: pickup }) : null,
    delivery > 0 ? t('splitDelivery', { count: delivery }) : null,
  ]
    .filter((part) => part !== null)
    .join(' · ');
  if (row.group) {
    return (
      <Item $done={false}>
        <Big>{row.qty}</Big>
        <Names>
          <Name $done={false}>{shown}</Name>
          <Split>{t('choiceCount')}</Split>
        </Names>
      </Item>
    );
  }
  const done = counting && made >= row.qty;
  const unit = pickText(row.size, lang);
  return (
    <Item $done={done}>
      <Big>{row.qty}</Big>
      <Names $choice={row.choice === true}>
        <Name $done={done}>
          {shown} {row.privateQty > 0 ? <PrivateTag label={t('privateTag')} /> : null}
          {unit ? <Unit> · {unit}</Unit> : null}
        </Name>
        <Split>
          {split}
          {row.privateQty > 0
            ? ` · ${t('menuPrivate', { menu: row.qty - row.privateQty, private: row.privateQty })}`
            : ''}
        </Split>
      </Names>
      <Who aria-label={t('who.open', { name: shown })} onClick={() => onWho(row.itemId)}>
        <Icon name="person" />
        {row.who.length}
      </Who>
      {counting ? (
        <>
          <Steps>
            <Step
              aria-label={t('less', { name: shown })}
              disabled={made <= 0}
              onClick={() => onChange(row.itemId, -1, row.qty)}
            >
              −
            </Step>
            <output aria-label={t('cooked', { made, total: row.qty })}>{made}</output>
            <Step
              $primary
              aria-label={t('more', { name: shown })}
              disabled={made >= row.qty}
              onClick={() => onChange(row.itemId, 1, row.qty)}
            >
              {done ? <Icon name="check" /> : '+'}
            </Step>
          </Steps>
          <Bar aria-hidden="true">
            <Fill $percent={row.qty > 0 ? Math.min(100, (made / row.qty) * 100) : 0} />
          </Bar>
        </>
      ) : null}
      <LineNotes row={row} lang={lang} />
    </Item>
  );
});

const NotesButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.lg};
  border: 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: transparent;
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  font-weight: 700;
  cursor: pointer;
`;
const Chevron = styled.span<{ $open: boolean }>`
  display: inline-flex;
  transform: rotate(${({ $open }) => ($open ? '-90deg' : '90deg')});

  @media (prefers-reduced-motion: no-preference) {
    transition: transform ${({ theme }) => theme.motion.fast};
  }
`;

/** One "Notes (N)" row that opens the notes underneath; `children` are the note rows. */
export function PhoneNotes({ count, children }: Readonly<{ count: number; children: ReactNode }>) {
  const { t } = useTranslation(COOK_NS);
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((was) => !was), []);
  return (
    <section>
      <NotesButton type="button" aria-expanded={open} aria-controls="cook-notes" onClick={toggle}>
        {t('notes', { count })}
        <Chevron $open={open} aria-hidden="true">
          <Icon name="forward" />
        </Chevron>
      </NotesButton>
      {open ? <div id="cook-notes">{children}</div> : null}
    </section>
  );
}
