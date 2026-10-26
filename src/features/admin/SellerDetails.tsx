import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { AdminSeller, InviteInfo, TeamMember } from '../../../shared/authContract';
import {
  createInviteKey,
  createRecoveryKey,
  fetchSellerInvites,
  fetchSellerMembers,
  removeSellerMember,
  setSellerDemo,
  setSellerPaused,
} from '../../api/auth';
import { formatDayTime } from '../../../shared/dates';
import type { Language, PauseKind } from '../../../shared/domain';
import type { ApiFailure } from '../../api/http';
import { Button, ConfirmButton, Pill } from '../../ui';
import { ADMIN_NS } from './i18n/register';
import { KeyBox } from './KeyBox';
import { DeviceItem, DeviceList, Message, Muted, Row, SmallHeading } from './shared';

type ShownKey = 'invite' | 'recovery';

const Panel = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding: 0 ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.xl};
`;
const TabList = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.lg};
  border-bottom: ${({ theme }) => theme.border.hairline} solid
    ${({ theme }) => theme.colour.hairline};
`;
const TabButton = styled.button`
  min-height: ${({ theme }) => theme.minTapTarget};
  padding: 0 ${({ theme }) => theme.spacing.xs};
  border: 0;
  border-bottom: ${({ theme }) => theme.border.focus} solid transparent;
  background: transparent;
  color: ${({ theme }) => theme.colour.textMuted};
  font: inherit;
  cursor: pointer;
  &[aria-selected='true'] {
    border-bottom-color: ${({ theme }) => theme.colour.text};
    color: ${({ theme }) => theme.colour.text};
    font-weight: ${({ theme }) => theme.type.weight.strong};
  }
`;
const TabBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

export type SellerTab = 'invitations' | 'settings';
const TABS: ReadonlyArray<SellerTab> = ['invitations', 'settings'];
const Check = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: ${({ theme }) => theme.minTapTarget};
  font-weight: ${({ theme }) => theme.type.weight.strong};
  cursor: pointer;
`;

/** The kitchen's state as a label: Open, Closed to customers, or Paused. */
export function PauseLabel({ pause }: Readonly<{ pause: PauseKind | undefined }>) {
  const { t } = useTranslation(ADMIN_NS);
  return (
    <Pill tone={pause === 'full' ? 'cancelled' : pause === 'customers' ? 'ready' : 'confirmed'}>
      {t(`home.pause.label.${pause ?? 'open'}`)}
    </Pill>
  );
}

export type SellerDetailsProps = Readonly<{
  seller: AdminSeller;
  /** A refused call, as one plain sentence (and a trip to sign-in if the session is gone). */
  refused: (failure: ApiFailure) => string;
  /** The seller changed on the server (the demo switch). */
  onSeller: (seller: AdminSeller) => void;
  /** How many devices the people of this kitchen have. */
  onDevices: (sellerId: string, devices: number) => void;
  /** The app layer's pictures editor for this kitchen (features may not import each other). */
  images?: (sellerId: string) => ReactNode;
  /** A line shown at the top (the seller was just added). */
  notice?: string | null;
  /** Changes when the admin page is refreshed: people and invites load again (plan 052). */
  refreshKey?: number;
}>;

/**
 * One seller's details, inside the right-hand panel (plan 038 stage 4): tabs Invitations (keys,
 * people with their devices) and Settings (pictures, demo switch).
 */
export function SellerDetails({
  seller,
  refused,
  onSeller,
  onDevices,
  images,
  notice,
  refreshKey = 0,
}: SellerDetailsProps) {
  const { t, i18n } = useTranslation(ADMIN_NS);
  const lang: Language = i18n.resolvedLanguage === 'id' ? 'id' : 'en';
  const [members, setMembers] = useState<Array<TeamMember> | null>(null);
  const [invites, setInvites] = useState<Array<InviteInfo> | null>(null);
  const [shown, setShown] = useState<ShownKey | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sellerId = seller.id;
  const [tab, setTab] = useState<SellerTab>('invitations');
  const tabs = useRef<Partial<Record<SellerTab, HTMLButtonElement | null>>>({});
  const onTabKey = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      const at = TABS.indexOf(tab);
      const keys: Record<string, number> = {
        ArrowRight: (at + 1) % TABS.length,
        ArrowLeft: (at + TABS.length - 1) % TABS.length,
        Home: 0,
        End: TABS.length - 1,
      };
      const target = TABS[keys[event.key] ?? -1];
      if (!target) return;
      event.preventDefault();
      setTab(target);
      tabs.current[target]?.focus();
    },
    [tab],
  );

  // Plan 125: only the newest ask may set the list. An older answer that arrives late (the page was
  // refreshed, then a person removed) must not bring a removed person back.
  const newestAsk = useRef(0);
  const loadMembers = useCallback(async () => {
    newestAsk.current += 1;
    const ask = newestAsk.current;
    const result = await fetchSellerMembers(sellerId);
    if (!result.ok || ask !== newestAsk.current) return;
    setMembers(result.data.members);
    onDevices(
      sellerId,
      result.data.members.reduce((sum, member) => sum + member.devices, 0),
    );
  }, [sellerId, onDevices]);

  const loadInvites = useCallback(async () => {
    const result = await fetchSellerInvites(sellerId);
    if (result.ok) setInvites(result.data.invites);
  }, [sellerId]);

  useEffect(() => {
    // A call that sets state after a network round trip, started once when the row opens.
    void loadMembers();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadInvites();
  }, [loadMembers, loadInvites, refreshKey]);

  /** The invite box calls this with the typed name; the key itself stays inside the box. */
  const makeKey = useCallback(
    async (kind: ShownKey, displayName: string): Promise<string | null> => {
      setProblem(null);
      const make = kind === 'invite' ? createInviteKey : createRecoveryKey;
      const result = await make(sellerId, displayName || undefined);
      if (result.ok) {
        void loadInvites();
        return result.data.key;
      }
      setProblem(refused(result));
      return null;
    },
    [sellerId, refused, loadInvites],
  );

  /** "Owner · 2 devices (screen lock, password)"; the old line when the server sends no sign-in counts. */
  const memberLine = (member: TeamMember): string => {
    const role = t(`home.seller.role.${member.role}`);
    if (member.unfinished) return t('home.seller.memberUnfinished', { role });
    if (member.passkeys === undefined) {
      return t('home.seller.memberLine', { role, count: member.devices });
    }
    const methods = [
      ...Array<string>(member.passkeys).fill(t('home.seller.signInPasskey')),
      ...Array<string>(Math.max(0, member.devices - member.passkeys)).fill(
        t('home.seller.signInPassword'),
      ),
    ].join(', ');
    return t('home.seller.memberHow', { role, count: member.devices, methods });
  };

  const removeMember = useCallback(
    async (accountId: string) => {
      const result = await removeSellerMember(sellerId, accountId);
      if (result.ok) await loadMembers();
      else setProblem(refused(result));
    },
    [sellerId, loadMembers, refused],
  );

  const changeDemo = useCallback(
    async (demo: boolean) => {
      setBusy(true);
      setProblem(null);
      const result = await setSellerDemo(sellerId, demo);
      setBusy(false);
      if (!result.ok) {
        setProblem(refused(result));
        return;
      }
      onSeller(result.data.seller);
    },
    [sellerId, refused, onSeller],
  );

  const changePause = useCallback(
    async (kind: PauseKind | null) => {
      setBusy(true);
      setProblem(null);
      const result = await setSellerPaused(sellerId, kind);
      setBusy(false);
      if (!result.ok) {
        setProblem(refused(result));
        return;
      }
      onSeller(result.data.seller);
    },
    [sellerId, refused, onSeller],
  );

  const inviteTab = (
    <TabBody>
      <Row>
        <Button variant="primary" disabled={busy} onClick={() => setShown('invite')}>
          {t('home.seller.invite')}
        </Button>
        <Button disabled={busy} onClick={() => setShown('recovery')}>
          {t('home.seller.recovery')}
        </Button>
      </Row>
      {problem ? <Message $bad>{problem}</Message> : null}
      {shown ? (
        <KeyBox
          title={t(shown === 'invite' ? 'home.key.inviteTitle' : 'home.key.recoveryTitle', {
            name: seller.name,
          })}
          key={shown}
          slug={seller.slug}
          kitchen={seller.name}
          create={(displayName) => makeKey(shown, displayName)}
          onDone={() => setShown(null)}
        />
      ) : null}
      <SmallHeading>{t('home.seller.members')}</SmallHeading>
      {members === null ? <Muted>{t('loading')}</Muted> : null}
      {members && members.length === 0 ? <Muted>{t('home.seller.noMembers')}</Muted> : null}
      {members && members.length > 0 ? (
        <DeviceList aria-label={t('home.seller.members')}>
          {members.map((member) => (
            <DeviceItem key={member.accountId}>
              <span>
                <strong>{member.displayName}</strong>
                <Muted>{memberLine(member)}</Muted>
              </span>
              <ConfirmButton
                label={t('home.seller.remove')}
                confirmLabel={t('home.seller.removeConfirm')}
                onConfirm={() => void removeMember(member.accountId)}
              />
            </DeviceItem>
          ))}
        </DeviceList>
      ) : null}
      <SmallHeading>{t('home.seller.invites')}</SmallHeading>
      {invites && invites.length === 0 ? <Muted>{t('home.seller.noInvites')}</Muted> : null}
      {invites && invites.length > 0 ? (
        <DeviceList aria-label={t('home.seller.invites')}>
          {invites.map((invite) => (
            <DeviceItem key={`${invite.createdAt}-${invite.displayName}-${invite.expiresAt}`}>
              <span>
                <strong>{invite.displayName}</strong>
                <Muted>
                  {t('home.seller.inviteLine', {
                    role: t(`home.seller.role.${invite.role}`),
                    sent: formatDayTime(invite.createdAt, lang),
                  })}
                </Muted>
              </span>
              <Muted>
                {invite.status === 'used'
                  ? t('home.seller.inviteUsed', { when: formatDayTime(invite.usedAt ?? '', lang) })
                  : invite.status === 'expired'
                    ? t('home.seller.inviteExpired', {
                        when: formatDayTime(invite.expiresAt, lang),
                      })
                    : t('home.seller.inviteWaiting', {
                        when: formatDayTime(invite.expiresAt, lang),
                      })}
              </Muted>
            </DeviceItem>
          ))}
        </DeviceList>
      ) : null}
    </TabBody>
  );
  const settingsTab = (
    <TabBody>
      <Check>
        <input
          type="checkbox"
          checked={seller.demo === true}
          disabled={busy}
          onChange={(event) => void changeDemo(event.target.checked)}
        />
        {t('home.seller.demo')}
      </Check>
      <Muted>{t('home.seller.demoNote')}</Muted>
      <SmallHeading>{t('home.pause.title')}</SmallHeading>
      <Row>
        <span>{t('home.pause.state')}</span>
        <PauseLabel pause={seller.paused} />
      </Row>
      {seller.paused !== 'customers' ? (
        <>
          <Row>
            <Button disabled={busy} onClick={() => void changePause('customers')}>
              {t('home.pause.customersButton')}
            </Button>
          </Row>
          <Muted>{t('home.pause.customersNote')}</Muted>
        </>
      ) : null}
      {seller.paused !== 'full' ? (
        <>
          <Row>
            <ConfirmButton
              label={t('home.pause.fullButton')}
              confirmLabel={t('home.pause.fullConfirm')}
              disabled={busy}
              onConfirm={() => void changePause('full')}
            />
          </Row>
          <Muted>{t('home.pause.fullNote')}</Muted>
        </>
      ) : null}
      {seller.paused ? (
        <Row>
          <Button variant="primary" disabled={busy} onClick={() => void changePause(null)}>
            {t('home.pause.resume')}
          </Button>
        </Row>
      ) : null}
      {problem ? <Message $bad>{problem}</Message> : null}
      {images ? (
        <>
          <SmallHeading>{t('home.seller.images')}</SmallHeading>
          <Muted>{t('home.seller.imagesNote')}</Muted>
          {images(sellerId)}
        </>
      ) : null}
    </TabBody>
  );

  return (
    <Panel>
      <SmallHeading>{t('home.seller.title', { name: seller.name })}</SmallHeading>
      <Muted>{t('home.seller.link', { slug: seller.slug })}</Muted>
      {notice ? <Message role="status">{notice}</Message> : null}
      <TabList role="tablist" aria-label={t('home.seller.tabs')}>
        {TABS.map((id) => (
          <TabButton
            key={id}
            ref={(element) => {
              tabs.current[id] = element;
            }}
            type="button"
            role="tab"
            id={`seller-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`seller-tabpanel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => setTab(id)}
            onKeyDown={onTabKey}
          >
            {t(`home.seller.tab.${id}`)}
          </TabButton>
        ))}
      </TabList>
      <div role="tabpanel" id={`seller-tabpanel-${tab}`} aria-labelledby={`seller-tab-${tab}`}>
        {tab === 'invitations' ? inviteTab : settingsTab}
      </div>
    </Panel>
  );
}
