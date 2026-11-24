import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { Button } from '../../../ui';
import { MENU_NS } from '../i18n/register';
import { Muted } from '../menuShared';
import { PlaceFields, placeValid, type PlaceDraft } from '../PlaceEditor';
import { PhoneFullLayer } from './PhoneFullLayer';

// Plan 134: a pickup place's editor on the phone: a full-screen layer (the tablet's is a box in the
// list) with its own bar, the fields scrolling and Cancel / Save pinned. It sits inside the wizard's
// layer, so a dialog over it (Delete place) is passed in as `overlay`.

const Form = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.size.pagePadPhone}px;
`;

export function PhonePlaceLayer({
  draft,
  onChange,
  onCancel,
  onSave,
  onDelete,
  notice,
  overlay,
}: Readonly<{
  draft: PlaceDraft;
  onChange: (next: PlaceDraft) => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete: (() => void) | undefined;
  /** The "draft kept" note. */
  notice: ReactNode;
  overlay: ReactNode;
}>) {
  const { t } = useTranslation(MENU_NS);
  const title =
    draft.id === null ? t('details.addPlace') : t('details.editPlace', { name: draft.place });
  return (
    <PhoneFullLayer
      label={title}
      title={draft.id === null ? title : draft.place}
      closeLabel={t('close')}
      onClose={onCancel}
      overlay={overlay}
      footer={
        <>
          <Button onClick={onCancel}>{t('cancel')}</Button>
          <Button variant="primary" disabled={!placeValid(draft)} onClick={onSave}>
            {t('details.savePlace')}
          </Button>
        </>
      }
    >
      <Form>
        <PlaceFields draft={draft} onChange={onChange} />
        {notice}
        <Muted>{t('details.placeSaved')}</Muted>
        {onDelete ? (
          <div>
            <Button variant="destructive" onClick={onDelete}>
              {t('details.deletePlace')}
            </Button>
          </div>
        ) : null}
      </Form>
    </PhoneFullLayer>
  );
}
