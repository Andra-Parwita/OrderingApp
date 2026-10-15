import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { PickupPoint } from '../../../shared/domain';
import { MAX_PICKUP_PLACES, PLACE_DIRECTIONS_MAX, PLACE_NAME_MAX } from '../../../shared/limits';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { fetchMenu } from '../../api/client';
import {
  createPickupPlace,
  deletePickupPlace,
  fetchPickupPlaces,
  updatePickupPlace,
} from '../../api/menus';
import {
  AddressEditor,
  addressValid,
  joinAddress,
  splitAddress,
  type AddressParts,
} from '../../components/pickup-map';
import { DraftNotice, draftKey, fingerprint, useDraft } from '../../components/draft';
import { Button, ConfirmButton, TextField } from '../../ui';
import { SETTINGS_NS } from './i18n/register';
import { ButtonRow, ErrorLine, Muted, NoticeLine, PaneForm, Two } from './paneParts';

const List = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
`;
const Item = styled.li`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md} 0;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const Summary = styled.div`
  display: grid;
  grid-template-columns: minmax(8rem, 1fr) 7rem minmax(0, 2fr);
  gap: ${({ theme }) => theme.spacing.md};
  align-items: start;
`;
const PlaceName = styled.span`
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
const Times = styled.span`
  font-family: ${({ theme }) => theme.font.mono};
  font-weight: 600;
`;
const Directions = styled.span`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  overflow-wrap: anywhere;
`;

// Plan 076: the optional address and pin ride in the draft as guided fields (`address`, saved as one line).
type Draft = {
  place: string;
  en: string;
  id: string;
  start: string;
  end: string;
  address?: AddressParts;
};
const EMPTY: Draft = { place: '', en: '', id: '', start: '10:00', end: '12:00' };

const toDraft = (point: PickupPoint): Draft => ({
  place: point.place,
  en: point.directions.en,
  id: point.directions.id,
  start: point.window.start,
  end: point.window.end,
  address: splitAddress(point.address, point.lat, point.lng),
});

const NO_PARTS = splitAddress(undefined);

function draftValid(d: Draft): boolean {
  return (
    d.place.trim() !== '' &&
    (d.en.trim() !== '' || d.id.trim() !== '') &&
    d.start !== '' &&
    d.end !== '' &&
    d.end > d.start &&
    addressValid(d.address ?? NO_PARTS)
  );
}

type EditorProps = Readonly<{
  mapsKey: string | undefined;
  initial: Draft;
  existing: boolean;
  busy: boolean;
  error: string | null;
  /** Resolves true when the server accepted the place. */
  onSave: (draft: Draft) => Promise<boolean>;
  onCancel: () => void;
  /** Plan 061: 'new' or the place's id: one draft each. */
  draftId: string;
}>;

function PlaceEditor({
  initial,
  existing,
  busy,
  error,
  onSave,
  onCancel,
  draftId,
  mapsKey,
}: EditorProps) {
  const { t } = useTranslation(SETTINGS_NS);
  const [draft, setDraft, typedDraft] = useDraft(
    draftKey(currentSellerSlug(), 'pickup', draftId),
    initial,
    { baseline: fingerprint(initial) },
  );
  const [submitted, setSubmitted] = useState(false);
  const field = (key: keyof Draft) => (event: ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [key]: event.target.value }));
  const submit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    setSubmitted(true);
    if (draftValid(draft)) void onSave(draft).then((ok) => ok && typedDraft.clear());
  };
  return (
    <PaneForm onSubmit={submit} noValidate>
      <DraftNotice draft={typedDraft} />
      <TextField
        label={t('pickup.place')}
        value={draft.place}
        maxLength={PLACE_NAME_MAX}
        autoComplete="off"
        onChange={field('place')}
      />
      <Two>
        <TextField
          label={t('pickup.directionsEn')}
          value={draft.en}
          maxLength={PLACE_DIRECTIONS_MAX}
          autoComplete="off"
          onChange={field('en')}
        />
        <TextField
          label={t('pickup.directionsId')}
          value={draft.id}
          maxLength={PLACE_DIRECTIONS_MAX}
          autoComplete="off"
          onChange={field('id')}
        />
        <TextField
          label={t('pickup.from')}
          type="time"
          value={draft.start}
          onChange={field('start')}
        />
        <TextField label={t('pickup.to')} type="time" value={draft.end} onChange={field('end')} />
      </Two>
      <AddressEditor
        place={draft.place.trim() || t('pickup.place')}
        value={draft.address ?? NO_PARTS}
        mapsKey={mapsKey}
        disabled={busy}
        onChange={(address) => setDraft((d) => ({ ...d, address }))}
      />
      {(submitted && !draftValid(draft)) || error === 'invalid' ? (
        <ErrorLine role="alert">{t('pickup.invalid')}</ErrorLine>
      ) : error ? (
        <ErrorLine role="alert">
          {error === 'limit' ? t('pickup.limit') : t('pickup.failed')}
        </ErrorLine>
      ) : null}
      <ButtonRow>
        <Button type="submit" variant="primary" disabled={busy}>
          {existing ? t('pickup.saveEdit') : t('pickup.saveNew')}
        </Button>
        <Button
          variant="quiet"
          onClick={() => {
            typedDraft.discard();
            onCancel();
          }}
        >
          {t('pickup.cancel')}
        </Button>
      </ButtonRow>
    </PaneForm>
  );
}

/** Saved pickup places (D-061): at most 5; deleting is allowed and warns when it was on the live menu. */
export function PickupPane() {
  const { t } = useTranslation(SETTINGS_NS);
  const slug = currentSellerSlug();
  const [places, setPlaces] = useState<ReadonlyArray<PickupPoint> | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  // 'new', a place id, or null (nothing open).
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapsKey, setMapsKey] = useState<string | undefined>(undefined);
  const [notice, setNotice] = useState<{ text: string; warn: boolean } | null>(null);

  const load = useCallback(async () => {
    const result = await fetchPickupPlaces(undefined, slug);
    if (result.ok) {
      setPlaces(result.data.places);
      setLoadFailed(false);
    } else setLoadFailed(true);
  }, [slug]);
  useEffect(() => {
    let live = true;
    void fetchPickupPlaces(undefined, slug).then((result) => {
      if (!live) return;
      if (result.ok) setPlaces(result.data.places);
      else setLoadFailed(true);
    });
    // The public Maps key (not a secret) for Check on map; without it the check opens Google Maps.
    void fetchMenu(slug).then((result) => {
      if (live && result.ok) setMapsKey(result.data.mapsEmbedKey);
    });
    return () => {
      live = false;
    };
  }, [slug]);

  const close = useCallback(() => {
    setEditing(null);
    setError(null);
  }, []);

  const save = useCallback(
    async (draft: Draft): Promise<boolean> => {
      setBusy(true);
      setError(null);
      const body = {
        place: draft.place.trim(),
        directions: { en: draft.en.trim(), id: draft.id.trim() },
        window: { start: draft.start, end: draft.end },
      };
      const parts = draft.address ?? NO_PARTS;
      const address = joinAddress(parts);
      const pin = address !== '' && parts.lat !== null && parts.lng !== null;
      const result =
        editing === 'new'
          ? await createPickupPlace(
              {
                ...body,
                ...(address !== '' ? { address } : {}),
                ...(pin ? { lat: parts.lat ?? 0, lng: parts.lng ?? 0 } : {}),
              },
              undefined,
              slug,
            )
          : await updatePickupPlace(
              editing ?? '',
              {
                ...body,
                address: address === '' ? null : address,
                lat: pin ? parts.lat : null,
                lng: pin ? parts.lng : null,
              },
              undefined,
              slug,
            );
      setBusy(false);
      if (result.ok) {
        setNotice(null);
        close();
        await load();
        return true;
      } else {
        setError(
          result.error === 'pickup_place_limit'
            ? 'limit'
            : result.error === 'invalid_request'
              ? 'invalid'
              : 'failed',
        );
        return false;
      }
    },
    [close, editing, load, slug],
  );

  const remove = useCallback(
    async (point: PickupPoint) => {
      setBusy(true);
      const result = await deletePickupPlace(point.id, undefined, slug);
      setBusy(false);
      if (result.ok) {
        setNotice({
          text: t(result.data.usedOnLiveMenu ? 'pickup.deletedLive' : 'pickup.deleted', {
            place: point.place,
          }),
          warn: result.data.usedOnLiveMenu,
        });
        await load();
      } else setError('failed');
    },
    [load, slug, t],
  );

  if (loadFailed) {
    return (
      <ErrorLine role="alert">
        {t('pickup.loadFailed')}{' '}
        <Button variant="quiet" onClick={() => void load()}>
          {t('retry')}
        </Button>
      </ErrorLine>
    );
  }
  if (places === null) return <Muted role="status">{t('loading')}</Muted>;

  const left = MAX_PICKUP_PLACES - places.length;
  return (
    <>
      <Muted>
        {t('pickup.intro')} {t('pickup.count', { count: places.length, max: MAX_PICKUP_PLACES })}
      </Muted>
      {notice ? (
        notice.warn ? (
          <NoticeLine role="status">{notice.text}</NoticeLine>
        ) : (
          <Muted role="status">{notice.text}</Muted>
        )
      ) : null}
      {places.length === 0 ? <Muted>{t('pickup.empty')}</Muted> : null}
      <List>
        {places.map((point) =>
          editing === point.id ? (
            <Item key={point.id}>
              <PlaceEditor
                initial={toDraft(point)}
                existing
                busy={busy}
                error={error}
                onSave={save}
                onCancel={close}
                draftId={point.id}
                mapsKey={mapsKey}
              />
            </Item>
          ) : (
            <Item key={point.id}>
              <Summary>
                <PlaceName>{point.place}</PlaceName>
                <Times>{t('pickup.window', point.window)}</Times>
                <Directions>
                  <span>EN {point.directions.en}</span>
                  <span>ID {point.directions.id}</span>
                  {point.address ? <span>{point.address}</span> : null}
                </Directions>
              </Summary>
              <ButtonRow>
                <Button
                  disabled={busy}
                  aria-label={t('pickup.edit', { place: point.place })}
                  onClick={() => {
                    setError(null);
                    setEditing(point.id);
                  }}
                >
                  {t('pickup.editLabel')}
                </Button>
                <ConfirmButton
                  label={t('pickup.delete')}
                  confirmLabel={t('pickup.deleteConfirm')}
                  onConfirm={() => void remove(point)}
                  disabled={busy}
                />
              </ButtonRow>
            </Item>
          ),
        )}
      </List>
      {editing === 'new' ? (
        <PlaceEditor
          initial={EMPTY}
          existing={false}
          busy={busy}
          error={error}
          onSave={save}
          onCancel={close}
          draftId="new"
          mapsKey={mapsKey}
        />
      ) : left > 0 ? (
        <ButtonRow>
          <Button
            onClick={() => {
              setError(null);
              setEditing('new');
            }}
          >
            {t('pickup.add')}
          </Button>
          <Muted>{t('pickup.canAdd', { count: left })}</Muted>
        </ButtonRow>
      ) : (
        <Muted>{t('pickup.full')}</Muted>
      )}
    </>
  );
}
