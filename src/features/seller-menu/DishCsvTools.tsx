import { useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { styled } from 'styled-components';
import { dishTemplateCsv, dishesToCsv, parseDishCsv } from '../../../shared/dishCsv';
import type { Chef } from '../../../shared/domain';
import type { Dish, ImportDishRow, ImportProblem } from '../../../shared/menusContract';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { importDishes } from '../../api/menus';
import { Button, SlideOver } from '../../ui';
import { MENU_NS } from './i18n/register';
import { ErrorText, Muted } from './menuShared';
import { loadRequested } from './menuSlice';

// Plan 050 stage 3: Import (file, preview, apply), Export CSV and Download template for the dish
// library. The file is read here; the server previews and applies the rows.

const Bar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;
const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
`;
const Heading = styled.h2`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
`;
const Counts = styled.p`
  margin: 0;
  font-weight: 600;
`;
const List = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
`;
const Line = styled.li<{ $bad: boolean }>`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  color: ${({ $bad, theme }) => ($bad ? theme.c.danger : theme.c.text)};

  .name {
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .state {
    font-size: 0.8125rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .why {
    grid-column: 1 / -1;
    font-size: 0.8125rem;
  }
`;

type Shown = { key: string; name: string; status: 'new' | 'update' | 'error'; why?: ImportProblem };
type Preview = {
  rows: Array<ImportDishRow>;
  shown: Array<Shown>;
  counts: { new: number; update: number; error: number };
  overLimit: boolean;
};

function save(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const readText = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsText(file);
  });

export function DishCsvTools({
  dishes,
  chefs,
}: Readonly<{ dishes: ReadonlyArray<Dish>; chefs: ReadonlyArray<Chef> }>) {
  const { t } = useTranslation(MENU_NS);
  const dispatch = useDispatch();
  const picker = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [fileProblem, setFileProblem] = useState<ImportProblem | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const open = preview !== null || fileProblem !== null || failure !== null;

  const close = () => {
    setPreview(null);
    setFileProblem(null);
    setFailure(null);
  };
  const reason = (problem: ImportProblem) =>
    t(`import.problem.${problem.code}`, { defaultValue: problem.message });

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setDone(null);
    setFailure(null);
    const parsed = parseDishCsv(
      await readText(file),
      chefs.map((chef) => chef.name),
    );
    if (parsed.fileProblem) {
      setFileProblem(parsed.fileProblem);
      return;
    }
    const rows = parsed.lines.flatMap((line) => (line.row ? [line.row] : []));
    setBusy(true);
    const result = await importDishes({ rows, apply: false }, undefined, currentSellerSlug());
    setBusy(false);
    if (!result.ok) {
      setFailure(t('import.failed'));
      return;
    }
    const server = result.data.rows;
    let next = 0;
    const shown = parsed.lines.map((line): Shown => {
      if (line.problem) {
        return {
          key: String(line.line),
          name: `#${String(line.line)}`,
          status: 'error',
          why: line.problem,
        };
      }
      const answer = server[next];
      next += 1;
      return {
        key: String(line.line),
        name: answer?.name ?? line.row?.nameEn ?? '',
        status: answer?.status ?? 'error',
        ...(answer?.problem ? { why: answer.problem } : {}),
      };
    });
    const clientErrors = parsed.lines.length - rows.length;
    setPreview({
      rows,
      shown,
      counts: { ...result.data.counts, error: result.data.counts.error + clientErrors },
      overLimit: result.data.overLimit,
    });
  };

  const apply = async () => {
    if (!preview) return;
    setBusy(true);
    const result = await importDishes(
      { rows: preview.rows, apply: true },
      undefined,
      currentSellerSlug(),
    );
    setBusy(false);
    if (!result.ok) {
      setFailure(result.error === 'limit_reached' ? t('import.overLimit') : t('import.failed'));
      return;
    }
    setDone(t('import.done', { new: result.data.counts.new, update: result.data.counts.update }));
    close();
    dispatch(loadRequested());
  };

  const canApply =
    preview !== null && !preview.overLimit && preview.counts.new + preview.counts.update > 0;
  return (
    <>
      <Bar>
        <Button disabled={busy} onClick={() => picker.current?.click()}>
          {t('import.button')}
        </Button>
        <Button onClick={() => save('dishes.csv', dishesToCsv(dishes, chefs))}>
          {t('import.export')}
        </Button>
        <Button onClick={() => save('dishes-template.csv', dishTemplateCsv())}>
          {t('import.template')}
        </Button>
        <input
          ref={picker}
          type="file"
          accept=".csv,text/csv"
          hidden
          aria-label={t('import.file')}
          onChange={(event) => void onFile(event)}
        />
      </Bar>
      {done ? <Muted role="status">{done}</Muted> : null}
      {open ? (
        <SlideOver
          label={t('import.title')}
          closeLabel={t('import.close')}
          onClose={close}
          width="40rem"
          footer={
            <>
              <Button onClick={close}>{t('import.cancel')}</Button>
              {preview ? (
                <Button variant="primary" disabled={busy || !canApply} onClick={() => void apply()}>
                  {t('import.apply')}
                </Button>
              ) : null}
            </>
          }
        >
          <Body>
            <Heading>{t('import.title')}</Heading>
            {fileProblem ? <ErrorText role="alert">{reason(fileProblem)}</ErrorText> : null}
            {failure ? <ErrorText role="alert">{failure}</ErrorText> : null}
            {preview ? (
              <>
                <Counts>
                  {t('import.counts', {
                    new: preview.counts.new,
                    update: preview.counts.update,
                    error: preview.counts.error,
                  })}
                </Counts>
                {preview.overLimit ? (
                  <ErrorText role="alert">{t('import.overLimit')}</ErrorText>
                ) : null}
                {preview.counts.error > 0 ? <Muted>{t('import.skipped')}</Muted> : null}
                <List>
                  {preview.shown.map((row) => (
                    <Line key={row.key} $bad={row.status === 'error'}>
                      <span className="name">{row.name}</span>
                      <span className="state">{t(`import.status.${row.status}`)}</span>
                      {row.why ? <span className="why">{reason(row.why)}</span> : null}
                    </Line>
                  ))}
                </List>
              </>
            ) : null}
          </Body>
        </SlideOver>
      ) : null}
    </>
  );
}
