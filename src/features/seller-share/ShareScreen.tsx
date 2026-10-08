import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import { Button, Segmented, Toast, type SegmentedOption } from '../../ui';
import { SHARE_NS } from './i18n/register';
import { loadRequested, type ShareRootState } from './shareSlice';
import { buildShareText, type PostLanguage } from './shareText';

/** Where the customer link points; the app shell passes `window.location.origin` by default. */
export type ShareScreenProps = Readonly<{ origin?: string }>;

const Page = styled.main`
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  max-width: min(100%, 45rem);
  margin: 0 auto;
`;
const Title = styled.h1`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.lg}
    ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.type.size.lg};
  line-height: ${({ theme }) => theme.type.lineHeight.tight};
`;
const Block = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border-bottom: ${({ theme }) => theme.border.hairline} solid
    ${({ theme }) => theme.colour.hairline};
`;
const Label = styled.span`
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
const Scroll = styled.div`
  overflow-x: auto;
`;
const Preview = styled.pre`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colour.surface};
  font: inherit;
  font-size: ${({ theme }) => theme.type.size.sm};
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`;
const Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
`;
const Centered = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.colour.textMuted};
`;

const POSTS: ReadonlyArray<PostLanguage> = ['id', 'en', 'both'];

/** Hands the text to the phone's share sheet, or to WhatsApp's own link where there is none. */
function shareText(text: string): void {
  if (typeof navigator.share === 'function') {
    // Closing the sheet rejects the promise; that is not an error.
    void navigator.share({ text }).catch(() => undefined);
    return;
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}

/**
 * S5. Route-agnostic. Menu images (collage, up to 5) come with batch 3, so only the text is
 * shared here.
 */
export function ShareScreen({ origin = window.location.origin }: ShareScreenProps) {
  const { t } = useTranslation(SHARE_NS);
  const dispatch = useDispatch();
  const state = useSelector((root: ShareRootState) => root.sellerShare);
  const [post, setPost] = useState<PostLanguage>('id');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    dispatch(loadRequested());
  }, [dispatch]);

  const text = useMemo(
    () =>
      state.menu && state.settings ? buildShareText(state.menu, state.settings, post, origin) : '',
    [state.menu, state.settings, post, origin],
  );
  const options: ReadonlyArray<SegmentedOption<PostLanguage>> = POSTS.map((value) => ({
    value,
    label: t(`language.${value}`),
  }));

  const retry = useCallback(() => dispatch(loadRequested()), [dispatch]);
  const share = useCallback(() => shareText(text), [text]);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(
      () => setToast(t('copied')),
      () => setToast(t('copyFailed')),
    );
  }, [text, t]);
  const dismiss = useCallback(() => setToast(null), []);

  return (
    <Page>
      <Title>{t('title')}</Title>
      {state.status === 'loading' ? <Centered role="status">{t('loading')}</Centered> : null}
      {state.status === 'error' ? (
        <Centered role="alert">
          {t('error')}{' '}
          <Button variant="quiet" onClick={retry}>
            {t('retry')}
          </Button>
        </Centered>
      ) : null}
      {state.status === 'ready' ? (
        <>
          <Block>
            <Label>{t('language.label')}</Label>
            <Scroll>
              <Segmented
                options={options}
                value={post}
                onChange={setPost}
                label={t('language.label')}
              />
            </Scroll>
          </Block>
          <Block>
            <Label>{t('preview')}</Label>
            <Preview aria-label={t('preview')}>{text}</Preview>
          </Block>
          <Actions>
            <Button variant="primary" fullWidth onClick={share}>
              {t('share')}
            </Button>
            <Button fullWidth onClick={copy}>
              {t('copy')}
            </Button>
          </Actions>
        </>
      ) : null}
      <Toast message={toast} onDismiss={dismiss} />
    </Page>
  );
}
