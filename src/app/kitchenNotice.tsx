import { useTranslation } from 'react-i18next';
import { Notice } from '../ui/Notice';
import { useSession } from './session';

// The notice slot of the seller shell (plan 032 stage 4): lines shown above the page for the whole
// kitchen, one per reason. Add a reason to `useKitchenNotices` (plan 031's "Viewing as admin" does)
// and it shows here; SellerLayout renders `<KitchenNotices />` once.

export type KitchenNotice = Readonly<{ id: string; text: string }>;

/** Every notice that applies to this session now, in the order they show. */
export function useKitchenNotices(): ReadonlyArray<KitchenNotice> {
  const { t } = useTranslation();
  const { me } = useSession();
  const notices: Array<KitchenNotice> = [];
  if (me?.paused === 'customers') {
    notices.push({ id: 'paused-customers', text: t('sellerNav.noticePausedCustomers') });
  }
  return notices;
}

export function KitchenNotices() {
  const notices = useKitchenNotices();
  return (
    <>
      {notices.map((notice) => (
        <Notice key={notice.id} tone="warn" layout="strip">
          {notice.text}
        </Notice>
      ))}
    </>
  );
}
