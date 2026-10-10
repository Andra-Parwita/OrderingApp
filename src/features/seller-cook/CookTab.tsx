import { memo, useCallback, useMemo, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { Language } from '../../../shared/domain';
import { pickText } from '../../../shared/text';
import { Button, Icon, Segmented, type SegmentedOption } from '../../ui';
import { COOK_NS } from './i18n/register';
import { ChefFilterControl, useChefFilter } from './ChefFilterControl';
import type { CookRow, GroupBy } from './cookModel';
import { selectCookGroups, selectCookNotes } from './cookSelectors';
import type { CookRootState } from './cookSlice';
import { useCountMode, useMadeCounts } from './madeCounts';

const GROUPS: ReadonlyArray<GroupBy> = ['item', 'chef'];

const Tools = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const Inline = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Label = styled.span`
  color: ${({ theme }) => theme.c.muted};
`;
const Switch = styled.label`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-height: ${({ theme }) => theme.size.tap}px;
  font-weight: 600;
  cursor: pointer;

  input {
    width: 1.25rem;
    height: 1.25rem;
    accent-color: ${({ theme }) => theme.c.fill};
  }
`;
const Hint = styled.span`
  color: ${({ theme }) => theme.c.muted};
  font-weight: 400;
`;
const Total = styled.span`
  margin-left: auto;
  color: ${({ theme }) => theme.c.muted};
  font-variant-numeric: tabular-nums;
`;
const GroupHead = styled.h2`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl}
    ${({ theme }) => theme.spacing.xs};
  font-size: 1rem;
`;
const List = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
`;
const RowBox = styled.li<{ $done: boolean }>`
  display: grid;
  grid-template-columns: 3.5rem minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  min-height: ${({ theme }) => theme.size.rowCompact}px;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.xl};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  opacity: ${({ $done }) => ($done ? 0.65 : 1)};

  @media (max-width: 52rem) {
    grid-template-columns: 3rem minmax(0, 1fr) auto;
  }
`;
const Big = styled.span`
  font-size: 1.5rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: right;
`;
const Name = styled.span<{ $done: boolean }>`
  display: flex;
  flex-direction: column;
  min-width: 0;
  font-size: 1.0625rem;
  font-weight: 600;
  text-decoration: ${({ $done }) => ($done ? 'line-through' : 'none')};
`;
const Sub = styled.span`
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.875rem;
  font-weight: 400;
`;
const Split = styled.span`
  color: ${({ theme }) => theme.c.muted};
  white-space: nowrap;
`;
const Made = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  font-weight: 600;
  font-variant-numeric: tabular-nums;
`;
const Bar = styled.span`
  display: inline-block;
  width: 6.5rem;
  height: 0.375rem;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.c.surf2};
  overflow: hidden;
`;
const Fill = styled.span<{ $percent: number }>`
  display: block;
  width: ${({ $percent }) => $percent}%;
  height: 100%;
  background: ${({ theme }) => theme.c.fill};
`;
const Steps = styled.span`
  display: inline-flex;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const NoteRow = styled.li`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.xl};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const Mono = styled.span`
  font-family: ${({ theme }) => theme.font.mono};
  letter-spacing: 0.06em;
`;
const Centered = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.xl};
  color: ${({ theme }) => theme.c.muted};
`;

type RowProps = Readonly<{
  row: CookRow;
  lang: Language;
  counting: boolean;
  made: number;
  onChange: (itemId: string, delta: number, total: number) => void;
}>;

const Row = memo(function Row({ row, lang, counting, made, onChange }: RowProps) {
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
  const done = counting && made >= row.qty;
  return (
    <RowBox $done={done}>
      <Big>{row.qty}</Big>
      <Name $done={done}>
        <span>{shown}</span>
        <Sub>{pickText(row.size, lang)}</Sub>
      </Name>
      <Split>{split}</Split>
      {counting ? (
        <>
          <Made>
            {made}/{row.qty}
            <Bar aria-hidden="true">
              <Fill $percent={row.qty > 0 ? Math.min(100, (made / row.qty) * 100) : 0} />
            </Bar>
          </Made>
          <Steps>
            <Button
              aria-label={t('less', { name: shown })}
              disabled={made <= 0}
              onClick={() => onChange(row.itemId, -1, row.qty)}
            >
              −
            </Button>
            <Button
              variant="primary"
              aria-label={t('more', { name: shown })}
              disabled={made >= row.qty}
              onClick={() => onChange(row.itemId, 1, row.qty)}
            >
              {done ? <Icon name="check" /> : '+'}
            </Button>
          </Steps>
        </>
      ) : null}
    </RowBox>
  );
});

/** Kitchen · Cook: how many of each dish to make, by dish or by chef; count mode ticks them off. */
export function CookTab({
  cookingDate,
  status,
  onRetry,
}: Readonly<{ cookingDate: string; status: 'loading' | 'ready' | 'error'; onRetry: () => void }>) {
  const { t, i18n } = useTranslation(COOK_NS);
  const lang: Language = i18n.resolvedLanguage === 'id' ? 'id' : 'en';
  const [groupBy, setGroupBy] = useState<GroupBy>('item');
  const [counting, setCounting] = useCountMode();
  const { made, change } = useMadeCounts(cookingDate);
  const chef = useChefFilter();
  const groups = useSelector((state: CookRootState) =>
    selectCookGroups(state, 'all', groupBy, chef.filter),
  );
  const notes = useSelector((state: CookRootState) => selectCookNotes(state, 'all', chef.filter));

  const groupOptions: ReadonlyArray<SegmentedOption<GroupBy>> = GROUPS.map((value) => ({
    value,
    label: t(`group.${value === 'item' ? 'dish' : value}`),
  }));
  const { cooked, total } = useMemo(() => {
    let cookedSum = 0;
    let totalSum = 0;
    for (const group of groups) {
      for (const row of group.rows) {
        totalSum += row.qty;
        cookedSum += Math.min(made[row.itemId] ?? 0, row.qty);
      }
    }
    return { cooked: cookedSum, total: totalSum };
  }, [groups, made]);
  const onCounting = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setCounting(event.target.checked),
    [setCounting],
  );

  return (
    <>
      <Tools>
        <Inline>
          <Label>{t('group.label')}</Label>
          <Segmented
            options={groupOptions}
            value={groupBy}
            onChange={setGroupBy}
            label={t('group.label')}
          />
        </Inline>
        <ChefFilterControl {...chef} />
        <Switch>
          <input type="checkbox" role="switch" checked={counting} onChange={onCounting} />
          {t('countMode')} <Hint>{t('countHint')}</Hint>
        </Switch>
        {counting ? <Total>{t('cooked', { made: cooked, total })}</Total> : null}
      </Tools>

      {status === 'loading' ? <Centered role="status">{t('loading')}</Centered> : null}
      {status === 'error' ? (
        <Centered role="alert">
          {t('error')}{' '}
          <Button variant="quiet" onClick={onRetry}>
            {t('retry')}
          </Button>
        </Centered>
      ) : null}
      {status === 'ready' && groups.length === 0 ? <Centered>{t('empty')}</Centered> : null}

      {groups.map((group) => (
        <section key={group.key} aria-label={group.title ?? undefined}>
          {group.title !== null ? <GroupHead>{group.title}</GroupHead> : null}
          <List>
            {group.rows.map((row) => (
              <Row
                key={row.itemId}
                row={row}
                lang={lang}
                counting={counting}
                made={made[row.itemId] ?? 0}
                onChange={change}
              />
            ))}
          </List>
        </section>
      ))}

      {notes.length > 0 ? (
        <section aria-label={t('notes', { count: notes.length })}>
          <GroupHead>{t('notes', { count: notes.length })}</GroupHead>
          <List>
            {notes.map((note) => (
              <NoteRow key={note.code}>
                <Mono>{note.code}</Mono> <b>{note.firstName}</b>
                <div>“{note.note}”</div>
              </NoteRow>
            ))}
          </List>
        </section>
      ) : null}
    </>
  );
}
