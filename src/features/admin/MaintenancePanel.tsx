// Plan 046: "Announce an update" (date, start, minutes, a note per language) and Maintenance on/off.
// Admin only (the page is). The notice reaches every screen; "on" shows the Updating screen and the
// server refuses changes.
import { useEffect, useState, type FormEvent } from 'react';
import { styled } from 'styled-components';
import { useTranslation } from 'react-i18next';
import type { Language } from '../../../shared/domain';
import { cutoffAtFor, formatDayTime, localDate } from '../../../shared/dates';

import { deviceZone, zoneCity } from '../../../shared/zone';
import { NOTICE_NOTE_MAX, type MaintenanceState } from '../../../shared/maintenance';
import { fetchMaintenance, saveMaintenance } from '../../api/auth';
import { Button, ConfirmButton, TextField } from '../../ui';
import { ADMIN_NS } from './i18n/register';
import { failureText, FormSection, Message, Muted, Row, Section, Sub } from './shared';

const Notes = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
  align-self: stretch;
`;
const Wide = styled(FormSection)`
  align-self: stretch;
  max-width: 48rem;
`;

const MINUTE = 60_000;
const LENGTH_MAX = 240;

/** `onActive` tells the menu whether a notice is set or maintenance is on (plan 078). */
export function MaintenancePanel({ onActive }: Readonly<{ onActive?: (active: boolean) => void }>) {
  const { t, i18n } = useTranslation(ADMIN_NS);
  const lang: Language = i18n.resolvedLanguage === 'id' ? 'id' : 'en';
  const [state, setState] = useState<MaintenanceState | null>(null);
  const [date, setDate] = useState(() => localDate(new Date(), deviceZone()));
  const [start, setStart] = useState('22:00');
  const [minutes, setMinutes] = useState('15');
  const [noteEn, setNoteEn] = useState('');
  const [noteId, setNoteId] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void fetchMaintenance().then((result) => {
      if (live && result.ok) setState(result.data);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (state) onActive?.(state.maintenance || state.notice !== null);
  }, [state, onActive]);

  async function save(patch: Parameters<typeof saveMaintenance>[0]) {
    setProblem(null);
    const result = await saveMaintenance(patch);
    if (result.ok) setState(result.data);
    else setProblem(failureText(t, result));
  }

  function announce(event: FormEvent) {
    event.preventDefault();
    const length = Number(minutes);
    if (!Number.isInteger(length) || length < 1 || length > LENGTH_MAX) {
      setProblem(t('home.maintenance.badLength'));
      return;
    }
    const from = new Date(cutoffAtFor(date, 0, start, deviceZone())).toISOString();
    const until = new Date(Date.parse(from) + length * MINUTE).toISOString();
    void save({ notice: { from, until, noteEn: noteEn.trim(), noteId: noteId.trim() } });
  }

  // Nothing until the admin-only call answers: anyone else never sees these controls.
  if (!state) return null;
  const on = state.maintenance;
  const notice = state.notice;
  return (
    <Section>
      <Sub>{t('home.maintenance.title')}</Sub>
      <Muted>{t('home.maintenance.text', { zone: zoneCity(deviceZone()) })}</Muted>
      <Wide onSubmit={announce}>
        <Row>
          <TextField
            label={t('home.maintenance.date')}
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <TextField
            label={t('home.maintenance.start')}
            type="time"
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
          <TextField
            label={t('home.maintenance.length')}
            type="number"
            inputMode="numeric"
            min={1}
            max={LENGTH_MAX}
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
          />
        </Row>
        <Notes>
          <TextField
            label={t('home.maintenance.noteEn')}
            value={noteEn}
            maxLength={NOTICE_NOTE_MAX}
            onChange={(event) => setNoteEn(event.target.value)}
          />
          <TextField
            label={t('home.maintenance.noteId')}
            value={noteId}
            maxLength={NOTICE_NOTE_MAX}
            onChange={(event) => setNoteId(event.target.value)}
          />
        </Notes>
        <Row>
          <Button type="submit">{t('home.maintenance.announce')}</Button>
          {notice ? (
            <Button type="button" variant="secondary" onClick={() => void save({ notice: null })}>
              {t('home.maintenance.clear')}
            </Button>
          ) : null}
        </Row>
      </Wide>
      <Muted>
        {notice
          ? t('home.maintenance.announced', {
              when: formatDayTime(notice.from, lang),
              minutes: Math.round((Date.parse(notice.until) - Date.parse(notice.from)) / MINUTE),
            })
          : t('home.maintenance.none')}
      </Muted>
      <Sub>{t('home.maintenance.modeTitle')}</Sub>
      <Muted>{on ? t('home.maintenance.modeOn') : t('home.maintenance.modeOff')}</Muted>
      {on ? (
        <Button type="button" onClick={() => void save({ maintenance: false })}>
          {t('home.maintenance.turnOff')}
        </Button>
      ) : (
        <ConfirmButton
          label={t('home.maintenance.turnOn')}
          confirmLabel={t('home.maintenance.turnOnConfirm')}
          onConfirm={() => void save({ maintenance: true })}
        />
      )}
      {problem ? (
        <Message $bad role="alert">
          {problem}
        </Message>
      ) : null}
    </Section>
  );
}
