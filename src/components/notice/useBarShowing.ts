import { useEffect, useState } from 'react';
import { TOP_BARS_VAR } from '../../theme/screen';

const showing = (): boolean =>
  Number.parseFloat(document.documentElement.style.getPropertyValue(TOP_BARS_VAR)) > 0;

/** Whether an update, maintenance, announcement or offline bar is up (plan 096: one nudge at a time). */
export function useBarShowing(): boolean {
  const [up, setUp] = useState(showing);
  useEffect(() => {
    const watch = new MutationObserver(() => setUp(showing()));
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    return () => watch.disconnect();
  }, []);
  return up;
}
