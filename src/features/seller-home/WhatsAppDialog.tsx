import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { KitchenSettings } from '../../../shared/domain';
import { fetchSettings, saveSettings } from '../../api/client';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { Button, TextField } from '../../ui';
import { Dialog } from './Dialog';
import { HOME_NS, registerSellerHomeI18n } from './i18n/register';

// The kitchen's WhatsApp number (460 px), the same setting as Settings · Kitchen. Saving keeps
// every other setting as it is.

const Problem = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.danger};
  font-weight: 600;
`;

export type WhatsAppDialogProps = Readonly<{
  /** Called with the number the server kept (it normalises it). */
  onSaved: (number: string) => void;
  onClose: () => void;
}>;

export function WhatsAppDialog({ onSaved, onClose }: WhatsAppDialogProps) {
  registerSellerHomeI18n();
  const { t } = useTranslation(HOME_NS);
  const [settings, setSettings] = useState<KitchenSettings | null>(null);
  const [value, setValue] = useState('');
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void fetchSettings(undefined, currentSellerSlug()).then((result) => {
      if (!live) return;
      if (result.ok) {
        setSettings(result.data.settings);
        setValue(result.data.settings.whatsappNumber ?? '');
      } else {
        setFailed(true);
      }
    });
    return () => {
      live = false;
    };
  }, []);

  const save = () => {
    if (!settings) return;
    setBusy(true);
    setFailed(false);
    void saveSettings({ ...settings, whatsappNumber: value.trim() }, undefined, currentSellerSlug())
      .then((result) => {
        if (result.ok) onSaved(result.data.settings.whatsappNumber ?? '');
        else setFailed(true);
      })
      .finally(() => setBusy(false));
  };

  return (
    <Dialog
      title={t('whatsapp.title')}
      width="28.75rem"
      onClose={onClose}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button variant="primary" disabled={!settings || busy} onClick={save}>
            {t('save')}
          </Button>
        </>
      }
    >
      <TextField
        label={t('whatsapp.label')}
        helper={t('whatsapp.helper')}
        type="tel"
        inputMode="tel"
        autoComplete="off"
        value={value}
        disabled={!settings}
        onChange={(event) => setValue(event.target.value)}
        data-autofocus
      />
      {failed ? <Problem role="alert">{t('saveFailed')}</Problem> : null}
    </Dialog>
  );
}
