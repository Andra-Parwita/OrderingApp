import { useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { styled, useTheme } from 'styled-components';
import { formatWindow } from '../../../shared/dates';
import type { Language, LocalText } from '../../../shared/domain';
import { MAX_PICKUP_PLACES } from '../../../shared/limits';
import type { MenuView, PickupPlace } from '../../../shared/menusContract';
import { pickText } from '../../../shared/text';
import { Button, Icon, TextArea, TextField, WarningDialog } from '../../ui';
import { ImageReadError, resizeImage } from '../../components/imageResize';
import { MENU_NS } from './i18n/register';
import { splitInstant, toInstant } from './instant';
import { ErrorText, GroupLabel, Muted, SwitchButton, useOpWatch, useRunOp } from './menuShared';
import type { MenuData } from './menuSlice';

// Step 2 and the Details tab: when, delivery, pickup places and the menu picture. Everything is
// saved as it changes, so there is no Save button (and no Back that loses input).

const Columns = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  min-height: 0;

  @media (max-width: 62.5rem) {
    grid-template-columns: minmax(0, 1fr);
  }
`;
const Col = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  min-width: 0;
  padding: ${({ theme }) => theme.size.pagePadTablet}px;

  & + & {
    border-left: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  }
  h2 {
    margin: 0;
    font-size: 1.0625rem;
  }
`;
const Two = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${({ theme }) => theme.spacing.md};
`;
const Divider = styled.hr`
  width: 100%;
  margin: ${({ theme }) => theme.spacing.sm} 0;
  border: 0;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
`;
const PlaceRow = styled.div`
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr) auto 2.75rem;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  font-variant-numeric: tabular-nums;

  strong {
    display: block;
  }
`;
const Tick = styled.input`
  width: 1.375rem;
  height: 1.375rem;
  accent-color: ${({ theme }) => theme.c.fill};
`;
const Pencil = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${({ theme }) => theme.size.tap}px;
  height: ${({ theme }) => theme.size.tap}px;
  border: 0;
  background: transparent;
  color: ${({ theme }) => theme.c.muted};
  cursor: pointer;
`;
const Inline = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme }) => theme.c.surf2};
`;
const Override = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: ${({ theme }) => theme.spacing.md};
  grid-column: 2 / -1;
`;
const Picture = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 3 / 2;
  overflow: hidden;
  border: ${({ theme }) => theme.border.hairline} dashed ${({ theme }) => theme.c.ctrl};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  color: ${({ theme }) => theme.c.muted};
  text-align: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;
const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Hidden = styled.input`
  display: none;
`;

/** A field that shows the saved value and saves each valid change as it is made (no Save button). */
function SyncedField({
  label,
  type,
  value,
  helper,
  valid,
  onCommit,
}: Readonly<{
  label: string;
  type: 'date' | 'time';
  value: string;
  helper?: string;
  valid: (next: string) => boolean;
  onCommit: (next: string) => void;
}>) {
  const [shown, setShown] = useState(value);
  // A new value from outside replaces what is shown (adjusted while rendering, not in an effect).
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setShown(value);
  }
  return (
    <TextField
      label={label}
      type={type}
      value={shown}
      {...(helper ? { helper } : {})}
      onChange={(event) => {
        setShown(event.target.value);
        if (valid(event.target.value)) onCommit(event.target.value);
      }}
    />
  );
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

type PlaceDraft = {
  id: string | null;
  place: string;
  start: string;
  end: string;
  en: string;
  id_: string;
};

function PlaceEditor({
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

export function DetailsStep({ data, lang }: Readonly<{ data: MenuData; lang: Language }>) {
  const { t } = useTranslation(MENU_NS);
  const theme = useTheme();
  const { run, busy } = useRunOp();
  const { menu } = data.view;
  const cutoff = splitInstant(menu.cutoffAt);
  const [note, setNote] = useState<LocalText>(menu.delivery.note);
  const [editing, setEditing] = useState<PlaceDraft | null>(null);
  const [deleting, setDeleting] = useState<PickupPlace | null>(null);
  const [pictureError, setPictureError] = useState<string | null>(null);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const uses = menu.placeUses;
  const days = daysBetween(cutoff.date, menu.cookingDate);

  useOpWatch(['createPlace', 'updatePlace', 'deletePlace'], {
    onDone: () => {
      setEditing(null);
      setPlaceError(null);
    },
    onFail: (result) =>
      setPlaceError(
        result.code === 'pickup_place_limit' ? t('details.placesFull') : t('genericError'),
      ),
  });
  useOpWatch(['uploadPicture'], {
    onFail: (result) =>
      setPictureError(t(`details.picture.${result.code}`, { defaultValue: t('genericError') })),
    onDone: () => setPictureError(null),
  });

  const saveTimes = (date: string, time: string) => {
    if (date === '' || !TIME.test(time)) return;
    const cutoffAt = toInstant(date, time);
    if (cutoffAt !== menu.cutoffAt) run({ kind: 'updateMenu', request: { cutoffAt } });
  };
  const setPlaces = (next: MenuView['menu']['placeUses']) =>
    run({ kind: 'updateMenu', request: { places: next } });
  const toggle = (place: PickupPlace) => {
    const on = uses.some((use) => use.placeId === place.id);
    setPlaces(
      on ? uses.filter((use) => use.placeId !== place.id) : [...uses, { placeId: place.id }],
    );
  };
  const setOverride = (place: PickupPlace, window: { start: string; end: string } | undefined) =>
    setPlaces(
      uses.map((use) =>
        use.placeId === place.id
          ? window
            ? { placeId: use.placeId, window }
            : { placeId: use.placeId }
          : use,
      ),
    );
  const draftOf = (place: PickupPlace | null): PlaceDraft => ({
    id: place?.id ?? null,
    place: place?.place ?? '',
    start: place?.window.start ?? '10:00',
    end: place?.window.end ?? '12:00',
    en: place?.directions.en ?? '',
    id_: place?.directions.id ?? '',
  });
  const savePlace = (draft: PlaceDraft) => {
    const directions = { en: draft.en.trim(), id: draft.id_.trim() };
    const window = { start: draft.start, end: draft.end };
    if (draft.id === null) {
      run({ kind: 'createPlace', request: { place: draft.place.trim(), directions, window } });
    } else {
      run({
        kind: 'updatePlace',
        id: draft.id,
        request: { place: draft.place.trim(), directions, window },
      });
    }
  };

  const onPicture = async (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    event.target.value = '';
    if (!chosen) return;
    setPictureError(null);
    try {
      const { dataUrl } = await resizeImage(chosen, 'menuPicture', theme.c.surf);
      run({ kind: 'uploadPicture', dataUrl });
    } catch (error) {
      setPictureError(
        error instanceof ImageReadError && error.code === 'image_too_big'
          ? t('details.picture.image_too_big')
          : t('details.picture.image_type'),
      );
    }
  };

  return (
    <Columns>
      <Col aria-label={t('details.when')}>
        <h2>{t('details.when')}</h2>
        <SyncedField
          label={t('details.cookingDay')}
          type="date"
          value={menu.cookingDate}
          helper={t('details.cookingHelper')}
          valid={(next) => DATE.test(next)}
          onCommit={(next) => run({ kind: 'updateMenu', request: { cookingDate: next } })}
        />
        <Two>
          <SyncedField
            label={t('details.ordersClose')}
            type="date"
            value={cutoff.date}
            valid={(next) => DATE.test(next)}
            onCommit={(next) => saveTimes(next, cutoff.time)}
          />
          <SyncedField
            label={t('details.closeTime')}
            type="time"
            value={cutoff.time}
            valid={(next) => TIME.test(next)}
            onCommit={(next) => saveTimes(cutoff.date, next)}
          />
        </Two>
        <Muted>
          {days >= 0 ? t('details.cutoffHelper', { count: days }) : t('details.cutoffAfter')}
        </Muted>
        <Divider />
        <Head>
          <h2>{t('details.delivery')}</h2>
          <SwitchButton
            type="button"
            role="switch"
            aria-checked={menu.delivery.available}
            aria-label={t('details.delivery')}
            $on={menu.delivery.available}
            disabled={busy}
            onClick={() =>
              run({
                kind: 'updateMenu',
                request: { delivery: { available: !menu.delivery.available, note } },
              })
            }
          >
            <i />
            <span>{menu.delivery.available ? t('live.yes') : t('live.no')}</span>
          </SwitchButton>
        </Head>
        <GroupLabel>{t('details.noteFor')}</GroupLabel>
        <Two>
          <TextArea
            label={t('dish.english')}
            value={note.en}
            maxLength={200}
            onChange={(event) => setNote({ ...note, en: event.target.value })}
            onBlur={() =>
              run({
                kind: 'updateMenu',
                request: { delivery: { available: menu.delivery.available, note } },
              })
            }
          />
          <TextArea
            label={t('dish.indonesian')}
            value={note.id}
            maxLength={200}
            onChange={(event) => setNote({ ...note, id: event.target.value })}
            onBlur={() =>
              run({
                kind: 'updateMenu',
                request: { delivery: { available: menu.delivery.available, note } },
              })
            }
          />
        </Two>
        <Muted>{t('details.addressNote')}</Muted>
      </Col>
      <Col aria-label={t('details.places')}>
        <Head>
          <h2>{t('details.places')}</h2>
          <Muted>{t('details.chosen', { count: uses.length })}</Muted>
        </Head>
        <Muted>{t('details.placesHelp')}</Muted>
        {data.places.map((place) => {
          const use = uses.find((candidate) => candidate.placeId === place.id);
          const window = use?.window ?? place.window;
          return (
            <div key={place.id}>
              <PlaceRow>
                <Tick
                  type="checkbox"
                  checked={use !== undefined}
                  disabled={busy}
                  aria-label={t('details.useFor', { name: place.place })}
                  onChange={() => toggle(place)}
                />
                <span>
                  <strong>{place.place}</strong>
                  <Muted as="span">{pickText(place.directions, lang)}</Muted>
                </span>
                <span>{formatWindow(window.start, window.end, lang)}</span>
                <Pencil
                  type="button"
                  aria-label={t('details.editPlace', { name: place.place })}
                  onClick={() => setEditing(draftOf(place))}
                >
                  <Icon name="pencil" />
                </Pencil>
                {use ? (
                  <Override>
                    <SyncedField
                      label={t('details.timeThisMenu')}
                      type="time"
                      value={window.start}
                      valid={(next) => TIME.test(next)}
                      onCommit={(next) => setOverride(place, { start: next, end: window.end })}
                    />
                    <SyncedField
                      label={t('details.to')}
                      type="time"
                      value={window.end}
                      valid={(next) => TIME.test(next)}
                      onCommit={(next) => setOverride(place, { start: window.start, end: next })}
                    />
                    {use.window ? (
                      <Button variant="quiet" onClick={() => setOverride(place, undefined)}>
                        {t('details.usualTime')}
                      </Button>
                    ) : null}
                  </Override>
                ) : null}
              </PlaceRow>
              {editing?.id === place.id ? (
                <PlaceEditor
                  draft={editing}
                  onChange={setEditing}
                  onCancel={() => setEditing(null)}
                  onSave={() => savePlace(editing)}
                  onDelete={() => setDeleting(place)}
                />
              ) : null}
            </div>
          );
        })}
        {editing && editing.id === null ? (
          <PlaceEditor
            draft={editing}
            onChange={setEditing}
            onCancel={() => setEditing(null)}
            onSave={() => savePlace(editing)}
          />
        ) : null}
        <Head>
          <Button
            disabled={data.places.length >= MAX_PICKUP_PLACES}
            onClick={() => setEditing(draftOf(null))}
          >
            <Icon name="plus" />
            {t('details.addPlace')}
          </Button>
          <Muted>{t('details.nOfSaved', { n: data.places.length, max: MAX_PICKUP_PLACES })}</Muted>
        </Head>
        {placeError ? <ErrorText role="alert">{placeError}</ErrorText> : null}
        <Muted>{t('details.placesFoot')}</Muted>
      </Col>
      <Col aria-label={t('details.picture.title')}>
        <Head>
          <h2>{t('details.picture.title')}</h2>
          <Muted>{t('details.picture.optional')}</Muted>
        </Head>
        <Muted>{t('details.picture.help')}</Muted>
        <Picture>
          {menu.pictureRef ? (
            <img src={menu.pictureRef} alt={t('details.picture.alt')} />
          ) : (
            <span>
              <Icon name="inbox" />
              <br />
              {t('details.picture.add')}
              <br />
              <Muted as="span">{t('details.picture.size')}</Muted>
            </span>
          )}
        </Picture>
        <Hidden
          ref={file}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label={t('details.picture.add')}
          onChange={(event) => void onPicture(event)}
        />
        <Actions>
          <Button disabled={busy} onClick={() => file.current?.click()}>
            {menu.pictureRef ? t('details.picture.replace') : t('details.picture.add')}
          </Button>
          {menu.pictureRef ? (
            <Button variant="quiet" disabled={busy} onClick={() => run({ kind: 'removePicture' })}>
              {t('details.picture.remove')}
            </Button>
          ) : null}
        </Actions>
        {pictureError ? <ErrorText role="alert">{pictureError}</ErrorText> : null}
        <Muted>{t('details.picture.foot')}</Muted>
      </Col>
      {deleting ? (
        <WarningDialog
          title={t('details.deleteTitle', { name: deleting.place })}
          cancelLabel={t('details.keepPlace')}
          continueLabel={t('details.deleteAnyway')}
          onCancel={() => setDeleting(null)}
          onContinue={() => {
            const place = deleting;
            setDeleting(null);
            run({ kind: 'deletePlace', id: place.id });
          }}
        >
          {uses.some((use) => use.placeId === deleting.id)
            ? t('details.deleteUsed')
            : t('details.deleteBody')}
        </WarningDialog>
      ) : null}
    </Columns>
  );
}
