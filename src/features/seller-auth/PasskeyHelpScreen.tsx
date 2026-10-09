import { useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { passkeysSupported, registerDevice } from '../../api/auth';
import type { Me } from '../../../shared/authContract';
import { Icon } from '../../ui';
import { guessDevice, failureMessage } from './authText';
import { AUTH_NS } from './i18n/register';
import { AuthNote, AuthPanel, AuthSub, AuthTitle, ErrorText, FaceIcon } from './parts';

export type PasskeyHelpScreenProps = Readonly<{
  /** First name from the invite, shown as "Welcome, <name>"; without it just "Welcome". */
  name?: string | undefined;
  /** The device is registered: a full session now exists. */
  onDone: (me: Me) => void;
  /** The person chose to set a password instead. */
  onUsePassword: () => void;
}>;

const Cards = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Card = styled.button<{ $recommended: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.lg};
  width: 100%;
  min-height: 4.5rem;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border: ${({ theme }) => theme.border.hairline} solid
    ${({ theme, $recommended }) => ($recommended ? theme.c.atext : theme.c.ctrl)};
  border-radius: ${({ theme }) => theme.size.radiusControl / 16}rem;
  background: ${({ theme, $recommended }) => ($recommended ? theme.c.tint : 'transparent')};
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
const CardIcon = styled.span`
  display: inline-flex;
  flex: none;
  color: ${({ theme }) => theme.c.atext};
`;
const CardText = styled.span`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
`;
const CardTitle = styled.span`
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
const CardHint = styled.span`
  font-size: ${({ theme }) => theme.type.size.md};
  color: ${({ theme }) => theme.c.muted};
`;

function ChoiceCard({
  icon,
  title,
  text,
  recommended,
  disabled,
  onClick,
}: Readonly<{
  icon: ReactNode;
  title: string;
  text: string;
  recommended: boolean;
  disabled?: boolean;
  onClick: () => void;
}>) {
  return (
    <Card type="button" $recommended={recommended} disabled={disabled} onClick={onClick}>
      <CardIcon>{icon}</CardIcon>
      <CardText>
        <CardTitle>{title}</CardTitle>
        <CardHint>{text}</CardHint>
      </CardText>
      <Icon name="forward" />
    </Card>
  );
}

/**
 * The "Create" step after the invite key: face or fingerprint (a passkey, made on the spot under the
 * guessed device name; Devices renames it) or a password. On an IP-address web address passkeys
 * cannot work (D-046), so only the password is offered.
 */
export function PasskeyHelpScreen({ name, onDone, onUsePassword }: PasskeyHelpScreenProps) {
  const { t } = useTranslation(AUTH_NS);
  const supported = passkeysSupported();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = useCallback(async () => {
    setError(null);
    setBusy(true);
    const result = await registerDevice({
      kind: 'passkey',
      deviceName: t(`deviceName.${guessDevice()}`),
    });
    setBusy(false);
    if (result.ok) onDone(result.data.me);
    else setError(failureMessage(t, result));
  }, [onDone, t]);

  return (
    <AuthPanel>
      <AuthTitle>{name ? t('passkey.title', { name }) : t('passkey.titleNoName')}</AuthTitle>
      {supported ? (
        <AuthSub>{t('passkey.choose')}</AuthSub>
      ) : (
        <AuthNote>{t('passkey.unavailable')}</AuthNote>
      )}
      <Cards>
        {supported ? (
          <ChoiceCard
            icon={<FaceIcon />}
            title={busy ? t('passkey.working') : t('passkey.faceTitle')}
            text={t('passkey.faceText')}
            recommended
            disabled={busy}
            onClick={() => void create()}
          />
        ) : null}
        {error ? <ErrorText>{error}</ErrorText> : null}
        <ChoiceCard
          icon={<Icon name="lock" />}
          title={t('passkey.passwordTitle')}
          text={t('passkey.passwordText')}
          recommended={false}
          disabled={busy}
          onClick={onUsePassword}
        />
      </Cards>
    </AuthPanel>
  );
}
