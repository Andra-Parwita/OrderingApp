import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { KitchenImages } from '../../../shared/domain';
import { IMAGE_SLOTS, slotSpec, type ImageSlot } from '../../../shared/imageSlots';
import { isHexColour, phoneBannerSrc } from '../../../shared/kitchenImages';
import { Button, ConfirmButton, ImageSlot as Picture, TextField, Toast } from '../../ui';
import { ImageReadError, resizeImage, type ResizeFn, type ResizeResult } from './imageResize';
import { SETUP_NS } from './i18n/register';
import {
  Actions,
  Body,
  Centered,
  Failure,
  Hint,
  Page,
  Row,
  Section,
  SectionTitle,
  Title,
} from './parts';
import {
  imagesRequested,
  removeRequested,
  styleRequested,
  toastDismissed,
  uploadRequested,
  type SetupRootState,
} from './setupSlice';

/** The middle area (D-038) where faces and the logo are safe on the two banners. */
const KEEP: Partial<Record<ImageSlot, { width: number; height: number }>> = {
  desktopBanner: { width: 1500, height: 350 },
  phoneBanner: { width: 1000, height: 340 },
};

const FALLBACK_COLOUR = '#ffffff';

// ---- Live preview ------------------------------------------------------------------------

const cssUrl = (src: string) => `url("${src.replace(/["\\\n]/g, encodeURIComponent)}")`;

const Strip = styled.div<{ $colour: string; $image: string | undefined }>`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.radius.md};
  background-color: ${({ $colour }) => $colour};
  background-image: ${({ $image }) => ($image ? cssUrl($image) : 'none')};
  background-position: center;
  background-size: cover;
`;
const Rail = styled.div`
  display: flex;
  flex: none;
  width: 28%;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.xs};
  background: ${({ theme }) => theme.colour.surface};
  border-radius: ${({ theme }) => theme.radius.sm};
`;
const Main = styled.div`
  flex: 1;
  min-width: 0;
`;
const PhoneFrame = styled.div`
  width: 9rem;
  overflow: hidden;
  border: ${({ theme }) => theme.border.focus} solid ${({ theme }) => theme.colour.text};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colour.surface};
`;
const Caption = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.type.size.sm};
  color: ${({ theme }) => theme.colour.textMuted};
`;

type PreviewProps = Readonly<{ images: KitchenImages; colour: string }>;

function Preview({ images, colour }: PreviewProps) {
  const { t } = useTranslation(SETUP_NS);
  const alt = (slot: ImageSlot) => t('images.previewAlt', { name: t(`images.slots.${slot}`) });
  const empty = t('images.empty');
  return (
    <Section aria-label={t('images.previewTitle')}>
      <SectionTitle>{t('images.previewTitle')}</SectionTitle>
      <div>
        <Caption>{t('images.previewWide')}</Caption>
        <Strip $colour={colour} $image={images.bannerBackgroundImage}>
          <Rail>
            <Picture
              aspectRatio="2 / 1"
              src={images.railImage}
              alt={alt('railImage')}
              placeholder=""
            />
            <Picture
              aspectRatio="1 / 1"
              src={images.railIcon}
              alt={alt('railIcon')}
              placeholder=""
              width="2rem"
            />
          </Rail>
          <Main>
            <Picture
              aspectRatio="5 / 1"
              src={images.desktopBanner}
              alt={alt('desktopBanner')}
              placeholder={empty}
              background={colour}
            />
          </Main>
        </Strip>
      </div>
      <div>
        <Caption>{t('images.previewPhone')}</Caption>
        <PhoneFrame>
          <Picture
            aspectRatio="3 / 1"
            src={phoneBannerSrc(images)}
            alt={alt('phoneBanner')}
            placeholder={empty}
            background={colour}
          />
        </PhoneFrame>
      </div>
    </Section>
  );
}

// ---- One slot ----------------------------------------------------------------------------

const Card = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding-top: ${({ theme }) => theme.spacing.md};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
`;
const CardTitle = styled.h3`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.base};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
const FileInput = styled.input`
  display: none;
`;
const Warning = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colour.surfaceAlt};
`;

type Pending = ResizeResult;

type SlotCardProps = Readonly<{
  slot: ImageSlot;
  src: string | undefined;
  busy: boolean;
  disabled: boolean;
  background: string;
  failureCode: string | undefined;
  resize: ResizeFn;
}>;

function SlotCard({ slot, src, busy, disabled, background, failureCode, resize }: SlotCardProps) {
  const { t } = useTranslation(SETUP_NS);
  const dispatch = useDispatch();
  const input = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [readError, setReadError] = useState<string | null>(null);

  const spec = slotSpec(slot);
  const keep = KEEP[slot];
  const name = t(`images.slots.${slot}`);
  const ratio = `${spec.width} / ${spec.height}`;
  const errorCode = readError ?? failureCode;

  const choose = useCallback(() => input.current?.click(), []);
  const onFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      setReadError(null);
      setPending(null);
      setWorking(true);
      try {
        const result = await resize(file, slot, background);
        if (result.offRatio) setPending(result);
        else dispatch(uploadRequested({ slot, dataUrl: result.dataUrl }));
      } catch (error) {
        setReadError(error instanceof ImageReadError ? error.code : 'other');
      } finally {
        setWorking(false);
      }
    },
    [background, dispatch, resize, slot],
  );
  const accept = useCallback(() => {
    if (pending) dispatch(uploadRequested({ slot, dataUrl: pending.dataUrl }));
    setPending(null);
  }, [dispatch, pending, slot]);
  const cancel = useCallback(() => setPending(null), []);
  const remove = useCallback(() => dispatch(removeRequested(slot)), [dispatch, slot]);

  return (
    <Card>
      <CardTitle>{name}</CardTitle>
      <Hint>
        {keep
          ? t('images.guideKeep', {
              width: spec.width,
              height: spec.height,
              keepWidth: keep.width,
              keepHeight: keep.height,
            })
          : t('images.guide', { width: spec.width, height: spec.height })}
      </Hint>
      <div>
        <Picture
          aspectRatio={ratio}
          src={src}
          alt={name}
          placeholder={t('images.empty')}
          background={background}
          width={slot === 'railIcon' ? '6rem' : slot === 'railImage' ? '14rem' : undefined}
        />
      </div>

      {pending ? (
        <Warning role="group" aria-label={t('images.warn.title')}>
          <strong>{t('images.warn.title')}</strong>
          <span>
            {t('images.warn.body', { width: pending.sourceWidth, height: pending.sourceHeight })}
          </span>
          <Picture
            aspectRatio={ratio}
            src={pending.dataUrl}
            alt={t('images.previewAlt', { name })}
            placeholder=""
          />
          <Actions>
            <Button variant="primary" onClick={accept}>
              {t('images.warn.use')}
            </Button>
            <Button variant="secondary" onClick={cancel}>
              {t('images.warn.cancel')}
            </Button>
          </Actions>
        </Warning>
      ) : null}

      {working || busy ? <Hint role="status">{t('images.working')}</Hint> : null}
      {errorCode ? (
        <Failure role="alert">
          {t(`images.errors.${errorCode in ERRORS ? errorCode : 'other'}`)}
        </Failure>
      ) : null}

      <FileInput
        ref={input}
        type="file"
        accept="image/*"
        tabIndex={-1}
        aria-label={t('images.fileFor', { name })}
        onChange={(event) => void onFile(event)}
      />
      <Actions>
        <Button
          variant="secondary"
          onClick={choose}
          disabled={disabled || working || pending !== null}
        >
          {src ? t('images.change') : t('images.upload')}
        </Button>
        {src ? (
          <ConfirmButton
            label={t('images.remove')}
            confirmLabel={t('images.removeConfirm')}
            onConfirm={remove}
            disabled={disabled}
          />
        ) : null}
      </Actions>
    </Card>
  );
}

const ERRORS: Record<string, true> = { image_type: true, image_too_big: true, image_ratio: true };

// ---- Colour and text ---------------------------------------------------------------------

const ColourRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: ${({ theme }) => theme.spacing.md};

  & > :last-child {
    flex: 1;
  }
`;
const Swatch = styled.input`
  width: ${({ theme }) => theme.minTapTarget};
  height: ${({ theme }) => theme.minTapTarget};
  padding: 0;
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.outline};
  border-radius: ${({ theme }) => theme.radius.md};
  background: transparent;
  cursor: pointer;
`;

type ImagesBodyProps = Readonly<{ resize: ResizeFn }>;

function ImagesBody({ resize }: ImagesBodyProps) {
  const { t } = useTranslation(SETUP_NS);
  const dispatch = useDispatch();
  const { data, busy, failure } = useSelector((state: SetupRootState) => state.sellerSetup.images);
  const [colour, setColour] = useState(data.bannerBackground ?? '');
  const [altEn, setAltEn] = useState(data.alt?.en ?? '');
  const [altId, setAltId] = useState(data.alt?.id ?? '');
  const [submitted, setSubmitted] = useState(false);

  const colourValid = colour.trim() === '' || isHexColour(colour.trim());
  const shown = isHexColour(colour.trim()) ? colour.trim() : FALLBACK_COLOUR;

  const onColour = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setSubmitted(false);
    setColour(event.target.value);
  }, []);
  const onSave = useCallback(
    (event: { preventDefault: () => void }) => {
      event.preventDefault();
      setSubmitted(true);
      if (!colourValid) return;
      const trimmed = colour.trim();
      dispatch(
        styleRequested({
          bannerBackground: trimmed === '' ? null : trimmed.toLowerCase(),
          alt: { en: altEn.trim(), id: altId.trim() },
        }),
      );
    },
    [altEn, altId, colour, colourValid, dispatch],
  );

  const slotFailure = (slot: ImageSlot) =>
    failure && failure.target === slot ? failure.code : undefined;

  return (
    <Body>
      <Preview images={data} colour={shown} />

      <Section>
        <SectionTitle>{t('images.title')}</SectionTitle>
        {IMAGE_SLOTS.map((slot) => (
          <SlotCard
            key={slot}
            slot={slot}
            src={data[slot]}
            busy={busy === slot}
            disabled={busy !== null}
            background={shown}
            failureCode={slotFailure(slot)}
            resize={resize}
          />
        ))}
      </Section>

      <Section as="form" onSubmit={onSave} noValidate>
        <SectionTitle>{t('images.styleTitle')}</SectionTitle>
        <ColourRow>
          <Swatch
            type="color"
            aria-label={t('images.colourPick')}
            value={isHexColour(colour.trim()) ? colour.trim().toLowerCase() : FALLBACK_COLOUR}
            onChange={onColour}
          />
          <TextField
            label={t('images.colourHex')}
            helper={t('images.colourHelper')}
            error={submitted && !colourValid ? t('images.colourInvalid') : undefined}
            value={colour}
            maxLength={7}
            autoComplete="off"
            onChange={onColour}
          />
        </ColourRow>
        <Row>
          <TextField
            label={t('images.altEn')}
            helper={t('images.altHelper')}
            value={altEn}
            maxLength={200}
            onChange={(event) => setAltEn(event.target.value)}
          />
          <TextField
            label={t('images.altId')}
            value={altId}
            maxLength={200}
            onChange={(event) => setAltId(event.target.value)}
          />
        </Row>
        {failure && failure.target === 'style' ? (
          <Failure role="alert">{t('images.styleFailed')}</Failure>
        ) : null}
        <Button type="submit" variant="primary" fullWidth disabled={busy !== null}>
          {busy === 'style' ? t('images.saving') : t('images.saveStyle')}
        </Button>
      </Section>
    </Body>
  );
}

/**
 * Pictures (D-038, D-040), route-agnostic: five slots with size guides, a live preview and the
 * banner colour. Pictures are resized in the browser first; `resize` is injectable for tests.
 */
export function ImagesScreen({
  resize = resizeImage,
  embedded = false,
}: Readonly<{ resize?: ResizeFn; embedded?: boolean }>) {
  const { t } = useTranslation(SETUP_NS);
  const dispatch = useDispatch();
  const load = useSelector((state: SetupRootState) => state.sellerSetup.images.load);
  const toast = useSelector((state: SetupRootState) => state.sellerSetup.toast);

  useEffect(() => {
    dispatch(imagesRequested());
  }, [dispatch]);

  const retry = useCallback(() => dispatch(imagesRequested()), [dispatch]);
  const dismiss = useCallback(() => dispatch(toastDismissed()), [dispatch]);

  return (
    <Page>
      {embedded ? null : <Title>{t('images.title')}</Title>}
      {load === 'loading' ? <Centered role="status">{t('loading')}</Centered> : null}
      {load === 'error' ? (
        <Centered role="alert">
          {t('error')}{' '}
          <Button variant="quiet" onClick={retry}>
            {t('retry')}
          </Button>
        </Centered>
      ) : null}
      {load === 'ready' ? <ImagesBody resize={resize} /> : null}
      <Toast message={toast ? t('saved') : null} onDismiss={dismiss} />
    </Page>
  );
}
