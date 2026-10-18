import { useCallback, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { styled } from 'styled-components';
import { useMediaQuery } from '../components/useMediaQuery';
import { useSellerInstall } from '../components/install';
import { ABOUT_NS } from '../features/seller-about';
import { HELP_NS } from '../features/seller-help';
import { ContactsBackup, PhoneLanguageRow, PhoneMoreNote } from '../features/seller-orders';
import { PRIVATE_NS, usePrivateDue } from '../features/seller-private';
import { paneHref, type PaneId } from '../features/seller-settings';
import { Button, ListRow, PageHeader } from '../ui';
import { DESKTOP_QUERY } from './layout';
import { KitchenSwitcher } from './KitchenSwitcher';
import { useSession } from './session';
import { MoreSwitchPerson } from './SwitchPerson';

const MoreBlock = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md};
  padding-top: ${({ theme }) => theme.spacing.lg};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
`;
// The sign-out button at the foot of More: padded on every side so it clears the tab bar.
const SignOutBlock = styled(MoreBlock)`
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.lg}
    ${({ theme }) => theme.spacing.xl};
`;
const PhoneBlocks = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xl};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.size.pagePadPhone}px
    ${({ theme }) => theme.spacing.xl};
`;

/** An old settings route: the owner goes to the pane that now holds it. */
export function ToPane({ pane }: Readonly<{ pane: PaneId }>) {
  return <Navigate to={paneHref(pane)} replace />;
}

/** A seller page opened from More: the screen under a header whose back arrow returns to More. */
export function MorePage({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const back = useCallback(() => void navigate('/seller/more'), [navigate]);
  return (
    <>
      <PageHeader title={title} titleHidden backLabel={t('sellerNav.backToMore')} onBack={back} />
      {children}
    </>
  );
}
const MORE_LINKS = [
  ['settings', '/seller/settings'],
  ['weekSettings', '/seller/week'],
  ['images', '/seller/images'],
  ['chefs', '/seller/chefs'],
  ['labels', '/seller/labels'],
  ['pastWeeks', '/seller/past-weeks'],
  ['backup', '/seller/backup'],
  ['shareMenu', '/seller/share'],
  ['devices', '/seller/devices'],
] as const;
// Phone: Kitchen and Labels are reached from More (plan 035); the rest is tablet-only.
const PHONE_LINKS = [
  ['dishes', '/seller/menu/dishes'],
  ['private', '/seller/private'],
  ['kitchen', '/seller/cook'],
  ['sell', '/seller/sell'],
  ['labels', '/seller/labels'],
  ['printOrders', '/seller/orders/print'],
  ['devices', '/seller/devices'],
  ['help', '/seller/help'],
  ['about', '/seller/about'],
] as const;
// What the server closes to a chef (D-013); the chef does not see these.
const CHEF_HIDDEN: ReadonlySet<string> = new Set([
  'settings',
  'weekSettings',
  'images',
  'chefs',
  'backup',
]);

/** The phone's More tab. On a tablet the owner's More is Settings (chefs have no Settings and keep More). */
export function MoreRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { me, end } = useSession();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const sellerInstall = useSellerInstall();
  const due = usePrivateDue();
  const helper = me?.role === 'helper';
  const links = MORE_LINKS.filter(([key]) =>
    helper
      ? key === 'devices'
      : (me?.role !== 'chef' || !CHEF_HIDDEN.has(key)) && (key !== 'devices' || me !== null),
  );
  const signOutNow = useCallback(async () => {
    await end();
    void navigate('/seller/sign-in', { replace: true });
  }, [end, navigate]);
  if (desktop && me?.role !== 'chef' && !helper) return <ToPane pane="kitchen" />;
  // Phone: Switch person, language, sign out, where the rest lives, and the contacts on this phone.
  if (!desktop) {
    return (
      <>
        <PageHeader title={t('sellerNav.moreTitle')} />
        <nav aria-label={t('sellerNav.moreTitle')}>
          {PHONE_LINKS.filter(([key]) =>
            helper
              ? key === 'sell' ||
                key === 'private' ||
                key === 'devices' ||
                key === 'help' ||
                key === 'about'
              : me?.role !== 'chef' || key !== 'sell',
          ).map(([key, to]) => (
            <ListRow
              key={key}
              primary={
                key === 'help'
                  ? t('nav', { ns: HELP_NS })
                  : key === 'about'
                    ? t('nav', { ns: ABOUT_NS })
                    : key === 'private'
                      ? t('nav', { ns: PRIVATE_NS })
                      : t(`sellerNav.${key}`)
              }
              {...(key === 'private' && due.today + due.tomorrow > 0
                ? {
                    secondary: t('dueSoon', {
                      ns: PRIVATE_NS,
                      today: due.today,
                      tomorrow: due.tomorrow,
                    }),
                  }
                : {})}
              trailing={
                key === 'private' && due.today + due.tomorrow > 0
                  ? `${due.today + due.tomorrow} ›`
                  : '›'
              }
              onClick={() =>
                void navigate(key === 'dishes' && me?.role === 'chef' ? '/seller/menu' : to)
              }
            />
          ))}
          {sellerInstall.available ? (
            <ListRow
              primary={sellerInstall.title}
              secondary={sellerInstall.sub}
              onClick={sellerInstall.install}
            />
          ) : null}
        </nav>
        {sellerInstall.overlay}
        <PhoneBlocks>
          <KitchenSwitcher />
          <MoreSwitchPerson />
          <PhoneLanguageRow />
          {me === null ? null : (
            <Button fullWidth onClick={() => void signOutNow()}>
              {t('sellerNav.signOut')}
            </Button>
          )}
          <PhoneMoreNote />
          <ContactsBackup />
        </PhoneBlocks>
      </>
    );
  }
  return (
    <>
      <PageHeader title={t('sellerNav.moreTitle')} />
      <nav aria-label={t('sellerNav.moreTitle')}>
        {links.map(([key, to]) => (
          <ListRow
            key={key}
            primary={t(`sellerNav.${key}`)}
            trailing="›"
            onClick={() => void navigate(to)}
          />
        ))}
        {sellerInstall.available ? (
          <ListRow
            primary={sellerInstall.title}
            secondary={sellerInstall.sub}
            onClick={sellerInstall.install}
          />
        ) : null}
      </nav>
      {sellerInstall.overlay}
      {me === null ? null : (
        <SignOutBlock>
          <Button onClick={() => void signOutNow()}>{t('sellerNav.signOut')}</Button>
        </SignOutBlock>
      )}
    </>
  );
}
