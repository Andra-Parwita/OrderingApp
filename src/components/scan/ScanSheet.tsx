import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { Button, SlideOver } from '../../ui';
import { createDecoder, type Decoder } from './decoder';
import { SCAN_NS } from './i18n/register';

/** Opens the back camera. Injectable so tests can fake the stream. */
export type CameraOpener = () => Promise<MediaStream>;

const openBackCamera: CameraOpener = () =>
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });

/** How often a frame is read: about 8 per second. */
const SCAN_EVERY_MS = 125;

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.size.pagePadPhone}px
    ${({ theme }) => theme.spacing.xl};
`;
const Heading = styled.h2`
  margin: 0;
  font-size: 1.25rem;
`;
const Stage = styled.div`
  position: relative;
  overflow: hidden;
  max-height: 60dvh;
  aspect-ratio: 4 / 3;
  background: ${({ theme }) => theme.c.surf2};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;

  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  /* A thin guide frame; the whole image is read, not only the inside. */
  &::after {
    content: '';
    position: absolute;
    inset: 18%;
    border: ${({ theme }) => theme.border.focus} solid ${({ theme }) => theme.c.fill};
    border-radius: ${({ theme }) => theme.size.radiusControl}px;
    pointer-events: none;
  }
`;
const Quiet = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
`;
const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
`;

type Props = Readonly<{
  /** Called once with the decoded text; the camera is already stopped. */
  onCode: (text: string) => void;
  onClose: () => void;
  /** The camera was refused or is missing: the caller moves to the typed-code search. */
  onTypeCode: () => void;
  decode?: Decoder;
  openCamera?: CameraOpener;
}>;

type Phase = 'starting' | 'live' | 'denied';

/** The camera view: a full-width sheet with a heading, the picture, a torch toggle and Cancel. */
export function ScanSheet({
  onCode,
  onClose,
  onTypeCode,
  decode,
  openCamera = openBackCamera,
}: Props) {
  const { t } = useTranslation(SCAN_NS);
  const video = useRef<HTMLVideoElement>(null);
  const track = useRef<MediaStreamTrack | null>(null);
  const [phase, setPhase] = useState<Phase>('starting');
  const [torch, setTorch] = useState<boolean | null>(null);
  const latest = useRef({ onCode, decode, openCamera });
  useEffect(() => {
    latest.current = { onCode, decode, openCamera };
  });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let stream: MediaStream | undefined;
    // Every track must stop, or the camera light stays on.
    const release = () => {
      clearInterval(timer);
      stream?.getTracks().forEach((each) => each.stop());
      stream = undefined;
      track.current = null;
    };
    void (async () => {
      try {
        const opened = await latest.current.openCamera();
        if (cancelled) {
          opened.getTracks().forEach((each) => each.stop());
          return;
        }
        stream = opened;
        const element = video.current;
        if (element) {
          element.srcObject = opened;
          try {
            await element.play();
          } catch {
            // Autoplay is allowed for a muted inline video; if not, frames simply never arrive.
          }
        }
        const first = opened.getVideoTracks()[0] ?? null;
        track.current = first;
        const caps = first?.getCapabilities?.() as { torch?: boolean } | undefined;
        if (caps?.torch) setTorch(false);
        const read = latest.current.decode ?? (await createDecoder());
        if (cancelled) return;
        setPhase('live');
        let busy = false;
        timer = setInterval(() => {
          if (busy || !element || element.readyState < 2) return;
          busy = true;
          void read(element)
            .then((text) => {
              if (!text || cancelled) return;
              cancelled = true;
              release();
              navigator.vibrate?.(60);
              latest.current.onCode(text);
            })
            .catch(() => undefined)
            .finally(() => {
              busy = false;
            });
        }, SCAN_EVERY_MS);
      } catch {
        release();
        if (!cancelled) setPhase('denied');
      }
    })();
    return () => {
      cancelled = true;
      release();
    };
  }, []);

  const flipTorch = () => {
    const next = !torch;
    void track.current
      ?.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      .then(() => setTorch(next))
      .catch(() => undefined);
  };

  return (
    <SlideOver label={t('title')} closeLabel={t('cancel')} onClose={onClose} width="100%">
      <Body>
        <Heading>{t('title')}</Heading>
        {phase === 'denied' ? (
          <>
            <Quiet role="alert">{t('denied')}</Quiet>
            <Row>
              <Button variant="primary" onClick={onTypeCode}>
                {t('typeCode')}
              </Button>
            </Row>
          </>
        ) : (
          <>
            <Stage>
              <video ref={video} playsInline muted aria-label={t('aim')} />
            </Stage>
            <Quiet role="status">{phase === 'starting' ? t('starting') : t('aim')}</Quiet>
            {torch !== null ? (
              <Row>
                <Button aria-pressed={torch} onClick={flipTorch}>
                  {torch ? t('torchOff') : t('torchOn')}
                </Button>
              </Row>
            ) : null}
          </>
        )}
        <Quiet>{t('hint')}</Quiet>
      </Body>
    </SlideOver>
  );
}
