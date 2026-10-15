// Plan 078: "Your devices": one line per device (name, "this device", last used) with small icon
// buttons to rename and sign out, and a small "Add a device" button.
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { DEVICE_NAME_MAX, type DeviceView } from '../../../shared/authContract';
import type { Language } from '../../../shared/domain';
import { formatDayTime } from '../../../shared/dates';
import { createDeviceCode, fetchMyDevices, renameMyDevice, signOutDevice } from '../../api/auth';
import { Button, Icon, TextField, type IconName } from '../../ui';
import { ADMIN_NS } from './i18n/register';
import { FormSection, Message, Muted, Row, Sub } from './shared';

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Title = styled(Sub)`
  flex: 1;
`;
const List = styled.ul`
  max-width: 40rem;
  margin: 0;
  padding: 0 ${({ theme }) => theme.spacing.md};
  list-style: none;
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.c.surf};
`;
const Item = styled.li`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  &:last-child {
    border-bottom: 0;
  }
`;
const Name = styled.span`
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
`;
const Last = styled.span`
  display: block;
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.sm};
`;
const Tag = styled.span`
  margin-inline-start: ${({ theme }) => theme.spacing.sm};
  padding: 0 ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.c.tint};
  color: ${({ theme }) => theme.c.atext};
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: ${({ theme }) => theme.type.weight.strong};
  white-space: nowrap;
`;
const SmallButton = styled.button<{ $armed: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.xs};
  min-width: 2rem;
  min-height: 2rem;
  padding: 0 ${({ theme, $armed }) => ($armed ? theme.spacing.sm : '0')};
  border: ${({ theme }) => theme.border.hairline} solid
    ${({ theme, $armed }) => ($armed ? theme.c.danger : theme.c.line)};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme, $armed }) => ($armed ? theme.c.danger : theme.c.text)};
  font: inherit;
  font-size: ${({ theme }) => theme.type.size.sm};
  white-space: nowrap;
  cursor: pointer;
  &:hover {
    background: ${({ theme }) => theme.c.surf2};
  }
  &:focus-visible {
    outline: ${({ theme }) => theme.border.focus} solid ${({ theme }) => theme.c.atext};
    outline-offset: ${({ theme }) => theme.border.focus};
  }
`;

const ARM_MS = 3000;

/** A small icon button; with `confirmLabel` the first tap arms it (text appears), the second acts. */
function IconAction({
  icon,
  label,
  confirmLabel,
  onAct,
}: Readonly<{ icon: IconName; label: string; confirmLabel?: string; onAct: () => void }>) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const timer = window.setTimeout(() => setArmed(false), ARM_MS);
    return () => window.clearTimeout(timer);
  }, [armed]);
  const showConfirm = armed && confirmLabel !== undefined;
  const text = showConfirm ? confirmLabel : label;
  return (
    <SmallButton
      type="button"
      aria-label={text}
      title={text}
      $armed={showConfirm}
      onBlur={() => setArmed(false)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && armed) {
          event.preventDefault();
          setArmed(false);
        }
      }}
      onClick={() => {
        if (confirmLabel === undefined) onAct();
        else if (armed) {
          setArmed(false);
          onAct();
        } else setArmed(true);
      }}
    >
      <Icon name={icon} />
      {showConfirm ? confirmLabel : null}
    </SmallButton>
  );
}

export function DevicesPanel({ onCount }: Readonly<{ onCount?: (count: number) => void }>) {
  const { t, i18n } = useTranslation(ADMIN_NS);
  const lang: Language = i18n.resolvedLanguage === 'id' ? 'id' : 'en';
  const [mine, setMine] = useState<Array<DeviceView> | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  const loadMine = useCallback(async () => {
    const result = await fetchMyDevices();
    if (result.ok) setMine(result.data.devices);
  }, []);

  useEffect(() => {
    // A call that sets state after a network round trip, started once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMine();
  }, [loadMine]);

  useEffect(() => {
    if (mine) onCount?.(mine.length);
  }, [mine, onCount]);

  const signOutMine = async (deviceId: string) => {
    const result = await signOutDevice(deviceId);
    if (result.ok) await loadMine();
  };
  const renameMine = async (deviceId: string, next: string) => {
    const result = await renameMyDevice(deviceId, next);
    if (result.ok) await loadMine();
  };
  const addDevice = async () => {
    const result = await createDeviceCode();
    if (result.ok) setCode(result.data.code);
  };

  return (
    <>
      <Head>
        <Title>{t('home.nav.devices')}</Title>
        <Button onClick={() => void addDevice()}>{t('home.mine.addDevice')}</Button>
      </Head>
      {code ? <Message role="status">{t('home.mine.code', { code })}</Message> : null}
      {mine && mine.length === 0 ? <Muted>{t('home.mine.none')}</Muted> : null}
      {mine && mine.length > 0 ? (
        <List aria-label={t('home.mine.title')}>
          {mine.map((device) => (
            <Item key={device.id}>
              {renaming?.id === device.id ? (
                <FormSection
                  onSubmit={(event) => {
                    event.preventDefault();
                    const next = renaming.name.trim();
                    setRenaming(null);
                    if (next !== '' && next !== device.name) void renameMine(device.id, next);
                  }}
                >
                  <TextField
                    label={t('home.mine.renameField', { name: device.name })}
                    value={renaming.name}
                    maxLength={DEVICE_NAME_MAX}
                    autoComplete="off"
                    onChange={(event) => setRenaming({ id: device.id, name: event.target.value })}
                  />
                  <Row>
                    <Button type="submit" variant="primary" disabled={renaming.name.trim() === ''}>
                      {t('home.mine.saveName')}
                    </Button>
                    <Button onClick={() => setRenaming(null)}>{t('home.mine.cancel')}</Button>
                  </Row>
                </FormSection>
              ) : (
                <>
                  <Name>
                    <strong>{device.name}</strong>
                    {device.current ? <Tag>{t('home.mine.thisDevice')}</Tag> : null}
                    <Last>
                      {t('home.seller.lastUsed', { when: formatDayTime(device.lastUsedAt, lang) })}
                    </Last>
                  </Name>
                  <IconAction
                    icon="pencil"
                    label={t('home.mine.renameDevice', { name: device.name })}
                    onAct={() => setRenaming({ id: device.id, name: device.name })}
                  />
                  {device.current ? null : (
                    <IconAction
                      icon="signout"
                      label={t('home.mine.signOutDevice', { name: device.name })}
                      confirmLabel={t('home.seller.signOutConfirm')}
                      onAct={() => void signOutMine(device.id)}
                    />
                  )}
                </>
              )}
            </Item>
          ))}
        </List>
      ) : null}
    </>
  );
}
