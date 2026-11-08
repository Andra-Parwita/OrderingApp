import { useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { styled, useTheme } from 'styled-components';
import { formatDay, formatWindow } from '../../../shared/dates';
import type { Language, LocalText } from '../../../shared/domain';
import { MAX_PICKUP_PLACES, PAST_MENU_PICTURES_KEPT } from '../../../shared/limits';
import type { MenuView, PickupPlace } from '../../../shared/menusContract';
import { pickText } from '../../../shared/text';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { DraftNotice, draftKey, fingerprint, useDraft } from '../../components/draft';
import {
  Button,
  Icon,
  Segmented,
  TextArea,
  TextField,
  WarningDialog,
  type SegmentedOption,
} from '../../ui';
import { ImageReadError, resizeImage } from '../../components/imageResize';
import { MENU_NS } from './i18n/register';
import {
  deviceZone,
  splitInstant,
  toInstant,
  windowToDevice,
  windowToKitchen,
} from '../../../shared/zone';
import { ErrorText, GroupLabel, Muted, useOpWatch, useRunOp } from './menuShared';
import type { MenuData } from './menuSlice';
import { PlaceEditor, TIME, type PlaceDraft } from './PlaceEditor';
import { DeliveryDaysField, type DaysChange } from './DeliveryDaysField';
import { buildDelivery, deliveryForMovedDay, lastOpenDay } from './deliveryDaysModel';
import { KeepOpenRow } from './KeepOpenRow';

// Step 2 and the Details tab: when, delivery, pickup places and the menu picture. Everything is
// saved as it changes, so there is no Save button (and no Back that loses input).

const HowRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.size.pagePadTablet}px;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};

  h2 {
    margin: 0;
    font-size: 1.0625rem;
  }
`;
// Two columns (When + delivery | Pickup places) and the picture as a full-width row under them; one
// column on a narrow screen (a tablet held upright). Plan 126: the layer is wider, so nothing is squeezed.
const Columns = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  min-height: 0;

  @media (max-width: 60rem) {
    grid-template-columns: minmax(0, 1fr);
  }
`;
const Past = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(6rem, 1fr));
  gap: ${({ theme }) => theme.spacing.sm};
`;
const PastPick = styled.button`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: 0;
  border: 0;
  background: transparent;
  color: ${({ theme }) => theme.c.muted};
  font: inherit;
  font-size: 0.8125rem;
  text-align: left;
  cursor: pointer;

  img {
    width: 100%;
    aspect-ratio: 3 / 2;
    object-fit: cover;
    border-radius: ${({ theme }) => theme.size.radiusControl}px;
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
  @media (max-width: 60rem) {
    & + & {
      border-left: 0;
      border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
    }
  }
  h2 {
    margin: 0;
    font-size: 1.0625rem;
  }
`;
/** The menu picture: a full-width row under the columns, its content kept to a sensible width. */
const PictureCol = styled(Col)`
  grid-column: 1 / -1;
  border-left: 0;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};

  > * {
    max-width: 36rem;
  }
`;
const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
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
  grid-template-columns: 2rem minmax(0, 1fr) max-content 2.75rem;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  font-variant-numeric: tabular-nums;

  /* Name and directions stack on the left; the time (never wrapped) sits on the right. */
  > span:nth-child(2) {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  > span:nth-child(3) {
    white-space: nowrap;
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

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

type HowChoice = 'pickup' | 'delivery' | 'both';

export function DetailsStep({ data, lang }: Readonly<{ data: MenuData; lang: Language }>) {
  const { t } = useTranslation(MENU_NS);
  const theme = useTheme();
  const { run, busy } = useRunOp();
  const { menu } = data.view;
  const cutoff = splitInstant(menu.cutoffAt, deviceZone());
  // Plan 061: the free text survives a reload until it is saved (the note on blur, a place on its Save).
  const slug = currentSellerSlug();
  const [note, setNote, noteDraft] = useDraft<LocalText>(
    draftKey(slug, 'wizard-note', menu.id),
    menu.delivery.note,
    { baseline: fingerprint(menu.delivery.note) },
  );
  const [editing, setEditing, placeDraft] = useDraft<PlaceDraft | null>(
    draftKey(slug, 'wizard-place', menu.id),
    null,
  );
  const uses = menu.placeUses;
  // Pickup / Delivery / Both is read from the data (places ticked + delivery on); what the seller
  // just picked wins until the screen closes, so "Both" with no place ticked yet keeps its places.
  const derived: HowChoice = !menu.delivery.available
    ? 'pickup'
    : uses.length > 0
      ? 'both'
      : 'delivery';
  const [picked, setPicked] = useState<HowChoice | null>(null);
  const how = picked ?? derived;
  const [askRemove, setAskRemove] = useState(false);
  const [pastPicking, setPastPicking] = useState(false);
  const [deleting, setDeleting] = useState<PickupPlace | null>(null);
  const [pictureError, setPictureError] = useState<string | null>(null);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const days = daysBetween(cutoff.date, menu.cookingDate);
  // Plan 126: the delivery days and the finish time live in deliveryDaysModel.ts.
  const keepOpen = menu.finishExtraDay === true;
  const deliveryWith = (available: boolean, next?: DaysChange) =>
    buildDelivery(menu, note, available, next);

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
    const cutoffAt = toInstant(date, time, deviceZone());
    if (cutoffAt !== menu.cutoffAt) run({ kind: 'updateMenu', request: { cutoffAt } });
  };
  const saveNote = () => {
    run({
      kind: 'updateMenu',
      request: { delivery: deliveryWith(menu.delivery.available) },
    });
    noteDraft.clear();
  };
  const choose = (next: HowChoice) => {
    if (next === how) return;
    if (next === 'delivery' && uses.length > 0) {
      setAskRemove(true);
      return;
    }
    setPicked(next);
    const available = next !== 'pickup';
    if (available !== menu.delivery.available) {
      run({ kind: 'updateMenu', request: { delivery: deliveryWith(available) } });
    }
  };
  const confirmRemove = () => {
    setAskRemove(false);
    setPicked('delivery');
    run({
      kind: 'updateMenu',
      request: { places: [], delivery: deliveryWith(true) },
    });
  };
  const howOptions: ReadonlyArray<SegmentedOption<HowChoice>> = [
    { value: 'pickup', label: t('details.how.pickup') },
    { value: 'delivery', label: t('details.how.delivery') },
    { value: 'both', label: t('details.how.both') },
  ];
  const pastWithPicture = data.past
    .filter((week) => week.pictureUrl)
    .slice(0, PAST_MENU_PICTURES_KEPT);
  const setPlaces = (next: MenuView['menu']['placeUses']) =>
    run({ kind: 'updateMenu', request: { places: next } });
  const toggle = (place: PickupPlace) => {
    const on = uses.some((use) => use.placeId === place.id);
    setPlaces(
      on ? uses.filter((use) => use.placeId !== place.id) : [...uses, { placeId: place.id }],
    );
  };
  // Times typed here are the seller's device clock; they are stored as the kitchen's clock (plan 077).
  const setOverride = (place: PickupPlace, window: { start: string; end: string } | undefined) =>
    setPlaces(
      uses.map((use) =>
        use.placeId === place.id
          ? window
            ? { placeId: use.placeId, window: windowToKitchen(window, menu.cookingDate) }
            : { placeId: use.placeId }
          : use,
      ),
    );
  const draftOf = (place: PickupPlace | null): PlaceDraft => {
    const shown = place ? windowToDevice(place.window, menu.cookingDate) : null;
    return {
      id: place?.id ?? null,
      place: place?.place ?? '',
      start: shown?.start ?? '10:00',
      end: shown?.end ?? '12:00',
      en: place?.directions.en ?? '',
      id_: place?.directions.id ?? '',
    };
  };
  const savePlace = (draft: PlaceDraft) => {
    const directions = { en: draft.en.trim(), id: draft.id_.trim() };
    const window = windowToKitchen({ start: draft.start, end: draft.end }, menu.cookingDate);
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
    <>
      <HowRow>
        <h2>{t('details.how.title')}</h2>
        <Segmented
          options={howOptions}
          value={how}
          onChange={choose}
          label={t('details.how.title')}
        />
      </HowRow>
      <Columns>
        <Col aria-label={t('details.when')}>
          <h2>{t('details.when')}</h2>
          <SyncedField
            label={t('details.cookingDay')}
            type="date"
            value={menu.cookingDate}
            helper={t('details.cookingHelper')}
            valid={(next) => DATE.test(next)}
            onCommit={(next) => {
              // Days that fall out of range for the new cooking day are dropped with it.
              const delivery = deliveryForMovedDay(menu, note, next);
              run({
                kind: 'updateMenu',
                request: { cookingDate: next, ...(delivery ? { delivery } : {}) },
              });
            }}
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
          <KeepOpenRow
            on={keepOpen}
            busy={busy}
            lastDay={lastOpenDay(menu)}
            lang={lang}
            onToggle={() => run({ kind: 'updateMenu', request: { finishExtraDay: !keepOpen } })}
          />
          {how === 'pickup' ? null : (
            <>
              <Divider />
              <h2>{t('details.delivery')}</h2>
              <GroupLabel>{t('details.noteFor')}</GroupLabel>
              <Stack>
                <TextArea
                  label={t('dish.english')}
                  value={note.en}
                  maxLength={200}
                  onChange={(event) => setNote({ ...note, en: event.target.value })}
                  onBlur={saveNote}
                />
                <TextArea
                  label={t('dish.indonesian')}
                  value={note.id}
                  maxLength={200}
                  onChange={(event) => setNote({ ...note, id: event.target.value })}
                  onBlur={saveNote}
                />
              </Stack>
              <DraftNotice draft={noteDraft} />
              <Muted>{t('details.addressNote')}</Muted>
            </>
          )}
        </Col>
        {how === 'delivery' ? null : (
          <Col aria-label={t('details.places')}>
            <Head>
              <h2>{t('details.places')}</h2>
              <Muted>{t('details.chosen', { count: uses.length })}</Muted>
            </Head>
            <Muted>{t('details.placesHelp')}</Muted>
            {data.places.map((place) => {
              const use = uses.find((candidate) => candidate.placeId === place.id);
              const stored = use?.window ?? place.window;
              const window = windowToDevice(stored, menu.cookingDate);
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
                    <span>{formatWindow(stored.start, stored.end, lang, menu.cookingDate)}</span>
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
                          onCommit={(next) =>
                            setOverride(place, { start: window.start, end: next })
                          }
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
            {editing ? <DraftNotice draft={placeDraft} /> : null}
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
              <Muted>
                {t('details.nOfSaved', { n: data.places.length, max: MAX_PICKUP_PLACES })}
              </Muted>
            </Head>
            {placeError ? <ErrorText role="alert">{placeError}</ErrorText> : null}
            <Muted>{t('details.placesFoot')}</Muted>
          </Col>
        )}
        {how === 'pickup' ? null : (
          <DeliveryDaysField
            cookingDate={menu.cookingDate}
            delivery={menu.delivery}
            lang={lang}
            onChange={(next) =>
              run({
                kind: 'updateMenu',
                request: { delivery: deliveryWith(menu.delivery.available, next) },
              })
            }
          />
        )}
        <PictureCol aria-label={t('details.picture.title')}>
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
              <Button
                variant="quiet"
                disabled={busy}
                onClick={() => run({ kind: 'removePicture' })}
              >
                {t('details.picture.remove')}
              </Button>
            ) : null}
          </Actions>
          {pastWithPicture.length > 0 ? (
            <>
              <Actions>
                <Button
                  variant="quiet"
                  disabled={busy}
                  aria-expanded={pastPicking}
                  onClick={() => setPastPicking(!pastPicking)}
                >
                  {t('details.picture.usePast')}
                </Button>
              </Actions>
              {pastPicking ? (
                <Past>
                  {pastWithPicture.map((week) => (
                    <PastPick
                      key={week.id}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setPastPicking(false);
                        run({ kind: 'usePastPicture', pastMenuId: week.id });
                      }}
                    >
                      <img src={week.pictureUrl} alt="" loading="lazy" />
                      {t('details.picture.fromPast', { date: formatDay(week.cookingDate, lang) })}
                    </PastPick>
                  ))}
                </Past>
              ) : null}
            </>
          ) : null}
          {pictureError ? <ErrorText role="alert">{pictureError}</ErrorText> : null}
          <Muted>{t('details.picture.foot')}</Muted>
        </PictureCol>
        {askRemove ? (
          <WarningDialog
            title={t('details.how.removeTitle')}
            cancelLabel={t('details.how.keep')}
            continueLabel={t('details.how.remove')}
            onCancel={() => setAskRemove(false)}
            onContinue={confirmRemove}
          >
            {t('details.how.removeBody')}
          </WarningDialog>
        ) : null}
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
    </>
  );
}
