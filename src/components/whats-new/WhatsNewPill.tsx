// Plan 117: after an update the seller app shows this floating pill once per release on each device:
// "What's new in 1.0.43: <first note line>", a See link and a cross. Either one marks the release
// seen (remembered on the device, one key per version). The "new version" pill comes first, so this
// one stays away while it shows. If the device cannot store anything, the pill never shows.
import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { NoticeSlot, Pill, PillBody, PillButton, PillClose, PillLink } from '../notice/NoticePill';
import { useTopBar } from '../../theme/topBars';
import { TOP_BARS_VAR } from '../../theme/screen';

export const WHATS_NEW_KEY_PREFIX = 'whatsNewSeen:';
const OWN_VAR = '--whats-new-height';
const UPDATE_VAR = '--update-bar-height';

function wasSeen(version: string): boolean {
  try {
    return localStorage.getItem(WHATS_NEW_KEY_PREFIX + version) !== null;
  } catch {
    return true; // no storage: do not show (it could not be dismissed for good)
  }
}
function markSeen(version: string): void {
  try {
    localStorage.setItem(WHATS_NEW_KEY_PREFIX + version, '1');
  } catch {
    // storage unavailable: the pill stays hidden anyway
  }
}

/** True while the "new version" pill shows (it lives in its own root and reports its height). */
function useUpdateBarShowing(): boolean {
  const read = () => document.documentElement.style.getPropertyValue(UPDATE_VAR) !== '';
  const [showing, setShowing] = useState(read);
  useEffect(() => {
    const watch = new MutationObserver(() => setShowing(read()));
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    return () => watch.disconnect();
  }, []);
  return showing;
}

const Lead = styled.b`
  font-weight: 700;
`;

export type WhatsNewPillProps = Readonly<{
  version: string;
  /** The first note line of this release, in the app's language. */
  note: string;
  /** "What's new in 1.0.43:" */
  title: string;
  see: string;
  hide: string;
  onSee: () => void;
}>;

export function WhatsNewPill({ version, note, title, see, hide, onSee }: WhatsNewPillProps) {
  const [seen, setSeen] = useState(() => wasSeen(version));
  const updateShowing = useUpdateBarShowing();
  const bar = useRef<HTMLDivElement>(null);
  const visible = !seen && !updateShowing;
  useTopBar('whatsnew', bar, visible, OWN_VAR);
  if (!visible) return null;
  const finish = () => {
    markSeen(version);
    setSeen(true);
  };
  const text = `${title} ${note}`;
  return (
    <NoticeSlot
      ref={bar}
      // A region, not a live status: it is there on load, and the page's own status messages stay unique.
      role="region"
      aria-label={title}
      // Under every other top bar: their sum, less this pill's own height.
      $top={`calc(var(${TOP_BARS_VAR}, 0rem) - var(${OWN_VAR}, 0rem))`}
      $z={996}
    >
      <Pill $kind="tip">
        <PillButton
          type="button"
          aria-label={`${text} ${see}`}
          onClick={() => {
            finish();
            onSee();
          }}
        >
          <PillBody text={text}>
            <Lead>{title}</Lead> {note}
          </PillBody>
          <PillLink>{see}</PillLink>
        </PillButton>
        <PillClose type="button" $kind="tip" aria-label={hide} onClick={finish}>
          ✕
        </PillClose>
      </Pill>
    </NoticeSlot>
  );
}
