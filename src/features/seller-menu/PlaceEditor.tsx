import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { Button, TextField } from '../../ui';
import { MENU_NS } from './i18n/register';
import { Muted } from './menuShared';

// The inline editor for a pickup place on the Details step (split out of DetailsStep.tsx).

export const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const Two = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${({ theme }) => theme.spacing.md};
`;
const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Inline = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme }) => theme.c.surf2};
`;

export type PlaceDraft = {
  id: string | null;
  place: string;
  start: string;
  end: string;
  en: string;
  id_: string;
};

export function PlaceEditor({
  draft,
  onChange,
  onCancel,
  onSave,
  onDelete,
}: Readonly<{
  draft: PlaceDraft;
  onChange: (next: PlaceDraft) => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete?: () => void;
}>) {
  const { t } = useTranslation(MENU_NS);
  const valid = draft.place.trim() !== '' && TIME.test(draft.start) && TIME.test(draft.end);
  return (
    <Inline>
      <Two>
        <TextField
          label={t('details.placeName')}
          value={draft.place}
          maxLength={80}
          onChange={(event) => onChange({ ...draft, place: event.target.value })}
        />
        <Two>
          <TextField
            label={t('details.from')}
            type="time"
            value={draft.start}
            onChange={(event) => onChange({ ...draft, start: event.target.value })}
          />
          <TextField
            label={t('details.to')}
            type="time"
            value={draft.end}
            onChange={(event) => onChange({ ...draft, end: event.target.value })}
          />
        </Two>
      </Two>
      <Two>
        <TextField
          label={t('details.directionsEn')}
          value={draft.en}
          maxLength={200}
          onChange={(event) => onChange({ ...draft, en: event.target.value })}
        />
        <TextField
          label={t('details.directionsId')}
          value={draft.id_}
          maxLength={200}
          onChange={(event) => onChange({ ...draft, id_: event.target.value })}
        />
      </Two>
      <Head>
        {onDelete ? (
          <Button variant="destructive" onClick={onDelete}>
            {t('details.deletePlace')}
          </Button>
        ) : (
          <span />
        )}
        <Actions>
          <Button onClick={onCancel}>{t('cancel')}</Button>
          <Button variant="primary" disabled={!valid} onClick={onSave}>
            {t('details.savePlace')}
          </Button>
        </Actions>
      </Head>
      <Muted>{t('details.placeSaved')}</Muted>
    </Inline>
  );
}
