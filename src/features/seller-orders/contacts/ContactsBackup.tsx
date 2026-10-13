import { useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { currentSellerSlug } from '../../../api/device/sellerContext';
import { Button } from '../../../ui';
import { SELLER_NS } from '../i18n/register';
import { backupStatus, listCustomers, putCustomers, useAddressBook } from './addressBook';
import { changeSummary, downloadBackup } from './backupFile';
import { parseCustomersCsv, planMerge, type MergePlan } from './customersCsv';

const Block = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Title = styled.h2`
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 700;
`;
const Muted = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.875rem;
`;
const Pair = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Hidden = styled.input`
  display: none;
`;

function shortDate(iso: string, lang: string): string {
  return new Date(iso).toLocaleDateString(lang, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Settings, Customer details (phone More and the tablet pane): how fresh the CSV backup is, a
 * download, and Upload CSV to add or update customers from a file (previewed first, never wipes).
 */
export function ContactsBackup() {
  const { t, i18n } = useTranslation(SELLER_NS);
  const slug = currentSellerSlug();
  useAddressBook(slug);
  const count = listCustomers(slug).length;
  const status = backupStatus(slug);
  const [message, setMessage] = useState<string | null>(null);
  const [plan, setPlan] = useState<MergePlan | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const summary = changeSummary(slug, t);
  let state: string;
  if (status.lastBackupAt === null) state = count === 0 ? '' : t('customers.never');
  else if (summary === '') {
    state = t('customers.upToDate', { date: shortDate(status.lastBackupAt, i18n.language) });
  } else state = t('customers.pending', { parts: summary });

  const onDownload = () => {
    setMessage(t('customers.downloaded', { name: downloadBackup(slug) }));
  };

  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    void file
      .text()
      .then((text) => {
        const rows = parseCustomersCsv(text);
        setMessage(rows === null ? t('customers.badFile') : null);
        setPlan(rows === null ? null : planMerge(listCustomers(slug), rows));
      })
      .catch(() => setMessage(t('customers.badFile')));
  };

  const onApply = () => {
    if (!plan) return;
    putCustomers(slug, plan.customers);
    setMessage(t('customers.applied', plan.counts));
    setPlan(null);
  };

  return (
    <Block aria-label={t('customers.title')}>
      <Title>{t('customers.title')}</Title>
      <Muted>{t('customers.help')}</Muted>
      <Muted>{t('customers.count', { count })}</Muted>
      {state ? <Muted role="status">{state}</Muted> : null}
      <Pair>
        <Button onClick={onDownload}>{t('customers.download')}</Button>
        <Button onClick={() => picker.current?.click()}>{t('customers.upload')}</Button>
      </Pair>
      <Muted>{t('customers.private')}</Muted>
      <Hidden
        ref={picker}
        type="file"
        accept=".csv,text/csv"
        aria-label={t('customers.upload')}
        onChange={onPick}
      />
      {plan ? (
        <>
          <Muted role="status">{t('customers.preview', plan.counts)}</Muted>
          <Pair>
            <Button onClick={onApply} disabled={plan.customers.length === 0}>
              {t('customers.apply')}
            </Button>
            <Button onClick={() => setPlan(null)}>{t('customers.cancel')}</Button>
          </Pair>
        </>
      ) : null}
      {message ? <Muted role="status">{message}</Muted> : null}
    </Block>
  );
}
