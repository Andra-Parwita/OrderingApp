import { useCallback, useState } from 'react';
import type { Language } from '../../../shared/domain';
import { lastKitchen } from '../../api/device/lastKitchen';
import type { MenuNoticeControl } from './MenuNoticeRow';
import {
  menuNoticeOn,
  turnOffMenuNotice,
  turnOnMenuNotice,
} from '../../components/install/menuNoticeDevice';

/**
 * The Settings option for the kitchen this phone last visited. Absent (undefined) when no kitchen is
 * known, so the row is hidden.
 */
export function useMenuNotice(
  kitchenName: string | undefined,
  lang: Language,
): MenuNoticeControl | undefined {
  const slug = lastKitchen();
  const [on, setOn] = useState(() => (slug === null ? false : menuNoticeOn(slug)));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<MenuNoticeControl['problem']>(null);
  const onTurnOn = useCallback(() => {
    if (slug === null) return;
    setBusy(true);
    setProblem(null);
    void turnOnMenuNotice(slug, lang).then((result) => {
      setOn(result === 'ok');
      setProblem(result === 'ok' ? null : result);
      setBusy(false);
    });
  }, [slug, lang]);
  const onTurnOff = useCallback(() => {
    if (slug === null) return;
    setBusy(true);
    setProblem(null);
    void turnOffMenuNotice(slug).then((done) => {
      if (done) setOn(false);
      else setProblem('failed');
      setBusy(false);
    });
  }, [slug]);
  if (slug === null || kitchenName === undefined) return undefined;
  return { kitchenName, on, busy, problem, onTurnOn, onTurnOff };
}
