import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import {
  parseLocal,
  rememberMeSnapshot,
  watchRememberMe,
  type RememberMeLocal,
} from '../../api/customer/state';
import type { RememberOutcome } from '../../api/customer/rememberMe';
import { REMEMBER_NS } from './i18n/register';

/** This phone's Remember me state, live. Null = off. */
export function useRememberMeLocal(): RememberMeLocal | null {
  return parseLocal(useSyncExternalStore(watchRememberMe, rememberMeSnapshot));
}

type Failure = Extract<RememberOutcome, { ok: false }>;

const ERROR_KEY: Record<Failure['error'], string> = {
  cancelled: 'errCancelled',
  exists: 'errExists',
  failed: 'errFailed',
  network: 'errNetwork',
  other_kind: 'errOtherKind',
  bad_code: 'errBadCode',
  locked: 'errLocked',
};

/** Runs one Remember me action: tracks "working" and turns a failure into a friendly line. */
export function useRememberAction() {
  const { t } = useTranslation(REMEMBER_NS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(
    async (action: () => Promise<RememberOutcome>): Promise<RememberOutcome> => {
      setBusy(true);
      setError(null);
      const outcome = await action();
      setBusy(false);
      if (!outcome.ok) {
        setError(
          outcome.error === 'bad_code' && outcome.triesLeft !== undefined
            ? t('errBadCodeTries', { count: outcome.triesLeft })
            : t(ERROR_KEY[outcome.error]),
        );
      }
      return outcome;
    },
    [t],
  );
  return { busy, error, run, clear: () => setError(null) };
}

/** Whether this phone's passkeys can seal the address (PRF). Null = the browser cannot say. */
export function usePrfSupport(): boolean | null {
  const [support, setSupport] = useState<boolean | null>(null);
  useEffect(() => {
    const api = typeof PublicKeyCredential === 'undefined' ? undefined : PublicKeyCredential;
    const ask = (
      api as { getClientCapabilities?: () => Promise<Record<string, boolean>> } | undefined
    )?.getClientCapabilities;
    if (!ask) return;
    void ask
      .call(api)
      .then((capabilities) => {
        const prf = capabilities['extension:prf'];
        setSupport(typeof prf === 'boolean' ? prf : null);
      })
      .catch(() => undefined);
  }, []);
  return support;
}
