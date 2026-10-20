import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { createGlobalStyle, styled } from 'styled-components';
import type { Language } from '../../../shared/domain';
import { formatDay, formatDayTime } from '../../../shared/dates';
import { pickText } from '../../../shared/text';
import { printAreaCss } from '../../components/labels/printArea';
import { Button, Icon, Segmented, type SegmentedOption } from '../../ui';
import { ALL_CHEFS, chefChoices, type ChefFilter } from './cookModel';
import { selectCookMenu, selectCounted } from './cookSelectors';
import { pollingStarted, pollingStopped, type CookRootState } from './cookSlice';
import { useChefFilter } from './ChefFilterControl';
import { COOK_NS } from './i18n/register';
import {
  DEFAULT_PRINT_OPTIONS,
  buildKitchenPrint,
  type KitchenPrintGroupBy,
  type KitchenPrintOptions,
} from './kitchenPrintModel';

// Plan 109: the Kitchen list as A4 pages. Same flow as Print orders and Print labels: the choices
// at the top, the preview under them, then Print (the browser's dialog). Black on white.

const PrintStyle = createGlobalStyle`
  @page { size: A4 portrait; margin: 12mm; }
  @media print {
    ${printAreaCss}
    [data-print-area] { width: 100%; }
  }
`;

const Wrap = styled.main`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  box-sizing: border-box;
  max-width: 64rem;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.lg};
`;
const Head = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Title = styled.h1`
  flex: 1;
  margin: 0;
  font-size: 1.375rem;
`;
const Controls = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
`;
const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  max-width: 100%;
  overflow-x: auto;

  > span,
  > label {
    font-size: 0.875rem;
    font-weight: 700;
  }
`;
const Pick = styled.select`
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.text};
  font: inherit;
`;
const Ticks = styled.fieldset`
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  border: 0;

  label {
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
    min-height: ${({ theme }) => theme.size.tap}px;
    cursor: pointer;
  }
  input {
    width: 1.25rem;
    height: 1.25rem;
    accent-color: ${({ theme }) => theme.c.fill};
  }
`;
const Muted = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
`;
const Pages = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow-x: auto;

  @media print {
    display: block;
    overflow: visible;
  }
`;

/** One A4 sheet on screen; when printed, just its content (the browser breaks pages itself). */
const Sheet = styled.section`
  box-sizing: border-box;
  flex: none;
  width: 210mm;
  max-width: 100%;
  padding: 12mm;
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: white;
  color: black;
  font-size: 11pt;
  line-height: 1.3;

  @media print {
    width: auto;
    max-width: none;
    padding: 0;
    border: 0;
  }
`;
const PageHead = styled.header`
  display: flex;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding-bottom: 2mm;
  margin-bottom: 3mm;
  border-bottom: 0.3mm solid black;

  h2 {
    margin: 0;
    font-size: 14pt;
  }
  p {
    margin: 0;
    font-size: 9pt;
  }
  div:last-child {
    text-align: right;
  }
`;
const Section = styled.div<{ $break: boolean }>`
  ${({ $break }) => ($break ? 'break-before: page;' : '')}
`;
const GroupHead = styled.h3`
  margin: 4mm 0 1mm;
  padding-bottom: 0.5mm;
  border-bottom: 0.2mm solid black;
  font-size: 12pt;
  break-after: avoid;
`;
const Row = styled.article`
  display: grid;
  grid-template-columns: 6mm 14mm minmax(0, 1fr) auto;
  gap: 0 3mm;
  align-items: center;
  padding: 1.5mm 0;
  border-bottom: 0.1mm solid black;
  break-inside: avoid;

  .tick {
    box-sizing: border-box;
    width: 5mm;
    height: 5mm;
    border: 0.3mm solid black;
  }
  .qty {
    font-size: 16pt;
    font-weight: 700;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .name {
    font-weight: 700;
  }
  .name small,
  .meta {
    font-size: 9pt;
    font-weight: 400;
  }
  .meta {
    text-align: right;
  }
  &[data-choice='true'] .name {
    padding-left: 4mm;
    font-weight: 400;
  }
  &[data-group='true'] .tick {
    visibility: hidden;
  }
  .lineNote {
    grid-column: 3 / -1;
    font-size: 9pt;
    font-style: italic;
  }
`;
const NotesBlock = styled.section`
  margin-top: 5mm;

  h3 {
    margin: 0 0 1mm;
    padding-bottom: 0.5mm;
    border-bottom: 0.2mm solid black;
    font-size: 12pt;
    break-after: avoid;
  }
  p {
    margin: 0;
    padding: 1mm 0;
    border-bottom: 0.1mm solid black;
    break-inside: avoid;
  }
  .code {
    font-weight: 700;
    letter-spacing: 0.05em;
  }
`;

const KEY = 'kitchen-print-options';
const GROUPS: ReadonlyArray<KitchenPrintGroupBy> = ['item', 'chef'];

function readRemembered(): Partial<KitchenPrintOptions> {
  try {
    const raw = localStorage.getItem(KEY);
    const saved: unknown = raw ? JSON.parse(raw) : null;
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
}

/** The options of the last print on this device. The chef starts as the Kitchen screen's. */
function useOptions(defaultChef: ChefFilter, chefs: ReadonlyArray<ChefFilter>) {
  const [saved, setSaved] = useState<Partial<KitchenPrintOptions>>(readRemembered);
  const options: KitchenPrintOptions = {
    chef: saved.chef && chefs.includes(saved.chef) ? saved.chef : defaultChef,
    groupBy: saved.groupBy === 'chef' ? 'chef' : DEFAULT_PRINT_OPTIONS.groupBy,
    notes: saved.notes === true,
    includePrivate: saved.includePrivate === true,
    pagePerChef: saved.pagePerChef === true,
  };
  const set = useCallback(
    (patch: Partial<KitchenPrintOptions>) =>
      setSaved((now) => {
        const next = { ...now, ...patch };
        try {
          localStorage.setItem(KEY, JSON.stringify(next));
        } catch {
          // Private window or blocked storage: the choices just are not remembered.
        }
        return next;
      }),
    [],
  );
  return [options, set] as const;
}

/** Kitchen · Print kitchen list. */
export function KitchenPrintScreen({ onBack }: Readonly<{ onBack?: () => void }>) {
  const { t, i18n } = useTranslation(COOK_NS);
  const lang: Language = i18n.resolvedLanguage === 'id' ? 'id' : 'en';
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(pollingStarted());
    return () => {
      dispatch(pollingStopped());
    };
  }, [dispatch]);

  const menu = useSelector(selectCookMenu);
  const counted = useSelector((state: CookRootState) => selectCounted(state, 'all'));
  const start = useChefFilter();
  const choices = useMemo(
    () => [{ value: ALL_CHEFS, label: t('printPage.allChefs') }, ...chefChoices(menu)],
    [menu, t],
  );
  const [options, set] = useOptions(
    start.filter,
    choices.map((choice) => choice.value),
  );
  const [printedAt] = useState(() => new Date().toISOString());
  const print = useCallback(() => window.print(), []);

  const plan = useMemo(() => buildKitchenPrint(counted, menu, options), [counted, menu, options]);
  const empty = menu !== null && plan.sections.length === 0;
  const hasChefs = choices.length > 1;
  const byChef = options.groupBy === 'chef' && hasChefs && options.chef === ALL_CHEFS;
  const chefName = choices.find((choice) => choice.value === options.chef)?.label ?? '';

  const groupOptions: ReadonlyArray<SegmentedOption<KitchenPrintGroupBy>> = GROUPS.map((value) => ({
    value,
    label: t(`group.${value === 'item' ? 'dish' : value}`),
  }));
  const tick = (key: 'notes' | 'includePrivate' | 'pagePerChef') => ({
    checked: options[key],
    onChange: (event: ChangeEvent<HTMLInputElement>) => set({ [key]: event.target.checked }),
  });

  return (
    <Wrap>
      <PrintStyle />
      <Head data-no-print>
        {onBack ? (
          <Button onClick={onBack} aria-label={t('printPage.back')}>
            <Icon name="back" />
          </Button>
        ) : null}
        <Title>{t('printKitchen')}</Title>
        <Button variant="primary" onClick={print} disabled={menu === null || empty}>
          <Icon name="print" />
          {t('printPage.print')}
        </Button>
      </Head>
      <Controls data-no-print>
        {hasChefs ? (
          <Field>
            <label htmlFor="kitchen-print-chef">{t('chefFilter.label')}</label>
            <Pick
              id="kitchen-print-chef"
              value={options.chef}
              onChange={(event) => set({ chef: event.target.value })}
            >
              {choices.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </Pick>
          </Field>
        ) : null}
        <Field>
          <span>{t('group.label')}</span>
          <Segmented
            label={t('group.label')}
            options={groupOptions}
            value={options.groupBy}
            onChange={(groupBy) => set({ groupBy })}
          />
        </Field>
        <Ticks>
          <label>
            <input type="checkbox" {...tick('notes')} />
            {t('printPage.notes')}
          </label>
          <label>
            <input type="checkbox" {...tick('includePrivate')} />
            {t('printPage.private')}
          </label>
          {byChef ? (
            <label>
              <input type="checkbox" {...tick('pagePerChef')} />
              {t('printPage.pagePerChef')}
            </label>
          ) : null}
        </Ticks>
      </Controls>
      {menu === null ? (
        <Muted role="status" data-no-print>
          {t('loading')}
        </Muted>
      ) : null}
      {empty ? <Muted data-no-print>{t('printPage.empty')}</Muted> : null}
      {menu !== null && !empty ? <Muted data-no-print>{t('printPage.paperHint')}</Muted> : null}
      {menu !== null && !empty ? (
        <Pages data-print-area data-testid="kitchen-print-pages">
          <Sheet data-testid="kitchen-print-page">
            <PageHead>
              <div>
                <h2>{menu.kitchenName}</h2>
                <p>{t('printPage.menuFor', { day: formatDay(menu.cookingDate, lang) })}</p>
                <p data-testid="kitchen-print-set">
                  {options.chef === ALL_CHEFS
                    ? t('printPage.allChefs')
                    : t('printPage.chefLine', { name: chefName })}
                  {' · '}
                  {t('group.label')}: {t(`group.${options.groupBy === 'item' ? 'dish' : 'chef'}`)}
                </p>
              </div>
              <div>
                <p>{t('printPage.printedAt', { time: formatDayTime(printedAt, lang) })}</p>
              </div>
            </PageHead>
            {plan.sections.map((section) => (
              <Section key={section.key} $break={section.pageBreak}>
                {section.title !== null ? <GroupHead>{section.title}</GroupHead> : null}
                {section.rows.map((row) => (
                  <Row
                    key={row.itemId}
                    data-testid="kitchen-print-row"
                    data-choice={row.choice === true}
                    data-group={row.group === true}
                  >
                    <span className="tick" aria-hidden="true" />
                    <span className="qty">{row.qty}</span>
                    <span className="name">
                      {pickText(row.name, lang)}{' '}
                      <small>
                        {pickText(row.size, lang)}
                        {row.privateQty > 0
                          ? ` · ${t('printPage.privateCount', { count: row.privateQty })}`
                          : ''}
                      </small>
                    </span>
                    <span className="meta">
                      {[
                        row.pickup > 0 ? t('splitPickup', { count: row.pickup }) : null,
                        row.delivery > 0 ? t('splitDelivery', { count: row.delivery }) : null,
                      ]
                        .filter((part) => part !== null)
                        .join(' · ')}
                      {row.group ? null : <br />}
                      {row.group ? null : t('printPage.forPeople', { count: row.people })}
                    </span>
                    {row.lineNotes?.map((note) => (
                      <span className="lineNote" key={`${note.firstName}-${note.note}`}>
                        {t('printPage.lineNote', {
                          note: note.note,
                          who: note.choice
                            ? `${note.firstName}, ${pickText(note.choice, lang)}`
                            : note.firstName,
                        })}
                      </span>
                    ))}
                  </Row>
                ))}
              </Section>
            ))}
            {plan.notes.length > 0 ? (
              <NotesBlock data-testid="kitchen-print-notes">
                <h3>{t('notes', { count: plan.notes.length })}</h3>
                {plan.notes.map((note) => (
                  <p key={note.code}>
                    <span className="code">{note.code}</span> <b>{note.firstName}</b> · {note.note}
                  </p>
                ))}
              </NotesBlock>
            ) : null}
          </Sheet>
        </Pages>
      ) : null}
    </Wrap>
  );
}
