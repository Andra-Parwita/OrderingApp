import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { styled } from 'styled-components';
import { Button, Tooltip } from '../ui';
import { useSession } from './session';

// D-050: on a shared kitchen tablet, switching person is one step. The control signs out, then opens
// the seller sign-in with `?switch=1`, which starts the passkey picker straight away (no passkey
// is pre-selected, so each person picks their own). Nothing else on the device is cleared.

/** The sign-in address a switch goes to; the sign-in screen reads `switch`. */
export const SWITCH_SIGN_IN = '/seller/sign-in?switch=1';

type Person = Readonly<{ label: string; switchNow: () => void }>;

/** The signed-in person ("Rina · chef") and the switch action; null when nobody is signed in. */
function usePerson(): Person | null {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { me, end } = useSession();
  const switchNow = useCallback(() => {
    void end().then(() => navigate(SWITCH_SIGN_IN, { replace: true }));
  }, [end, navigate]);
  if (me === null) return null;
  const label =
    me.role === 'chef'
      ? t('sellerNav.personChef', { name: me.chefName ?? '' })
      : t('sellerNav.personSeller', { name: me.sellerName ?? '' });
  return { label, switchNow };
}

const Block = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.xs};
`;
const Small = styled.span`
  color: ${({ theme }) => theme.colour.textMuted};
  font-size: ${({ theme }) => theme.type.size.sm};
`;
const Name = styled.span`
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
const Glyph = styled.span`
  width: 1.25rem;
  flex: none;
  font-size: ${({ theme }) => theme.type.size.lg};
  line-height: 1;
  text-align: center;
`;
const RailBlock = styled(Block)`
  align-self: stretch;
  padding: 0 ${({ theme }) => theme.spacing.sm};
`;
const RailSwitch = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  width: 100%;
  min-height: 2.75rem;
  padding: 0 ${({ theme }) => theme.spacing.sm};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
  border-radius: ${({ theme }) => theme.radius.md};
  background: transparent;
  color: ${({ theme }) => theme.colour.text};
  font: inherit;
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colour.surfaceAlt};
  }
`;
const CompactSwitch = styled(RailSwitch)`
  width: 2.75rem;
  padding: 0;
  justify-content: center;
  border-color: transparent;
`;

/** The bottom of the desktop rail, above the EN / ID switch. Collapsed: the icon only. */
export function RailSwitchPerson({ collapsed }: Readonly<{ collapsed: boolean }>) {
  const { t } = useTranslation();
  const person = usePerson();
  if (person === null) return null;
  const action = t('sellerNav.switchPerson');
  if (collapsed) {
    return (
      <Tooltip text={`${person.label} — ${action}`}>
        <CompactSwitch
          type="button"
          onClick={person.switchNow}
          aria-label={`${action} (${person.label})`}
        >
          <Glyph aria-hidden="true">⇄</Glyph>
        </CompactSwitch>
      </Tooltip>
    );
  }
  return (
    <RailBlock>
      <Name title={person.label}>{person.label}</Name>
      <RailSwitch type="button" onClick={person.switchNow}>
        <Glyph aria-hidden="true">⇄</Glyph>
        {action}
      </RailSwitch>
    </RailBlock>
  );
}

/** The top of the More tab on a phone: "Signed in as / Rina · chef / [Switch person]". */
export function MoreSwitchPerson() {
  const { t } = useTranslation();
  const person = usePerson();
  if (person === null) return null;
  return (
    <Block as="section" aria-label={t('sellerNav.signedInLabel')}>
      <Small>{t('sellerNav.signedInLabel')}</Small>
      <Name>{person.label}</Name>
      <Button onClick={person.switchNow}>
        <span aria-hidden="true">⇄ </span>
        {t('sellerNav.switchPerson')}
      </Button>
    </Block>
  );
}
