import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { correction, generate } from 'lean-qr';
import { toSvgPath } from 'lean-qr/extras/svg';
import { fetchMenu } from '../../api/client';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { whatsAppUrl } from '../../api/device/whatsapp';
import { Button, Toast } from '../../ui';
import { SETTINGS_NS } from './i18n/register';
import { ButtonRow, GroupTitle, Muted, PaneGroup } from './paneParts';

// Duplicate of ShareScreen's `${origin}/${slug}` (a feature may not import another feature).
export const customerLink = (origin: string, slug: string) => `${origin}/${slug}`;

// Always dark on white (scanners need the contrast), so not theme tokens. Same as OrderQr.
const INK: [number, number, number] = [20, 20, 20];
const PAPER: [number, number, number] = [255, 255, 255];
const QUIET = 2;
const SCREEN_PX = 224;
/** Pixels per module in the saved PNG: large enough to scan from a printed page. */
const PNG_SCALE = 12;

const LinkText = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme }) => theme.c.surf2};
  color: ${({ theme }) => theme.c.text};
  overflow-wrap: anywhere;
  user-select: all;
`;
const QrBox = styled.div`
  align-self: flex-start;
  line-height: 0;
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;

export const sellerLink = (origin: string, slug: string) =>
  `${origin}/seller/sign-in?kitchen=${encodeURIComponent(slug)}`;

const makeQr = (link: string) => {
  const bitmap = generate(link, { minCorrectionLevel: correction.M });
  return { bitmap, path: toSvgPath(bitmap), side: bitmap.size + QUIET * 2 };
};

function QrSvg({
  qr,
  label,
  testId,
}: Readonly<{ qr: ReturnType<typeof makeQr>; label: string; testId: string }>) {
  return (
    <QrBox>
      <svg
        role="img"
        aria-label={label}
        width={SCREEN_PX}
        height={SCREEN_PX}
        viewBox={`${-QUIET} ${-QUIET} ${qr.side} ${qr.side}`}
        shapeRendering="crispEdges"
        data-testid={testId}
      >
        <rect x={-QUIET} y={-QUIET} width={qr.side} height={qr.side} fill="#FFFFFF" />
        <path d={qr.path} fill="#141414" />
      </svg>
    </QrBox>
  );
}

type ActionsProps = Readonly<{
  link: string;
  shareText: string;
  copyLabel: string;
  shareLabel: string;
  onToast: (message: string) => void;
}>;

/** Copy and Share buttons for one link (clipboard; share sheet, else WhatsApp). */
function LinkActions({ link, shareText, copyLabel, shareLabel, onToast }: ActionsProps) {
  const { t } = useTranslation(SETTINGS_NS);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(link).then(
      () => onToast(t('link.copied')),
      () => onToast(t('link.copyFailed')),
    );
  }, [link, onToast, t]);
  const share = useCallback(() => {
    if (typeof navigator.share === 'function') {
      // Closing the sheet rejects the promise; that is not an error.
      void navigator.share({ text: shareText }).catch(() => undefined);
    } else {
      window.open(whatsAppUrl(shareText), '_blank', 'noopener');
    }
  }, [shareText]);
  return (
    <ButtonRow>
      <Button variant="primary" onClick={copy}>
        {copyLabel}
      </Button>
      <Button variant="secondary" onClick={share}>
        {shareLabel}
      </Button>
    </ButtonRow>
  );
}

type Props = Readonly<{ origin?: string; slug?: string }>;

/** Settings, "Links": customer link (copy, share, QR to save or print) and the seller app link. */
export function CustomerLinkPane({
  origin = window.location.origin,
  slug = currentSellerSlug(),
}: Props) {
  const { t } = useTranslation(SETTINGS_NS);
  const link = customerLink(origin, slug);
  const [name, setName] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void fetchMenu(slug).then((result) => {
      if (live && result.ok) setName(result.data.kitchen.name);
    });
    return () => {
      live = false;
    };
  }, [slug]);

  const seller = sellerLink(origin, slug);
  const qr = useMemo(() => makeQr(link), [link]);
  const sellerQr = useMemo(() => makeQr(seller), [seller]);

  const png = useCallback(
    () =>
      qr.bitmap.toDataURL({
        on: [...INK, 255],
        off: [...PAPER, 255],
        pad: QUIET,
        scale: PNG_SCALE,
      }),
    [qr],
  );
  const download = useCallback(() => {
    const a = document.createElement('a');
    a.href = png();
    a.download = `${slug}-qr.png`;
    a.click();
  }, [png, slug]);
  const print = useCallback(() => {
    const w = window.open('', '_blank');
    if (!w) return;
    const heading = w.document.createElement('p');
    heading.textContent = name || slug;
    const img = w.document.createElement('img');
    img.src = png();
    img.alt = t('link.qrAlt', { link });
    img.style.cssText = 'width:16cm;height:16cm;display:block;margin:1cm auto';
    const text = w.document.createElement('p');
    text.textContent = link;
    w.document.title = name || slug;
    w.document.body.style.cssText = 'font-family:sans-serif;text-align:center;font-size:20pt';
    w.document.body.append(heading, img, text);
    img.onload = () => {
      w.print();
      w.close();
    };
  }, [png, name, slug, link, t]);
  const dismiss = useCallback(() => setToast(null), []);

  return (
    <PaneGroup>
      <Muted>{t('link.intro')}</Muted>
      <LinkText>{link}</LinkText>
      <LinkActions
        link={link}
        shareText={t('link.shareText', { name: name || slug, link })}
        copyLabel={t('link.copy')}
        shareLabel={t('link.share')}
        onToast={setToast}
      />
      <GroupTitle>{t('link.qrTitle')}</GroupTitle>
      <QrSvg qr={qr} label={t('link.qrAlt', { link })} testId="link-qr" />
      <ButtonRow>
        <Button variant="secondary" onClick={download}>
          {t('link.download')}
        </Button>
        <Button variant="secondary" onClick={print}>
          {t('link.print')}
        </Button>
      </ButtonRow>
      <GroupTitle>{t('link.sellerTitle')}</GroupTitle>
      <Muted>{t('link.sellerNote')}</Muted>
      <LinkText>{seller}</LinkText>
      <LinkActions
        link={seller}
        shareText={t('link.sellerShareText', { name: name || slug, link: seller })}
        copyLabel={t('link.sellerCopy')}
        shareLabel={t('link.sellerShare')}
        onToast={setToast}
      />
      <QrSvg qr={sellerQr} label={t('link.qrAlt', { link: seller })} testId="seller-link-qr" />
      <Toast message={toast} onDismiss={dismiss} />
    </PaneGroup>
  );
}
