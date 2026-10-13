// Plan 074: how often the apps check for news while their live connection is down. One value for
// customers, one for sellers (minutes, 1 to 30, default 5). Admin only, like the page.
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BACKUP_MINUTES_MAX,
  BACKUP_MINUTES_MIN,
  type BackupMinutes,
} from '../../../shared/maintenance';
import { fetchBackupMinutes, saveBackupMinutes } from '../../api/auth';
import { Button, TextField } from '../../ui';
import { ADMIN_NS } from './i18n/register';
import { failureText, FormSection, Message, Muted, Row, Section, Sub } from './shared';

function inBounds(text: string): boolean {
  const value = Number(text);
  return Number.isInteger(value) && value >= BACKUP_MINUTES_MIN && value <= BACKUP_MINUTES_MAX;
}

export function BackupMinutesPanel() {
  const { t } = useTranslation(ADMIN_NS);
  const [saved, setSaved] = useState<BackupMinutes | null>(null);
  const [customer, setCustomer] = useState('5');
  const [seller, setSeller] = useState('5');
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let live = true;
    void fetchBackupMinutes().then((result) => {
      if (!live || !result.ok) return;
      setSaved(result.data);
      setCustomer(String(result.data.customer));
      setSeller(String(result.data.seller));
    });
    return () => {
      live = false;
    };
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setDone(false);
    if (!inBounds(customer) || !inBounds(seller)) {
      setProblem(t('home.backup.bad', { min: BACKUP_MINUTES_MIN, max: BACKUP_MINUTES_MAX }));
      return;
    }
    setProblem(null);
    const result = await saveBackupMinutes({ customer: Number(customer), seller: Number(seller) });
    if (result.ok) {
      setSaved(result.data);
      setDone(true);
    } else setProblem(failureText(t, result));
  }

  // Nothing until the admin-only call answers.
  if (!saved) return null;
  return (
    <Section>
      <Sub>{t('home.backup.title')}</Sub>
      <Muted>{t('home.backup.text')}</Muted>
      <FormSection noValidate onSubmit={(event) => void save(event)}>
        <Row>
          <TextField
            label={t('home.backup.customers')}
            type="number"
            inputMode="numeric"
            min={BACKUP_MINUTES_MIN}
            max={BACKUP_MINUTES_MAX}
            value={customer}
            onChange={(event) => setCustomer(event.target.value)}
          />
          <TextField
            label={t('home.backup.sellers')}
            type="number"
            inputMode="numeric"
            min={BACKUP_MINUTES_MIN}
            max={BACKUP_MINUTES_MAX}
            value={seller}
            onChange={(event) => setSeller(event.target.value)}
          />
        </Row>
        <Row>
          <Button type="submit">{t('home.backup.save')}</Button>
        </Row>
      </FormSection>
      {done ? <Muted role="status">{t('home.backup.saved')}</Muted> : null}
      {problem ? (
        <Message $bad role="alert">
          {problem}
        </Message>
      ) : null}
    </Section>
  );
}
