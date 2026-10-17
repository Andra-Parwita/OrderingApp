import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PHONE_CODE_LENGTH } from '../../../shared/customerContract';
import {
  joinWithPhoneCode,
  restoreWithPasskey,
  showPhoneCode,
} from '../../api/customer/rememberMe';
import { BottomSheet, Button, TextField } from '../../ui';
import { useRememberAction } from './hooks';
import { REMEMBER_NS } from './i18n/register';
import { Actions, Code, ErrorLine, Text } from './parts';

/** "Add another phone": a 6-digit code on the signed-in phone, valid 5 minutes. */
export function AddPhoneSheet({ onClose }: Readonly<{ onClose: () => void }>) {
  const { t } = useTranslation(REMEMBER_NS);
  const [code, setCode] = useState<{ code: string; expiresAt: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // One live code per customer: a newer request replaces the older on the server, so only the
  // newest answer may be shown (React StrictMode in dev, or a double tap, sends two).
  const latest = useRef(0);
  const make = useCallback(() => {
    latest.current += 1;
    const mine = latest.current;
    void showPhoneCode().then((result) => {
      if (mine !== latest.current) return;
      setFailed(!result.ok);
      if (result.ok) {
        setCode({ code: result.data.code, expiresAt: Date.parse(result.data.expiresAt) });
        setNow(Date.now());
      }
    });
  }, []);
  useEffect(make, [make]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);
  const left = code ? Math.max(0, Math.floor((code.expiresAt - now) / 1000)) : 0;
  const time = `${String(Math.floor(left / 60))}:${String(left % 60).padStart(2, '0')}`;
  return (
    <BottomSheet title={t('apT')} onClose={onClose}>
      <Text>{t('apP')}</Text>
      {code && left > 0 ? (
        <>
          <Code>{code.code}</Code>
          <Text role="timer">{t('valid', { time })}</Text>
        </>
      ) : code ? (
        <Text role="status">{t('expired')}</Text>
      ) : null}
      {failed ? <ErrorLine role="alert">{t('errFailed')}</ErrorLine> : null}
      <Actions>
        <Button fullWidth variant="secondary" onClick={make}>
          {t('newCode')}
        </Button>
        <Button fullWidth variant="quiet" onClick={onClose}>
          {t('close')}
        </Button>
      </Actions>
    </BottomSheet>
  );
}

/** A new phone: type the 6-digit code (or use a passkey instead). */
export function JoinSheet({ onClose }: Readonly<{ onClose: () => void }>) {
  const { t } = useTranslation(REMEMBER_NS);
  const { busy, error, run } = useRememberAction();
  const [code, setCode] = useState('');
  const ready = code.replace(/\D/g, '').length === PHONE_CODE_LENGTH;
  const done = (action: Parameters<typeof run>[0]) => {
    void run(action).then((outcome) => {
      if (outcome.ok) onClose();
    });
  };
  return (
    <BottomSheet title={t('joinT')} onClose={onClose}>
      <Text>{t('joinP')}</Text>
      <TextField
        label={t('typeCode')}
        value={code}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={PHONE_CODE_LENGTH + 1}
        onChange={(event) => {
          setCode(event.target.value);
        }}
      />
      {error ? <ErrorLine role="alert">{error}</ErrorLine> : null}
      <Actions>
        <Button
          fullWidth
          disabled={busy || !ready}
          onClick={() => {
            done(() => joinWithPhoneCode(code));
          }}
        >
          {busy ? t('working') : t('joinDo')}
        </Button>
        <Button
          fullWidth
          variant="secondary"
          disabled={busy}
          onClick={() => {
            done(restoreWithPasskey);
          }}
        >
          {t('usePasskey')}
        </Button>
      </Actions>
    </BottomSheet>
  );
}
