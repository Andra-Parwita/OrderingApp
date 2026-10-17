import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { styled } from 'styled-components';
import { RELEASE_VERSION } from '../../../shared/release';
import { useMediaQuery } from '../../components/useMediaQuery';
import { Icon, PageHeader } from '../../ui';
import { AboutHero } from './AboutHero';
import { heroArt } from './aboutTokens';
import { ABOUT_NS } from './i18n/register';
import { ReleasesPanel } from './ReleasesPanel';

// Plan 075: About ShaggyBobo. The hero and the version row stay pinned; only the about card scrolls.

const LOGO_SRC = '/brand/logo-icon.webp';

const Page = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  width: 100%;
  max-width: 45rem;
  margin: 0 auto;
  box-sizing: border-box;
  padding-bottom: ${({ theme }) => theme.spacing.md};
`;
const Pin = styled.div<{ $wide: boolean }>`
  position: relative;
  z-index: 3; /* the hero's drone paints over the logo row and the page below */
  flex: none;
  padding: ${({ $wide, theme }) => ($wide ? `${theme.spacing.lg} ${theme.spacing.xl} 0` : '0')};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: ${({ theme }) => theme.c.bg};
`;
const IdRow = styled.div<{ $wide: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ $wide, theme }) =>
    `${theme.spacing.lg} ${$wide ? '0' : theme.spacing.lg} ${theme.spacing.md}`};
`;
const Versions = styled.div`
  display: flex;
  min-width: 0;
  flex-direction: column;
`;
const Release = styled.span`
  font-size: ${({ theme }) => theme.type.size.md};
  font-weight: 700;
`;
const WhatsNew = styled.button`
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  min-height: ${({ theme }) => theme.minTapTarget};
  margin-left: auto;
  padding: 0 ${({ theme }) => theme.spacing.sm} 0 ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.atext};
  font: inherit;
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;

  &:focus-visible {
    outline: ${({ theme }) => theme.border.focus} solid ${({ theme }) => theme.c.atext};
    outline-offset: ${({ theme }) => theme.border.focus};
  }
  svg {
    width: 1rem;
    height: 1rem;
  }
`;
const Body = styled.section<{ $wide: boolean }>`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  padding: ${({ $wide, theme }) =>
    `${theme.spacing.lg} ${$wide ? theme.spacing.xl : theme.spacing.lg} 0`};
`;
const Card = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.lg};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: ${({ theme }) => theme.size.radiusSheet}px;
  background: ${({ theme }) => theme.c.surf};
`;
const Scroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.c.text};
  font-size: ${({ theme }) => theme.type.size.sm};
  line-height: 1.55;
  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) => heroArt.scroll[theme.mode]} transparent;

  &::-webkit-scrollbar {
    width: 0.375rem;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    border-radius: ${({ theme }) => theme.radius.pill};
    background: ${({ theme }) => heroArt.scroll[theme.mode]};
  }
  &::-webkit-scrollbar-thumb:hover {
    background: ${({ theme }) => heroArt.scrollHover[theme.mode]};
  }
  &:focus-visible {
    outline: ${({ theme }) => theme.border.focus} solid ${({ theme }) => theme.c.atext};
    outline-offset: ${({ theme }) => theme.border.focus};
  }
  h2 {
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    margin: 0 0 ${({ theme }) => theme.spacing.sm};
    font-size: 1.0625rem;
    letter-spacing: -0.01em;
  }
  h2 img {
    flex: none;
    width: auto;
    height: 1.6em;
  }
  h3 {
    margin: ${({ theme }) => theme.spacing.md} 0 ${({ theme }) => theme.spacing.sm};
    font-size: 0.875rem;
  }
  p {
    margin: 0 0 ${({ theme }) => theme.spacing.sm};
    max-width: 62ch;
  }
  ul {
    margin: 0;
    padding: 0 0 0 1.25rem;
    max-width: 62ch;
  }
  li {
    margin: ${({ theme }) => theme.spacing.xs} 0;
  }
  p.closing {
    margin-top: ${({ theme }) => theme.spacing.md};
    color: ${({ theme }) => theme.c.muted};
  }
`;

/** **bold** marks in a string become <strong>. */
function rich(text: string): ReactNode {
  return text
    .split('**')
    .map((part, index) => (index % 2 === 1 ? <strong key={part}>{part}</strong> : part));
}

export type AboutScreenProps = Readonly<{
  /** The ShaggyBobo logo pill (from src/app, passed in so this feature does not import the app). */
  logo: ReactNode;
  /** The media query for a tablet or wider (DESKTOP_QUERY, passed in: features may not import src/app). */
  wideQuery: string;
}>;

export function AboutScreen({ logo, wideQuery }: AboutScreenProps) {
  const { t } = useTranslation(ABOUT_NS);
  const navigate = useNavigate();
  const wide = useMediaQuery(wideQuery);
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const back = useCallback(() => void navigate('/seller/more'), [navigate]);
  const safe = t('safe', { returnObjects: true }) as ReadonlyArray<string>;

  return (
    <Page>
      <PageHeader
        title={t('title')}
        backLabel={wide ? undefined : t('back')}
        onBack={wide ? undefined : back}
      />
      <Pin $wide={wide}>
        <AboutHero wideQuery={wideQuery} />
        <IdRow $wide={wide}>
          {logo}
          <Versions>
            <Release>{t('release', { version: RELEASE_VERSION })}</Release>
          </Versions>
          <WhatsNew type="button" ref={opener} aria-haspopup="dialog" onClick={() => setOpen(true)}>
            {t('whatsNew')}
            <Icon name="forward" />
          </WhatsNew>
        </IdRow>
      </Pin>
      <Body $wide={wide} aria-label={t('aboutLabel')}>
        <Card>
          <Scroll tabIndex={0}>
            <h2>
              {t('hello')} <img src={LOGO_SRC} alt={t('logoAlt')} />
            </h2>
            <p>{t('intro')}</p>
            <h3>{t('safeTitle')}</h3>
            <ul>
              {safe.map((line) => (
                <li key={line}>{rich(line)}</li>
              ))}
            </ul>
            <p className="closing">{t('closing')}</p>
          </Scroll>
        </Card>
      </Body>
      {open ? (
        <ReleasesPanel wide={wide} onClose={close} returnFocus={() => opener.current} />
      ) : null}
    </Page>
  );
}
