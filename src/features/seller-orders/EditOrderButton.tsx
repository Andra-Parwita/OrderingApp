import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Order } from '../../../shared/domain';
import { useMediaQuery } from '../../components/useMediaQuery';
import { Button, Icon } from '../../ui';
import { EditOrderSheet } from './EditOrderSheet';
import { SELLER_NS } from './i18n/register';

/** From 600 px up the app shows the tablet layout (same width as app/layout.ts; a feature may not import app). */
const TABLET_QUERY = '(min-width: 600px)';

/** Plan 105: "Edit order" on the order panel (owner and chef; the caller hides it for a helper). */
export function EditOrderButton({ order }: Readonly<{ order: Order }>) {
  const { t } = useTranslation(SELLER_NS);
  const tablet = useMediaQuery(TABLET_QUERY);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="quiet" onClick={() => setOpen(true)}>
        <Icon name="pencil" />
        {t('edit.button')}
      </Button>
      {open ? (
        <EditOrderSheet order={order} tablet={tablet} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
