import { useCallback, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { CSV_BOM } from '../../../shared/csv';
import { parseBackupFile, type BackupFile } from '../../../shared/backup';
import type { Language } from '../../../shared/domain';
import { formatDay } from '../../../shared/dates';
import { exportBackup, fetchOrdersCsv, restoreBackup } from '../../api/client';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { Button, ConfirmButton, Icon } from '../../ui';
import {
  backupFileName,
  csvFileName,
  dateStamp,
  downloadBlob,
  lastBackupDate,
  readFileText,
  rememberBackup,
} from './download';
import { HISTORY_NS } from './i18n/register';

const Page = styled.main`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xl};
  max-width: 40rem;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.lg};
`;
const Title = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.xl};
`;
const Block = styled.section`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.sm};
  padding-top: ${({ theme }) => theme.spacing.lg};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
`;
const Sub = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.md};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
const Muted = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colour.textMuted};
`;
const Message = styled.p<{ $bad?: boolean }>`
  margin: 0;
  color: ${({ theme, $bad }) => ($bad ? theme.status.cancelled.fg : theme.colour.text)};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
const FileLabel = styled.label`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-height: ${({ theme }) => theme.minTapTarget};
  padding: 0 ${({ theme }) => theme.spacing.lg};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.outline};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colour.surface};
  font-weight: ${({ theme }) => theme.type.weight.strong};
  cursor: pointer;

  &:focus-within {
    outline: ${({ theme }) => theme.border.focus} solid ${({ theme }) => theme.colour.focus};
    outline-offset: ${({ theme }) => theme.border.focus};
  }
  input {
    position: absolute;
    width: ${({ theme }) => theme.border.hairline};
    height: ${({ theme }) => theme.border.hairline};
    opacity: 0;
  }
`;
const Counts = styled.ul`
  margin: 0;
  padding-left: ${({ theme }) => theme.spacing.xl};
`;

type Note = Readonly<{ text: string; bad: boolean }>;

/** Download backup / orders CSV and restore. Route-agnostic. */
export function BackupScreen({ embedded = false }: Readonly<{ embedded?: boolean }>) {
  const { t, i18n } = useTranslation(HISTORY_NS);
  const lang: Language = i18n.resolvedLanguage === 'id' ? 'id' : 'en';
  const slug = currentSellerSlug();
  const [last, setLast] = useState<string | null>(() => lastBackupDate(slug));
  const [note, setNote] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [restoreNote, setRestoreNote] = useState<Note | null>(null);

  const downloadJson = useCallback(async () => {
    setBusy(true);
    setNote(null);
    const result = await exportBackup(undefined, slug);
    setBusy(false);
    if (!result.ok) {
      setNote({ text: t('backup.downloadFailed'), bad: true });
      return;
    }
    const name = backupFileName(slug);
    downloadBlob(
      name,
      new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' }),
    );
    const today = dateStamp();
    rememberBackup(slug, today);
    setLast(today);
    setNote({ text: t('backup.downloaded', { name }), bad: false });
  }, [slug, t]);

  const downloadCsv = useCallback(async () => {
    setBusy(true);
    setNote(null);
    const result = await fetchOrdersCsv(undefined, slug);
    setBusy(false);
    if (!result.ok) {
      setNote({ text: t('backup.downloadFailed'), bad: true });
      return;
    }
    const name = csvFileName(slug);
    // Keep the BOM so Excel opens the file as UTF-8.
    const text = result.data.startsWith(CSV_BOM) ? result.data : `${CSV_BOM}${result.data}`;
    downloadBlob(name, new Blob([text], { type: 'text/csv;charset=utf-8' }));
    setNote({ text: t('backup.downloaded', { name }), bad: false });
  }, [slug, t]);

  const onFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const input = event.target;
      const file = input.files?.[0];
      setRestoreNote(null);
      setPending(null);
      if (!file) return;
      let parsed: BackupFile | null;
      try {
        parsed = parseBackupFile(JSON.parse(await readFileText(file)));
      } catch {
        parsed = null;
      }
      input.value = '';
      if (parsed) setPending(parsed);
      else setRestoreNote({ text: t('backup.readFailed'), bad: true });
    },
    [t],
  );

  const restore = useCallback(async () => {
    if (!pending) return;
    setBusy(true);
    const result = await restoreBackup(pending, undefined, slug);
    setBusy(false);
    if (result.ok) {
      setPending(null);
      setRestoreNote({ text: t('backup.restored'), bad: false });
    } else {
      setRestoreNote({
        text: t(result.error === 'invalid_backup' ? 'backup.invalid' : 'backup.restoreFailed'),
        bad: true,
      });
    }
  }, [pending, slug, t]);
  const discard = useCallback(() => {
    setPending(null);
    setRestoreNote(null);
  }, []);

  return (
    <Page>
      {embedded ? null : <Title>{t('backup.title')}</Title>}

      <Block>
        <Muted>
          {last ? t('backup.last', { date: formatDay(last, lang) }) : t('backup.never')}
        </Muted>
        <Button variant="primary" onClick={() => void downloadJson()} disabled={busy}>
          <Icon name="share" />
          {t('backup.download')}
        </Button>
        <Muted>{t('backup.downloadHelp')}</Muted>
        <Button onClick={() => void downloadCsv()} disabled={busy}>
          <Icon name="list" />
          {t('backup.csv')}
        </Button>
        <Muted>{t('backup.csvHelp')}</Muted>
        {note ? (
          <Message role="status" $bad={note.bad}>
            {note.text}
          </Message>
        ) : null}
      </Block>

      <Block>
        <Sub>{t('backup.restoreTitle')}</Sub>
        <Muted>{t('backup.restoreHelp')}</Muted>
        <FileLabel>
          <Icon name="box" />
          {t('backup.choose')}
          <input type="file" accept="application/json,.json" onChange={(e) => void onFile(e)} />
        </FileLabel>
        {pending ? (
          <>
            <Message>
              {t('backup.contains', {
                date: formatDay(pending.exportedAt, lang),
                name: pending.seller.name,
              })}
            </Message>
            <Counts>
              <li>{t('backup.count.orders', { count: pending.orders.length })}</li>
              <li>{t('backup.count.pastWeeks', { count: pending.pastWeeks.length })}</li>
              <li>{t('backup.count.items', { count: pending.items.length })}</li>
              <li>{t('backup.count.chefs', { count: pending.chefs.length })}</li>
              <li>{t('backup.count.sets', { count: pending.sets.length })}</li>
              {pending.pickupPlaces ? (
                <li>{t('backup.count.pickupPlaces', { count: pending.pickupPlaces.length })}</li>
              ) : null}
              {pending.dishes ? (
                <li>{t('backup.count.dishes', { count: pending.dishes.length })}</li>
              ) : null}
              {pending.dishSets ? (
                <li>{t('backup.count.dishSets', { count: pending.dishSets.length })}</li>
              ) : null}
            </Counts>
            <ConfirmButton
              variant="primary"
              label={t('backup.restore')}
              confirmLabel={t('backup.restoreConfirm')}
              onConfirm={() => void restore()}
              disabled={busy}
            />
            <Button variant="quiet" onClick={discard}>
              {t('backup.cancel')}
            </Button>
          </>
        ) : null}
        {restoreNote ? (
          <Message role={restoreNote.bad ? 'alert' : 'status'} $bad={restoreNote.bad}>
            {restoreNote.text}
          </Message>
        ) : null}
      </Block>
    </Page>
  );
}
