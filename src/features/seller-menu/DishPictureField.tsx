import { useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { styled, useTheme } from 'styled-components';
import { MAX_DISH_PICTURES } from '../../../shared/limits';
import type { Dish } from '../../../shared/menusContract';
import { ImageReadError, resizeImage } from '../../components/imageResize';
import { Button, Icon, WarningDialog } from '../../ui';
import { MENU_NS } from './i18n/register';
import { ErrorText, Muted, useOpWatch, useRunOp } from './menuShared';

// Plan 067 (D-103): the dish editor's "Picture (optional)" field. The photo is cropped square and
// shrunk to 600 x 600 on the device before it is sent; Remove always asks first.

const Box = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md} 0;
  border-block: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const Label = styled.span`
  font-size: 0.8125rem;
  font-weight: 600;
`;
const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Has = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  align-items: flex-start;
`;
const Thumb = styled.img<{ $dim?: boolean }>`
  flex: none;
  width: 6rem;
  height: 6rem;
  object-fit: cover;
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: ${({ theme }) => theme.radius.md};
  opacity: ${({ $dim }) => ($dim ? 0.45 : 1)};
`;
const Side = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  min-width: 0;
`;
const Working = styled.p`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  margin: 0;
  font-size: 0.8125rem;
`;
const Spin = styled.span`
  flex: none;
  width: 1.125rem;
  height: 1.125rem;
  border: ${({ theme }) => theme.border.focus} solid ${({ theme }) => theme.c.line};
  border-top-color: ${({ theme }) => theme.c.fill};
  border-radius: 50%;
  animation: dish-picture-spin 1s linear infinite;

  @keyframes dish-picture-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;
const Info = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: ${({ theme }) => theme.radius.md};
  font-size: 0.8125rem;
`;
const Hidden = styled.input`
  display: none;
`;

export type DishPictureFieldProps = Readonly<{
  /** The saved library dish; without one (a new dish) the picture can only be added after saving. */
  dish: Dish | undefined;
  /** How many dishes in the kitchen have a picture. */
  pictureCount: number;
}>;

export function DishPictureField({ dish, pictureCount }: DishPictureFieldProps) {
  const { t } = useTranslation(MENU_NS);
  const theme = useTheme();
  const { run, busy } = useRunOp();
  const file = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useOpWatch(['uploadDishPicture', 'removeDishPicture'], {
    onDone: () => {
      setWorking(false);
      setPreview(null);
    },
    onFail: (result) => {
      setWorking(false);
      setPreview(null);
      // At the limit the neutral note below says why; any other failure is the retry message.
      setFailure(result.code === 'dish_picture_limit' ? null : t('dish.picture.failed'));
    },
  });

  if (!dish) {
    return (
      <Box>
        <Label>
          {t('dish.picture.title')} <Muted as="span">{t('dish.picture.optional')}</Muted>
        </Label>
        <Muted>{t('dish.picture.saveFirst')}</Muted>
      </Box>
    );
  }

  const has = dish.pictureRef !== undefined;
  const atLimit = !has && pictureCount >= MAX_DISH_PICTURES;
  const shownSrc = preview ?? dish.pictureRef;

  const pick = (capture: boolean) => {
    const input = file.current;
    if (!input) return;
    if (capture) input.setAttribute('capture', 'environment');
    else input.removeAttribute('capture');
    input.click();
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    event.target.value = '';
    if (!chosen) return;
    setFailure(null);
    setWorking(true);
    try {
      const { dataUrl } = await resizeImage(chosen, 'dishPicture', theme.c.surf);
      setPreview(dataUrl);
      run({ kind: 'uploadDishPicture', id: dish.id, dataUrl });
    } catch (error) {
      setWorking(false);
      setFailure(
        error instanceof ImageReadError && error.code === 'image_too_big'
          ? t('dish.picture.imageTooBig')
          : t('dish.picture.imageType'),
      );
    }
  };

  return (
    <Box role="group" aria-label={t('dish.picture.title')}>
      <Label>
        {t('dish.picture.title')} <Muted as="span">{t('dish.picture.optional')}</Muted>
      </Label>
      <Hidden
        ref={file}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label={t('dish.picture.choose')}
        onChange={(event) => void onFile(event)}
      />
      {working ? (
        <Has>
          {shownSrc ? <Thumb src={shownSrc} alt="" width={96} height={96} $dim /> : null}
          <Side>
            <Working role="status">
              <Spin aria-hidden="true" />
              {t('dish.picture.working')}
            </Working>
          </Side>
        </Has>
      ) : has ? (
        <Has>
          <Thumb
            src={dish.pictureRef}
            alt={t('dish.picture.alt', { name: dish.name.en || dish.name.id })}
            width={96}
            height={96}
          />
          <Side>
            <Muted>600 × 600</Muted>
            <Actions>
              <Button disabled={busy} onClick={() => pick(false)}>
                <Icon name="swap" />
                {t('dish.picture.replace')}
              </Button>
              <Button variant="destructive" disabled={busy} onClick={() => setAsking(true)}>
                {t('dish.picture.remove')}
              </Button>
            </Actions>
          </Side>
        </Has>
      ) : (
        <>
          <Actions>
            <Button disabled={busy || atLimit} onClick={() => pick(true)}>
              <Icon name="camera" />
              {t('dish.picture.take')}
            </Button>
            <Button disabled={busy || atLimit} onClick={() => pick(false)}>
              <Icon name="image" />
              {t('dish.picture.choose')}
            </Button>
          </Actions>
          {atLimit ? null : <Muted>{t('dish.picture.hint')}</Muted>}
        </>
      )}
      {atLimit ? (
        <Info role="status">
          {t('dish.picture.limit', { count: pictureCount, max: MAX_DISH_PICTURES })}
        </Info>
      ) : null}
      {failure ? <ErrorText role="alert">{failure}</ErrorText> : null}
      {asking ? (
        <WarningDialog
          title={t('dish.picture.removeTitle')}
          cancelLabel={t('dish.picture.keep')}
          continueLabel={t('dish.picture.removeConfirm')}
          onCancel={() => setAsking(false)}
          onContinue={() => {
            setAsking(false);
            setFailure(null);
            setWorking(true);
            run({ kind: 'removeDishPicture', id: dish.id });
          }}
        >
          {t('dish.picture.removeBody')}
        </WarningDialog>
      ) : null}
    </Box>
  );
}
