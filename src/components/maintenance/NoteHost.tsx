// Plan 086 (D-106): Bobo's short message. The admin sends a plain note (EN + ID); a device shows it
// once, for up to 30 seconds (or until the cross), then it fades. Sits right under any maintenance
// bar. Found on page open, and again at once when the live connection nudges (`app:notes`). Never a
// phone notification. The admin page itself never shows it.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styled, { css, keyframes } from 'styled-components';
import { MESSAGE_SHOW_MS, NOTE_NUDGE_EVENT, type PublicNote } from '../../../shared/shortMessage';
import type { Language } from '../../../shared/domain';
import { activeOrders } from '../../api/device/myOrders';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { fetchNotes } from '../../api/notes';
import { useTopBar } from '../../theme/topBars';
import { MAINTENANCE_NS } from './i18n/register';
import { NoticeSlot, Pill, PillBody, PillClose, PillRow } from '../notice/NoticePill';

export const SEEN_KEY = 'seenNotes';
export const FADE_MS = 600;

const slideIn = keyframes`
  from { transform: translateY(-100%); opacity: 0; }
  to { transform: none; opacity: 1; }
`;
const drain = keyframes`
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
`;
const Slot = styled(NoticeSlot)<{ $fading: boolean }>`
  opacity: ${({ $fading }) => ($fading ? 0 : 1)};
  transition: opacity ${FADE_MS}ms ease;
  @media (prefers-reduced-motion: no-preference) {
    animation: ${slideIn} 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;
const drainStyle = css`
  animation: ${drain} ${MESSAGE_SHOW_MS}ms linear forwards;
`;
const Line = styled.span`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: ${({ theme }) => theme.border.focus};
  background: ${({ theme }) => theme.c.fill};
  transform-origin: left;
  /* Reduced motion: no moving line, just the note and its 30 s. */
  @media (prefers-reduced-motion: reduce) {
    display: none;
  }
  @media (prefers-reduced-motion: no-preference) {
    ${drainStyle}
  }
`;

/** Ids this device has shown, with the time the message ends (so the list prunes itself). */
function readSeen(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}');
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}
function markSeen(note: PublicNote, now: number): void {
  try {
    const seen = readSeen();
    seen[note.id] = note.expiresAt;
    // A message that ended a day ago cannot come back: forget it.
    for (const [id, until] of Object.entries(seen)) {
      if (Date.parse(until) < now - 86_400_000) delete seen[id];
    }
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    // storage unavailable: the note may show again on a reload, which is harmless
  }
}

const RESERVED = new Set(['o', 'my-orders', 'settings', 'seller', 'admin']);

/** Which side this page is, and the kitchens it knows about. */
function whereAmI(pathname: string): {
  audience: 'sellers' | 'customers';
  kitchens: Array<string>;
} {
  if (pathname.startsWith('/seller')) {
    return { audience: 'sellers', kitchens: [currentSellerSlug()] };
  }
  const kitchens = new Set<string>();
  const first = pathname.split('/').filter(Boolean)[0];
  if (first && !RESERVED.has(first)) kitchens.add(first);
  try {
    for (const order of activeOrders()) kitchens.add(order.sellerSlug);
  } catch {
    // no saved orders to read
  }
  return { audience: 'customers', kitchens: [...kitchens] };
}

export type NoteHostProps = Readonly<{
  fetchImpl?: typeof fetch;
  now?: () => number;
  pathname?: () => string;
}>;

export function NoteHost({
  fetchImpl,
  now = () => Date.now(),
  pathname = () => window.location.pathname,
}: NoteHostProps) {
  const { t, i18n } = useTranslation(MAINTENANCE_NS);
  const lang: Language = i18n.resolvedLanguage === 'id' ? 'id' : 'en';
  const [note, setNote] = useState<PublicNote | null>(null);
  const [fading, setFading] = useState(false);
  const isAdmin = pathname().startsWith('/admin');
  const bar = useRef<HTMLDivElement>(null);
  // Plan 080: like the other top bars it pushes the page down while it shows, and lets go as it fades.
  useTopBar('note', bar, note !== null && !fading && !isAdmin);

  const look = useCallback(async () => {
    const place = whereAmI(pathname());
    const notes = await fetchNotes(place.audience, place.kitchens, fetchImpl);
    const seen = readSeen();
    const next = notes.find((n) => seen[n.id] === undefined && Date.parse(n.expiresAt) > now());
    if (!next) return;
    markSeen(next, now());
    setFading(false);
    // One at a time: a note that arrives while another is up waits for the next nudge or page open.
    setNote((current) => current ?? next);
  }, [fetchImpl, now, pathname]);

  useEffect(() => {
    if (isAdmin) return;
    // Calls that set state after a network round trip, started once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void look();
    const onNudge = () => void look();
    window.addEventListener(NOTE_NUDGE_EVENT, onNudge);
    return () => window.removeEventListener(NOTE_NUDGE_EVENT, onNudge);
  }, [isAdmin, look]);

  // 30 seconds up, then it fades and is gone.
  const id = note?.id;
  useEffect(() => {
    if (id === undefined) return;
    const fade = setTimeout(() => setFading(true), MESSAGE_SHOW_MS);
    const gone = setTimeout(() => setNote(null), MESSAGE_SHOW_MS + FADE_MS);
    return () => {
      clearTimeout(fade);
      clearTimeout(gone);
    };
  }, [id]);

  if (isAdmin || !note) return null;
  return (
    <Slot
      ref={bar}
      role="status"
      $fading={fading}
      $top="calc(var(--update-bar-height, 0rem) + var(--notice-bar-height, 0rem))"
      $z={997}
    >
      <Pill $kind="announce">
        <PillRow>
          <PillBody text={lang === 'id' ? note.textId : note.textEn} />
        </PillRow>
        <PillClose
          type="button"
          $kind="announce"
          aria-label={t('dismiss')}
          onClick={() => setNote(null)}
        >
          ✕
        </PillClose>
        <Line aria-hidden="true" />
      </Pill>
    </Slot>
  );
}
