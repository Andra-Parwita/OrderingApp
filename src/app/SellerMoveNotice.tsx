import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchMemberships } from '../api/auth';
import { readEnvironment } from '../components/install/detect';
import { sellerKitchenOfSearch } from '../components/install/manifestLinks';
import { useSellerInstall } from '../components/install/useSellerInstall';
import {
  NoticeSlot,
  Pill,
  PillBody,
  PillButton,
  PillClose,
  PillLink,
} from '../components/notice/NoticePill';
import { TOP_BARS_VAR } from '../theme/screen';
import { useTopBar } from '../theme/topBars';
import { launchMemory } from './launchKitchen';
import { useSession } from './session';

// Plan 101 section 4: inside the old "Seller" app (id /seller) a person in 2 or more kitchens is told once
// per kitchen that it now has its own seller app. Install opens the same flow as the More row; Hide
// keeps it away for 30 days. The old app keeps working either way.

const OWN_VAR = '--move-notice-height';
const HIDE_KEY_PREFIX = 'nudge:sellerMove:';
const HIDE_MS = 30 * 24 * 60 * 60 * 1000;

export type MoveNoticeFacts = Readonly<{
  /** Running as an installed app. */
  standalone: boolean;
  /** `window.location.search` of this load. */
  search: string;
  /** The kitchen this window was launched for (sessionStorage), if any. */
  remembered: string | null;
  /** How many kitchens the person is on. */
  kitchens: number;
}>;

/** Only the old app (installed, no `k`, no remembered kitchen) and only for 2+ kitchens. */
export function moveNoticeDue(facts: MoveNoticeFacts): boolean {
  return (
    facts.standalone &&
    sellerKitchenOfSearch(facts.search) === undefined &&
    facts.remembered === null &&
    facts.kitchens >= 2
  );
}

function hiddenNow(slug: string, now: number): boolean {
  try {
    return now < Number(localStorage.getItem(HIDE_KEY_PREFIX + slug) ?? 0);
  } catch {
    return true; // no storage: it could not be hidden for good, so do not show
  }
}
function hide(slug: string, now: number): void {
  try {
    localStorage.setItem(HIDE_KEY_PREFIX + slug, String(now + HIDE_MS));
  } catch {
    // storage unavailable: the notice stays hidden anyway
  }
}

export function SellerMoveNotice({ now = () => Date.now() }: Readonly<{ now?: () => number }>) {
  const { t } = useTranslation();
  const { me } = useSession();
  const install = useSellerInstall();
  const [kitchens, setKitchens] = useState(0);
  const [closed, setClosed] = useState(false);
  const staff = me?.stage === 'full' && me.role !== 'admin';
  const slug = staff ? me.slug : undefined;
  const name = staff ? me.sellerName : undefined;
  useEffect(() => {
    if (slug === undefined) return undefined;
    let live = true;
    void fetchMemberships().then((result) => {
      if (live && result.ok) setKitchens(result.data.memberships.length);
    });
    return () => {
      live = false;
    };
  }, [slug]);
  const show =
    !closed &&
    slug !== undefined &&
    name !== undefined &&
    !hiddenNow(slug, now()) &&
    moveNoticeDue({
      standalone: readEnvironment().installed,
      search: window.location.search,
      remembered: launchMemory(),
      kitchens,
    });
  const bar = useRef<HTMLDivElement>(null);
  useTopBar('move-notice', bar, show, OWN_VAR);
  if (!show || slug === undefined || name === undefined) return null;
  const text = t('sellerLaunch.moveText', { name });
  return (
    <>
      <NoticeSlot
        ref={bar}
        role="region"
        aria-label={text}
        $top={`calc(var(${TOP_BARS_VAR}, 0rem) - var(${OWN_VAR}, 0rem))`}
        $z={995}
      >
        <Pill $kind="tip">
          <PillButton
            type="button"
            aria-label={`${text} ${t('sellerLaunch.moveInstall')}`}
            onClick={install.install}
          >
            <PillBody text={text} />
            <PillLink>{t('sellerLaunch.moveInstall')}</PillLink>
          </PillButton>
          <PillClose
            type="button"
            $kind="tip"
            aria-label={t('sellerLaunch.moveHide')}
            onClick={() => {
              hide(slug, now());
              setClosed(true);
            }}
          >
            ✕
          </PillClose>
        </Pill>
      </NoticeSlot>
      {install.overlay}
    </>
  );
}
