// "A new version is ready" bar (plan 059). Muted, at the top; it never reloads by itself, so nothing
// typed is lost. Refresh reloads; the cross hides it until the next check.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';
import { UPDATE_NS } from './i18n/register';
import { UPDATE_BAR_HEIGHT_VAR, watchForUpdate, type WatchOptions } from './updateCheck';

const Bar = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: calc(${({ theme }) => theme.spacing.xs} + env(safe-area-inset-top))
    ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xs};
  background: ${({ theme }) => theme.c.surf2};
  color: ${({ theme }) => theme.c.text};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  font-family: ${({ theme }) => theme.font.ui};
  font-size: ${({ theme }) => theme.type.size.sm};
`;

const Button = styled.button`
  min-height: ${({ theme }) => theme.spacing.xxl};
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: 0;
  border-radius: ${({ theme }) => theme.radius.md};
  background: transparent;
  color: ${({ theme }) => theme.c.atext};
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  &:focus-visible {
    outline: ${({ theme }) => theme.border.focus} solid ${({ theme }) => theme.c.fill};
    outline-offset: ${({ theme }) => theme.border.focus};
  }
`;

const Close = styled(Button)`
  color: ${({ theme }) => theme.c.muted};
  min-width: ${({ theme }) => theme.spacing.xxl};
  padding: 0;
`;

export function UpdateBar({
  watch,
  reload = () => window.location.reload(),
}: {
  watch?: WatchOptions;
  reload?: () => void;
}) {
  const { t } = useTranslation(UPDATE_NS);
  const [newer, setNewer] = useState(false);
  // Every check sets the state again, so a hidden bar comes back at the next check.
  useEffect(() => watchForUpdate(setNewer, watch), [watch]);
  // The offline banner (plan 062) sits below this bar: it reads the bar's height from this variable.
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = document.documentElement;
    if (newer && bar.current)
      root.style.setProperty(UPDATE_BAR_HEIGHT_VAR, `${bar.current.offsetHeight}px`);
    return () => {
      root.style.removeProperty(UPDATE_BAR_HEIGHT_VAR);
    };
  }, [newer]);
  if (!newer) return null;
  return (
    <Bar ref={bar} role="status">
      <span>{t('message')} ·</span>
      <Button type="button" onClick={reload}>
        {t('refresh')}
      </Button>
      <Close type="button" aria-label={t('dismiss')} onClick={() => setNewer(false)}>
        ✕
      </Close>
    </Bar>
  );
}
