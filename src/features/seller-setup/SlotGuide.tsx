import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { ImageSlot } from '../../../shared/imageSlots';
import { Button, SlideOver } from '../../ui';
import { SETUP_NS } from './i18n/register';

/**
 * The zone template picture of each slot, served from public/guides. The phone banner's is the tall 1200 x 600 one
 * (plan 123): it shows both zones, and a seller can download it as the template.
 */
export const GUIDE_TEMPLATES: Record<ImageSlot, string> = {
  desktopBanner: '/guides/template-desktop-banner.png',
  phoneBanner: '/guides/template-phone-banner-tall.svg',
  railImage: '/guides/template-rail-image.png',
  railIcon: '/guides/template-rail-icon.png',
  bannerBackgroundImage: '/guides/template-banner-background.png',
};

const Template = styled.img`
  display: block;
  width: 100%;
  height: auto;
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
  border-radius: ${({ theme }) => theme.radius.sm};
`;
const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding: 0 ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.xl};
`;
const Lines = styled.ul`
  margin: 0;
  padding-left: ${({ theme }) => theme.spacing.lg};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;
const Download = styled.a`
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  min-height: ${({ theme }) => theme.minTapTarget};
  color: ${({ theme }) => theme.colour.text};
  font-weight: ${({ theme }) => theme.type.weight.strong};
  text-decoration: underline;
`;
const Title = styled.h3`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.base};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;

type Props = Readonly<{ slot: ImageSlot; name: string }>;

/** "How to make this picture": a link that opens the zone template and what each screen shows. */
export function SlotGuide({ slot, name }: Props) {
  const { t } = useTranslation(SETUP_NS);
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => setOpen(false), []);
  const lines = t(`images.help.${slot}`, { returnObjects: true }) as unknown as Array<string>;
  const src = GUIDE_TEMPLATES[slot];
  return (
    <>
      <Button variant="quiet" onClick={show}>
        {t('images.help.open')}
      </Button>
      {open ? (
        <SlideOver
          label={t('images.help.label', { name })}
          closeLabel={t('images.help.close')}
          onClose={hide}
          width="36rem"
        >
          <Content>
            <Title>{name}</Title>
            <Template
              src={src}
              alt={t(
                slot === 'phoneBanner' ? 'images.help.templateAltTall' : 'images.help.templateAlt',
                {
                  name,
                },
              )}
            />
            <Lines>
              {lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </Lines>
            <Download href={src} download={src.split('/').pop()}>
              {t('images.help.download')}
            </Download>
          </Content>
        </SlideOver>
      ) : null}
    </>
  );
}
