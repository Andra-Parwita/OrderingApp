import { useCallback, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { css, styled } from 'styled-components';
import type { Kitchen, Language } from '../../../shared/domain';
import { formatCookingDate, formatCutoff, formatWindow } from '../../../shared/dates';
import { bannerAlt, phoneBannerSrc } from '../../../shared/kitchenImages';
import type { MenuResponse } from '../../../shared/menuContract';
import { pickText } from '../../../shared/text';
import { ImageSlot } from '../../ui';
import { FullPictureViewer } from './FullPictureViewer';
import { CUSTOMER_NS } from './i18n/register';
import { MenuIcon } from './menuIcons';
import { CardBody, CardHead, MainButton, OutlineButton, StatusCard, TextLink } from './menuParts';

// Menu home and its "not taking orders" states (spec §4.1): the kitchen's banner whole, the menu
// picture behind a see-through info sheet, and the one main button. Presentational: the routed
// screen and the fixtures page both feed it a MenuResponse; nothing here fetches.

const Screen = styled.main`
  min-height: calc(100dvh - var(--customer-tabbar-height, 0rem));
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.c.bg};
  color: ${({ theme }) => theme.c.text};
`;
const BannerBox = styled.div`
  position: relative;
`;
const BannerTop = styled.div<{ $background?: string }>`
  padding-top: var(--sat);
  background: ${({ theme, $background }) => $background ?? theme.c.surf2};
`;
const Hero = styled.div`
  position: relative;
  flex: 1;
  min-height: 14rem;
  padding-top: 11rem; /* the picture stays visible above the sheet */
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  overflow: hidden;
  background: ${({ theme }) => theme.c.surf2};
`;
const HeroImage = styled.img`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
`;
const PictureTap = styled.button`
  position: absolute;
  inset: 0;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
`;
const FullPictureButton = styled.button`
  position: relative;
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-height: ${({ theme }) => theme.size.tap}px;
  margin: 0 0 ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.md};
  padding: 0 ${({ theme }) => theme.spacing.lg};
  border: 0;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: color-mix(in srgb, ${({ theme }) => theme.c.text} 78%, transparent);
  color: ${({ theme }) => theme.c.bg};
  font: inherit;
  font-weight: 600;
  cursor: pointer;
`;

// The sheet: surface at about 88% over a strong blur; solid where blur is not supported.
const sheetGlass = css`
  background: ${({ theme }) => theme.c.surf};
  @supports (backdrop-filter: blur(0)) or (-webkit-backdrop-filter: blur(0)) {
    background: color-mix(in srgb, ${({ theme }) => theme.c.surf} 88%, transparent);
    -webkit-backdrop-filter: blur(1.5rem) saturate(1.3);
    backdrop-filter: blur(1.5rem) saturate(1.3);
  }
`;
const Sheet = styled.section<{ $glass: boolean }>`
  position: relative;
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.lg}
    ${({ theme }) => theme.spacing.lg};
  border-radius: ${({ theme }) => theme.size.radiusSheet}px
    ${({ theme }) => theme.size.radiusSheet}px 0 0;
  ${({ $glass, theme }) =>
    $glass
      ? sheetGlass
      : css`
          background: ${theme.c.kbg};
        `}
`;
const PlainSheet = styled(Sheet)`
  flex: 1;
  border-radius: 0;
`;
const Name = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.xl};
  line-height: ${({ theme }) => theme.type.lineHeight.tight};
  font-weight: 700;
`;
const Tagline = styled.p`
  margin: ${({ theme }) => theme.spacing.xs} 0 ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.md};
`;
const rowStyle = css`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  width: 100%;
  min-height: ${({ theme }) => theme.size.tap + 4}px;
  padding: ${({ theme }) => theme.spacing.xs} 0;
  border: 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: none;
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  text-align: left;
  svg:first-child {
    color: ${({ theme }) => theme.c.atext};
  }
  b {
    font-weight: 700;
  }
`;
const Row = styled.div`
  ${rowStyle}
`;
const RowButton = styled.button`
  ${rowStyle}
  cursor: pointer;
`;
const RowText = styled.span`
  flex: 1;
  min-width: 0;
`;
const Chevron = styled.span`
  display: inline-flex;
  color: ${({ theme }) => theme.c.muted};
  transition: transform 120ms;
  &[data-open='true'] {
    transform: rotate(90deg);
  }
`;
const Places = styled.ul`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.sm} 0 ${({ theme }) => theme.spacing.sm} 2rem;
  list-style: none;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  font-size: ${({ theme }) => theme.type.size.md};

  small {
    display: block;
    color: ${({ theme }) => theme.c.muted};
    font-size: ${({ theme }) => theme.type.size.sm};
  }
  li {
    padding: ${({ theme }) => theme.spacing.xs} 0;
  }
`;
const Action = styled.div`
  padding-top: ${({ theme }) => theme.spacing.lg};
`;
const Heading = styled.div`
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.lg}
    ${({ theme }) => theme.spacing.md};
`;
const Sub = styled.p`
  margin: ${({ theme }) => theme.spacing.xs} 0 0;
  color: ${({ theme }) => theme.c.muted};
`;
const Spacer = styled.div`
  height: ${({ theme }) => theme.spacing.md};
`;
const Centered = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.lg};
  text-align: center;

  h2 {
    margin: 0;
    font-size: ${({ theme }) => theme.type.size.xl};
    line-height: ${({ theme }) => theme.type.lineHeight.tight};
  }
  p {
    margin: 0;
    color: ${({ theme }) => theme.c.muted};
  }
`;
const BigIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 4.5rem;
  height: 4.5rem;
  border-radius: 50%;
  background: ${({ theme }) => theme.c.surf2};
  color: ${({ theme }) => theme.c.atext};
`;

const bold = { b: <b /> };

function Banner({ kitchen, lang }: Readonly<{ kitchen: Kitchen; lang: Language }>) {
  const { t } = useTranslation(CUSTOMER_NS);
  return (
    <BannerBox>
      <BannerTop $background={kitchen.images?.bannerBackground}>
        <ImageSlot
          aspectRatio="3 / 1"
          background={kitchen.images?.bannerBackground}
          src={phoneBannerSrc(kitchen.images) ?? kitchen.bannerImageUrl}
          alt={bannerAlt(kitchen, lang)}
          placeholder={t('menu.bannerImage')}
        />
      </BannerTop>
    </BannerBox>
  );
}

function cookOf(data: Pick<MenuResponse, 'seller'>, fallback: string): string {
  return data.seller.name || fallback;
}

type HomeProps = Readonly<{
  data: MenuResponse;
  lang: Language;
  /** Not wired in the seller's preview: the sheet's actions are left off. */
  onSeeDishes?: () => void;
  onHowItWorks?: () => void;
  onMessageSeller: () => void;
}>;

export function MenuHomeView({
  data,
  lang,
  onSeeDishes,
  onHowItWorks,
  onMessageSeller,
}: HomeProps) {
  const { t } = useTranslation(CUSTOMER_NS);
  const [viewing, setViewing] = useState(false);
  const [placesOpen, setPlacesOpen] = useState(false);
  const { kitchen, week, ordering, pictureUrl } = data;
  const cook = cookOf(data, t('states.theSeller'));
  const date = formatCookingDate(week.cookingDate, lang);
  const cutoff = formatCutoff(week.cutoffAt, lang);
  const places = week.pickupPoints.length;
  const open = ordering.open;
  const closeViewer = useCallback(() => setViewing(false), []);
  const seeDishesFromViewer = useCallback(() => {
    setViewing(false);
    onSeeDishes?.();
  }, [onSeeDishes]);
  const tagline = pickText(kitchen.tagline, lang);
  const withCook = cook !== kitchen.name && data.seller.name !== '';

  const viewer =
    viewing && pictureUrl ? (
      <FullPictureViewer
        src={pictureUrl}
        title={t('home.menuFor', { date })}
        onClose={closeViewer}
        onSeeDishes={onSeeDishes && open ? seeDishesFromViewer : undefined}
      />
    ) : null;

  if (!open) {
    const paused = ordering.reason !== 'cutoff_passed';
    return (
      <Screen>
        {pictureUrl ? (
          <BannerBox>
            <Hero style={{ flex: 'none', minHeight: '16rem', paddingTop: 'var(--sat)' }}>
              <HeroImage src={pictureUrl} alt={t('home.menuFor', { date })} />
            </Hero>
          </BannerBox>
        ) : (
          <Banner kitchen={kitchen} lang={lang} />
        )}
        <Heading>
          <Name>{kitchen.name}</Name>
          <Sub>{t('home.menuFor', { date })}</Sub>
        </Heading>
        <StatusCard role="status">
          <CardHead $tone="warn">
            <MenuIcon name={paused ? 'pause' : 'clock'} size="1.5rem" />
            <h2>{paused ? t('states.pausedTitle') : t('states.closedTitle', { date })}</h2>
          </CardHead>
          <CardBody>
            {paused
              ? t('states.pausedBody', { cook })
              : t('states.closedBody', { dateTime: cutoff, cook })}
          </CardBody>
          <MainButton type="button" onClick={onMessageSeller}>
            <MenuIcon name="chat" />
            {t('states.messageSeller')}
          </MainButton>
        </StatusCard>
        <Spacer />
        {onSeeDishes ? (
          <TextLink type="button" onClick={onSeeDishes}>
            {t('states.seeAnyway')}
          </TextLink>
        ) : null}
      </Screen>
    );
  }

  const sheetBody = (
    <>
      <Name>{kitchen.name}</Name>
      <Tagline>{withCook ? t('home.byCook', { tagline, cook }) : tagline}</Tagline>
      <Row>
        <MenuIcon name="calendar" />
        <RowText>
          <Trans t={t} i18nKey="home.cooking" values={{ date }} components={bold} />
        </RowText>
      </Row>
      <Row>
        <MenuIcon name="clock" />
        <RowText>
          <Trans t={t} i18nKey="home.orderBy" values={{ dateTime: cutoff }} components={bold} />
        </RowText>
      </Row>
      {places > 0 ? (
        <>
          <RowButton
            type="button"
            aria-expanded={placesOpen}
            onClick={() => setPlacesOpen((o) => !o)}
          >
            <MenuIcon name="pin" />
            <RowText>
              <Trans
                t={t}
                i18nKey={week.delivery.available ? 'home.pickupDelivery' : 'home.pickup'}
                count={places}
                components={bold}
              />
            </RowText>
            <Chevron data-open={placesOpen} aria-hidden="true">
              <MenuIcon name="chevron" />
            </Chevron>
          </RowButton>
          {placesOpen ? (
            <Places>
              {week.pickupPoints.map((point) => (
                <li key={point.id}>
                  {point.place} · {formatWindow(point.window.start, point.window.end, lang)}
                  <small>{pickText(point.directions, lang)}</small>
                </li>
              ))}
              {week.delivery.available ? (
                <li>
                  <small>
                    {t('home.deliveryNote', { note: pickText(week.delivery.note, lang) })}
                  </small>
                </li>
              ) : null}
            </Places>
          ) : null}
        </>
      ) : week.delivery.available ? (
        <Row>
          <MenuIcon name="pin" />
          <RowText>{t('home.deliveryOnly')}</RowText>
        </Row>
      ) : null}
      {onHowItWorks ? (
        <RowButton type="button" onClick={onHowItWorks}>
          <MenuIcon name="help" />
          <RowText>{t('home.howItWorks')}</RowText>
          <Chevron aria-hidden="true">
            <MenuIcon name="chevron" />
          </Chevron>
        </RowButton>
      ) : null}
      {onSeeDishes ? (
        <Action>
          <MainButton type="button" onClick={onSeeDishes}>
            {t('home.seeDishes')}
            <MenuIcon name="chevron" />
          </MainButton>
        </Action>
      ) : null}
    </>
  );

  if (!pictureUrl) {
    return (
      <Screen>
        <Banner kitchen={kitchen} lang={lang} />
        <PlainSheet $glass={false}>{sheetBody}</PlainSheet>
      </Screen>
    );
  }
  return (
    <Screen>
      <Banner kitchen={kitchen} lang={lang} />
      <Hero>
        <HeroImage src={pictureUrl} alt={t('home.menuFor', { date })} />
        <PictureTap
          type="button"
          aria-label={t('home.seeFullPicture')}
          onClick={() => setViewing(true)}
        />
        <FullPictureButton type="button" onClick={() => setViewing(true)}>
          <MenuIcon name="expand" size="1.125rem" />
          {t('home.seeFullPicture')}
        </FullPictureButton>
        <Sheet $glass>{sheetBody}</Sheet>
      </Hero>
      {viewer}
    </Screen>
  );
}

/** The kitchen has no published menu for this link: the banner and a quiet note. */
export function NotPublishedView({
  kitchen,
  cook,
  lang,
  onMessageSeller,
}: Readonly<{
  /** Absent when the server only said "not published" and sent no kitchen. */
  kitchen?: Kitchen;
  cook?: string;
  lang: Language;
  onMessageSeller: () => void;
}>) {
  const { t } = useTranslation(CUSTOMER_NS);
  const who = cook || t('states.theSeller');
  return (
    <Screen>
      {kitchen ? <Banner kitchen={kitchen} lang={lang} /> : null}
      {kitchen ? (
        <Heading>
          <Name>{kitchen.name}</Name>
          <Sub>{pickText(kitchen.tagline, lang)}</Sub>
        </Heading>
      ) : null}
      <Centered role="status">
        <BigIcon>
          <MenuIcon name="calendar" size="2rem" />
        </BigIcon>
        <h2>{t('states.notOutTitle')}</h2>
        <p>{t('states.notOutBody', { cook: who })}</p>
        <OutlineButton type="button" onClick={onMessageSeller}>
          <MenuIcon name="chat" />
          {t('states.messageSeller')}
        </OutlineButton>
      </Centered>
    </Screen>
  );
}
