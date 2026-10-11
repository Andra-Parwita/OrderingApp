import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Membership } from '../../shared/authContract';
import { fetchMemberships, switchKitchen } from '../api/auth';
import { useSession } from './session';

// Plan 033 stage 4: a person in more than one kitchen picks which one the seller app shows.
// Hidden with one kitchen. The server keeps the active kitchen on the session; this device
// remembers the last one through the session provider (`rememberSignedIn`).

const Wrap = styled.label`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.type.size.sm};
  color: ${({ theme }) => theme.colour.textMuted};
`;
const Select = styled.select`
  box-sizing: border-box;
  width: 100%;
  min-height: ${({ theme }) => theme.minTapTarget};
  padding: 0 ${({ theme }) => theme.spacing.sm};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colour.surface};
  color: ${({ theme }) => theme.colour.text};
  font: inherit;
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
const Failure = styled.span`
  color: ${({ theme }) => theme.status.cancelled.fg};
`;

/** Every list, setting and image is the kitchen's: a full load of the seller home is the clean reload. */
function goToSeller() {
  window.location.assign('/seller');
}

export function KitchenSwitcher({
  onSwitched = goToSeller,
}: Readonly<{ onSwitched?: () => void }>) {
  const { t } = useTranslation();
  const { me, adopt } = useSession();
  const [memberships, setMemberships] = useState<ReadonlyArray<Membership>>([]);
  const [failed, setFailed] = useState(false);
  const staff = me?.stage === 'full';
  const active = me?.sellerId;

  useEffect(() => {
    if (!staff) return undefined;
    let live = true;
    void fetchMemberships().then((result) => {
      if (live && result.ok) setMemberships(result.data.memberships);
    });
    return () => {
      live = false;
    };
  }, [staff, active]);

  const onChange = useCallback(
    async (event: ChangeEvent<HTMLSelectElement>) => {
      setFailed(false);
      const result = await switchKitchen(event.target.value);
      if (!result.ok) {
        setFailed(true);
        return;
      }
      adopt(result.data.me);
      onSwitched();
    },
    [adopt, onSwitched],
  );

  if (!staff || memberships.length < 2) return null;
  return (
    <Wrap>
      {t('sellerNav.kitchenSwitch')}
      <Select value={active ?? ''} onChange={(event) => void onChange(event)}>
        {memberships.map((m) => (
          <option key={m.sellerId} value={m.sellerId}>
            {m.sellerName} · {t(m.role === 'owner' ? 'sellerNav.roleOwner' : 'sellerNav.roleChef')}
          </option>
        ))}
      </Select>
      {failed ? <Failure role="alert">{t('sellerNav.kitchenSwitchFailed')}</Failure> : null}
    </Wrap>
  );
}
