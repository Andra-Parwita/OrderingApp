import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { KitchenImages } from '../../../shared/domain';
import { IMAGE_SLOTS, type ImageSlot } from '../../../shared/imageSlots';
import { isHexColour } from '../../../shared/kitchenImages';
import type { ImagesResponse } from '../../../shared/setupContract';
import type { ApiResult } from '../../api/http';
import { Button } from '../../ui';
import { resizeImage, type ResizeFn } from './imageResize';
import { SETUP_NS } from './i18n/register';
import { SlotCard } from './ImagesScreen';
import { Failure, Hint, Section } from './parts';

export type KitchenImagesCalls = Readonly<{
  load: () => Promise<ApiResult<ImagesResponse>>;
  upload: (slot: ImageSlot, dataUrl: string) => Promise<ApiResult<ImagesResponse>>;
  remove: (slot: ImageSlot) => Promise<ApiResult<ImagesResponse>>;
}>;

type Props = Readonly<{
  /** The calls to use; give a stable object (the editor loads again when it changes). */
  calls: KitchenImagesCalls;
  resize?: ResizeFn;
}>;

/**
 * The five picture slots with the same cards as Settings → Images (plan 041), without the app's
 * store: the caller injects load / upload / remove (the admin's calls for a chosen kitchen).
 */
export function KitchenImagesEditor({ calls, resize = resizeImage }: Props) {
  const { t } = useTranslation(SETUP_NS);
  const [images, setImages] = useState<KitchenImages | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState<ImageSlot | null>(null);
  const [failure, setFailure] = useState<{ slot: ImageSlot; code: string } | null>(null);

  const load = useCallback(async () => {
    setLoadFailed(false);
    const result = await calls.load();
    if (result.ok) setImages(result.data.images);
    else setLoadFailed(true);
  }, [calls]);

  useEffect(() => {
    // A call that sets state after a network round trip, started when the editor opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const run = useCallback(
    async (slot: ImageSlot, call: () => Promise<ApiResult<ImagesResponse>>) => {
      setBusy(slot);
      setFailure(null);
      const result = await call();
      setBusy(null);
      if (result.ok) setImages(result.data.images);
      else setFailure({ slot, code: result.error });
    },
    [],
  );
  const onUpload = useCallback(
    (slot: ImageSlot, dataUrl: string) => void run(slot, () => calls.upload(slot, dataUrl)),
    [calls, run],
  );
  const onRemove = useCallback(
    (slot: ImageSlot) => void run(slot, () => calls.remove(slot)),
    [calls, run],
  );

  if (loadFailed) {
    return (
      <Failure role="alert">
        {t('error')}{' '}
        <Button variant="quiet" onClick={() => void load()}>
          {t('retry')}
        </Button>
      </Failure>
    );
  }
  if (!images) return <Hint role="status">{t('loading')}</Hint>;
  const colour = images.bannerBackground?.trim() ?? '';
  const background = isHexColour(colour) ? colour : '#ffffff';
  return (
    <Section>
      {IMAGE_SLOTS.map((slot) => (
        <SlotCard
          key={slot}
          slot={slot}
          src={images[slot]}
          busy={busy === slot}
          disabled={busy !== null}
          background={background}
          failureCode={failure?.slot === slot ? failure.code : undefined}
          resize={resize}
          onUpload={onUpload}
          onRemove={onRemove}
        />
      ))}
    </Section>
  );
}
