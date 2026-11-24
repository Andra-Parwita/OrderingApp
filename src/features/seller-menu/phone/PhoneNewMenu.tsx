import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from '../../../ui';
import { LayerBar, LayerBody, LayerShell } from '../../../components/layer/LayerShell';
import { MENU_NS } from '../i18n/register';
import { Muted, useLang, useMenuData } from '../menuShared';
import type { MenuSlots } from '../slots';
import { useMenuWizard, type NewMenuRequest } from '../useMenuWizard';

// Plan 134: "+ New menu" on the phone's Orders card. The existing New menu dialog (the app's, through
// the `newMenu` slot) opens full screen; "Create menu" makes the menu and opens step 1 of the wizard.
// The dialog is a history layer of the card (Android Back closes it), so it is closed before the
// wizard opens: the wizard's own entries then sit right above Orders.

export function PhoneNewMenu({
  open,
  render,
  onClose,
  onFailed,
}: Readonly<{
  open: boolean;
  render: MenuSlots['newMenu'];
  onClose: () => void;
  /** The last start did not get through. */
  onFailed: (failed: boolean) => void;
}>) {
  const { t } = useTranslation(MENU_NS);
  const lang = useLang();
  const { data } = useMenuData();
  const wizard = useMenuWizard();
  // What "Create menu" asked for; it starts once the dialog layer has closed.
  const [request, setRequest] = useState<NewMenuRequest | null>(null);
  const started = useRef<NewMenuRequest | null>(null);
  const { start, failed } = wizard;
  useEffect(() => {
    if (request && !open && started.current !== request) {
      started.current = request;
      start(request);
    }
  }, [request, open, start]);
  useEffect(() => onFailed(failed), [failed, onFailed]);

  if (!open) return null;
  if (!data) {
    return (
      <LayerShell label={t('title')} onClose={onClose}>
        <LayerBar>
          <Button variant="quiet" onClick={onClose}>
            <Icon name="x" />
            {t('close')}
          </Button>
          <h2>{t('title')}</h2>
          <span />
        </LayerBar>
        <LayerBody>
          <Muted role="status">{t('loading')}</Muted>
        </LayerBody>
      </LayerShell>
    );
  }
  return render({
    lang,
    defaults: data.prefs.menuDefaults,
    past: data.past,
    sets: data.sets,
    onCreate: (input) => {
      setRequest(input);
      onClose();
    },
    onClose,
  });
}
