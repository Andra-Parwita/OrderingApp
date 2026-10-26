import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { currentSellerSlug } from '../../../api/device/sellerContext';
import { shareToWhatsApp } from '../../../components/shareText/shareAction';
import { loadShareData, type ShareData } from '../../../components/shareText/loadShareData';
import { buildShareText, type PostLanguage } from '../../../components/shareText/shareText';
import { Button, Icon, Segmented, TextArea, Toast, type SegmentedOption } from '../../../ui';
import { LayerBar, LayerBody, LayerShell } from './LayerShell';
import { PHONE_MENU_NS } from './i18n/register';

// Plan 124 (Q4 A, Q5 A): "Share on WhatsApp" on the phone. The ready-made post is a text box she may
// change for this share only: it stays while the layer is open (also after a share), "Reset text" and a
// language switch bring back the ready-made post, Close forgets. Nothing is saved to Settings.

const POSTS: ReadonlyArray<PostLanguage> = ['id', 'en', 'both'];
const LANGUAGE_KEY = 'sellerPhoneShareLanguage';

function savedLanguage(): PostLanguage {
  try {
    const value = window.localStorage.getItem(LANGUAGE_KEY);
    return POSTS.find((post) => post === value) ?? 'id';
  } catch {
    return 'id';
  }
}
function rememberLanguage(post: PostLanguage): void {
  try {
    window.localStorage.setItem(LANGUAGE_KEY, post);
  } catch {
    // Remembering the choice is a convenience only.
  }
}

const Back = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme }) => theme.c.tint};
  color: ${({ theme }) => theme.c.atext};
  font-size: ${({ theme }) => theme.type.size.md};
`;
const Tools = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  min-height: ${({ theme }) => theme.size.tap}px;
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.sm};
`;
const Buttons = styled.div`
  display: flex;
  flex: none;
  gap: ${({ theme }) => theme.spacing.xs};
`;
// 16 px or more, or iOS Safari zooms the page when the box gets focus.
const Box = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  font-size: ${({ theme }) => theme.type.size.base};

  > div {
    display: flex;
    flex: 1;
    flex-direction: column;
  }
  textarea {
    flex: 1;
    min-height: 12rem;
    resize: none;
    line-height: ${({ theme }) => theme.type.lineHeight.normal};
  }
`;
const Centered = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
`;

export function ShareLayer({ onClose }: Readonly<{ onClose: () => void }>) {
  const { t } = useTranslation(PHONE_MENU_NS);
  const [data, setData] = useState<ShareData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [post, setPost] = useState<PostLanguage>(savedLanguage);
  // null = the ready-made post; a string = what she typed (kept until Reset, a language change or Close).
  const [edited, setEdited] = useState<string | null>(null);
  const [back, setBack] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Loaded afresh each time the layer opens: the menu may have changed on the tablet meanwhile.
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    void loadShareData().then((loaded) => {
      if (!live) return;
      setData(loaded);
      setStatus(loaded ? 'ready' : 'error');
    });
    return () => {
      live = false;
    };
  }, [attempt]);

  const ready = useMemo(
    () =>
      data
        ? buildShareText(
            data.menu,
            data.settings,
            post,
            window.location.origin,
            currentSellerSlug(),
          )
        : '',
    [data, post],
  );
  const text = edited ?? ready;
  const changed = edited !== null && edited !== ready;

  const pick = useCallback((next: PostLanguage) => {
    rememberLanguage(next);
    setPost(next);
    setEdited(null);
    setBack(false);
  }, []);
  const reset = useCallback(() => {
    setEdited(null);
    setBack(false);
  }, []);
  const share = useCallback(() => {
    setBack(false);
    void shareToWhatsApp(text).then(() => setBack(true));
  }, [text]);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(
      () => setToast(t('share.copied')),
      () => setToast(t('share.copyFailed')),
    );
  }, [text, t]);
  const dismiss = useCallback(() => setToast(null), []);
  const retry = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  const options: ReadonlyArray<SegmentedOption<PostLanguage>> = POSTS.map((value) => ({
    value,
    label: t(`language.${value}`),
  }));
  const usable = status === 'ready';
  return (
    <LayerShell label={t('share.title')} onClose={onClose}>
      <LayerBar>
        <Button variant="quiet" onClick={onClose}>
          <Icon name="x" />
          {t('share.close')}
        </Button>
        <h2>{t('share.title')}</h2>
        <Button variant="primary" disabled={!usable} onClick={share}>
          {t('share.share')}
        </Button>
      </LayerBar>
      <LayerBody>
        {status === 'loading' ? <Centered role="status">{t('share.loading')}</Centered> : null}
        {status === 'error' ? (
          <Centered role="alert">
            {t('share.error')}{' '}
            <Button variant="quiet" onClick={retry}>
              {t('share.retry')}
            </Button>
          </Centered>
        ) : null}
        {usable ? (
          <>
            {back ? <Back role="status">{t('share.back')}</Back> : null}
            <Segmented options={options} value={post} onChange={pick} label={t('share.language')} />
            <Tools>
              <span>{changed ? t('share.changed') : t('share.hint')}</span>
              <Buttons>
                {changed ? (
                  <Button variant="quiet" onClick={reset}>
                    {t('share.reset')}
                  </Button>
                ) : null}
                <Button variant="quiet" onClick={copy}>
                  {t('share.copy')}
                </Button>
              </Buttons>
            </Tools>
            <Box>
              <TextArea
                label={t('share.textLabel')}
                value={text}
                onChange={(event) => setEdited(event.target.value)}
                enterKeyHint="enter"
              />
            </Box>
          </>
        ) : null}
      </LayerBody>
      <Toast message={toast} onDismiss={dismiss} />
    </LayerShell>
  );
}
