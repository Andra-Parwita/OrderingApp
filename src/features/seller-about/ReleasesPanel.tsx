import { useCallback, useEffect, useRef, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { keyframes, styled } from 'styled-components';
import { Icon } from '../../ui';
import { ABOUT_NS } from './i18n/register';
import { isNewRelease, visibleReleases, type ReleaseNote } from './releaseNotes';
import { TOP_BARS } from '../../theme/screen';

// Plan 075: the releases panel. From the right on a tablet (about a third of the width, the page
// dimmed behind it); the whole screen on a phone, with a back arrow. Escape and the dimmed area
// close it. Focus moves in and back with `preventScroll`: without it the browser scrolls the page
// behind to reveal the focused control, and the page slides instead of the panel.

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;
const fromRight = keyframes`
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 20;
`;
const Scrim = styled.div`
  position: absolute;
  inset: 0;
  background: ${({ theme }) => theme.colour.scrim};

  @media (prefers-reduced-motion: no-preference) {
    animation: ${fadeIn} 0.25s ease-out;
  }
`;
const Panel = styled.div<{ $wide: boolean }>`
  position: absolute;
  top: ${TOP_BARS};
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: ${({ $wide }) => ($wide ? 'clamp(22rem, 33vw, 32rem)' : '100%')};
  background: ${({ theme }) => theme.c.surf};
  border-left: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  color: ${({ theme }) => theme.c.text};

  &:focus {
    outline: none;
  }

  @media (prefers-reduced-motion: no-preference) {
    animation: ${fromRight} 0.25s ease;
  }
`;
const Head = styled.div`
  flex: none;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const Title = styled.h2`
  flex: 1;
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.lg};
`;
const Round = styled.button`
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${({ theme }) => theme.minTapTarget};
  height: ${({ theme }) => theme.minTapTarget};
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.c.surf2};
  }
  &:focus-visible {
    outline: ${({ theme }) => theme.border.focus} solid ${({ theme }) => theme.c.atext};
    outline-offset: ${({ theme }) => theme.border.focus};
  }
`;
const Body = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg}
    ${({ theme }) => theme.spacing.xl};
`;
const Release = styled.details`
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};

  &:first-child {
    border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  }
  summary {
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
    min-height: ${({ theme }) => theme.minTapTarget};
    padding: ${({ theme }) => theme.spacing.xs};
    list-style: none;
    cursor: pointer;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary:focus-visible {
    outline: ${({ theme }) => theme.border.focus} solid ${({ theme }) => theme.c.atext};
    outline-offset: -${({ theme }) => theme.border.focus};
  }
  summary svg {
    flex: none;
    width: 1rem;
    height: 1rem;
    color: ${({ theme }) => theme.c.muted};
    transition: transform ${({ theme }) => theme.motion.fast};
  }
  &[open] summary svg {
    transform: rotate(90deg);
  }
  ul {
    margin: 0 0 ${({ theme }) => theme.spacing.md};
    padding: 0 0 0 1.375rem;
    font-size: ${({ theme }) => theme.type.size.md};
  }
  li {
    margin: ${({ theme }) => theme.spacing.xs} 0;
    max-width: 62ch;
  }
`;
const Version = styled.span`
  font-family: ${({ theme }) => theme.font.mono};
  font-weight: 700;
`;
const When = styled.span`
  flex: 1;
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.sm};
`;
const Tag = styled.span`
  padding: 0 ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.c.tint};
  color: ${({ theme }) => theme.c.atext};
  font-size: 0.6875rem;
  font-weight: 600;
`;
const Foot = styled.p`
  margin: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xs} 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.sm};
`;

const FOCUSABLE = 'button:not(:disabled), summary';

/** "15 Oct 2026" in the app's language; a placeholder such as 2026-10-xx is shown as written. */
export function formatReleaseDate(date: string, lang: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : new Intl.DateTimeFormat(lang === 'id' ? 'id-ID' : 'en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(parsed);
}

export type ReleasesPanelProps = Readonly<{
  wide: boolean;
  onClose: () => void;
  /** Where focus goes when the panel closes. */
  returnFocus: () => HTMLElement | null;
  /** The releases to show; the real list by default. */
  releases?: ReadonlyArray<ReleaseNote>;
}>;

export function ReleasesPanel({ wide, onClose, returnFocus, releases }: ReleasesPanelProps) {
  const { t, i18n } = useTranslation(ABOUT_NS);
  const lang = i18n.language.startsWith('id') ? 'id' : 'en';
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const latestReturn = useRef(returnFocus);
  useEffect(() => {
    latestReturn.current = returnFocus;
  });

  useEffect(() => {
    closeButton.current?.focus({ preventScroll: true });
    return () => latestReturn.current()?.focus({ preventScroll: true });
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panel.current)) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    },
    [onClose],
  );

  const list = releases ?? visibleReleases();
  return createPortal(
    <Overlay>
      <Scrim onClick={onClose} data-testid="releases-scrim" />
      <Panel
        ref={panel}
        $wide={wide}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-releases-title"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <Head>
          {wide ? null : (
            <Round type="button" ref={closeButton} onClick={onClose} aria-label={t('close')}>
              <Icon name="back" />
            </Round>
          )}
          <Title id="about-releases-title">{t('releases')}</Title>
          {wide ? (
            <Round type="button" ref={closeButton} onClick={onClose} aria-label={t('close')}>
              <Icon name="x" />
            </Round>
          ) : null}
        </Head>
        <Body>
          {list.map((release, index) => (
            <Release key={release.version} open={index === 0}>
              <summary>
                <Version>{release.version}</Version>
                <When>{formatReleaseDate(release.date, lang)}</When>
                {index === 0 ? <Tag>{t('current')}</Tag> : null}
                {index === 0 && isNewRelease(release.date) ? <Tag>{t('newTag')}</Tag> : null}
                <Icon name="forward" />
              </summary>
              <ul>
                {release.lines[lang].map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </Release>
          ))}
          <Foot>{t('lastFive')}</Foot>
        </Body>
      </Panel>
    </Overlay>,
    document.body,
  );
}
