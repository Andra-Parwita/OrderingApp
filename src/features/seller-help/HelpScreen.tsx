import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { styled } from 'styled-components';
import { useMediaQuery } from '../../components/useMediaQuery';
import { brandColour, brandHelp, brandPill } from '../../theme/brandTokens';
import { STEP_IMAGES } from './images';
import { HELP_NS } from './i18n/register';
import { TOPICS, type HelpStep, type HelpTopicText } from './topics';

// Plan 058, D-095: the seller Help page. Public (no sign-in), noindex, in the user's language with
// an EN | ID switch. A tablet shows the topic list beside the steps; a phone shows an accordion.
// Print opens every topic and hides the controls.

const PHONE_QUERY = '(max-width: 51.25rem)';
const PIC_DIR = '/help/';

const Page = styled.div`
  min-height: 100dvh;
  background: ${({ theme }) => theme.c.bg};
  color: ${({ theme }) => theme.c.text};
  font-family: ${({ theme }) => theme.font.ui};
  line-height: ${({ theme }) => theme.type.lineHeight.normal};

  button {
    font: inherit;
    color: inherit;
    cursor: pointer;
  }
  :focus-visible {
    outline: ${({ theme }) => theme.border.focus} solid ${({ theme }) => theme.c.fill};
    outline-offset: ${({ theme }) => theme.border.focus};
    border-radius: ${({ theme }) => theme.radius.md};
  }
`;
const Band = styled.header`
  position: relative;
  height: 9.375rem;
  overflow: hidden;
  background: ${brandColour.beige};
  color: ${brandColour.ink};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${brandPill.light.border};

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: ${brandHelp.fade};
  }
  @media (max-width: 51.25rem) {
    height: 8rem;
  }
  @media print {
    height: auto;
    background: none;
    border: 0;
  }
`;
const Scene = styled.img`
  position: absolute;
  left: 50%;
  top: 50%;
  width: max(100%, 26.25rem);
  aspect-ratio: 3 / 5;
  transform: translate(-50%, -50%);
  opacity: ${brandHelp.sceneOpacity};

  @media print {
    display: none;
  }
`;
const BandIn = styled.div`
  position: relative;
  z-index: 3;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.lg};
  max-width: 73.75rem;
  height: 100%;
  margin: 0 auto;
  padding: 0 ${({ theme }) => theme.spacing.xl};

  @media (max-width: 51.25rem) {
    flex-wrap: wrap;
    align-content: center;
    gap: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    padding: 0 ${({ theme }) => theme.spacing.lg};
  }
`;
const Heading = styled.div`
  flex: 1;
  min-width: 0;

  h1 {
    margin: 0;
    font-size: 1.375rem;
    line-height: ${({ theme }) => theme.type.lineHeight.tight};
    letter-spacing: -0.01em;
  }
  p {
    margin: 0.125rem 0 0;
    font-size: 0.875rem;
  }
  @media (max-width: 51.25rem) {
    flex-basis: 100%;
    order: 3;
    padding-right: 6rem;

    h1 {
      font-size: ${({ theme }) => theme.type.size.lg};
    }
    p {
      display: none;
    }
  }
`;
const Logo = styled.div`
  @media (max-width: 51.25rem) {
    order: 1;
  }
`;
const Tools = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};

  @media (max-width: 51.25rem) {
    order: 2;
    margin-left: auto;
  }
  @media print {
    display: none;
  }
`;
const Switch = styled.div`
  display: inline-flex;
  overflow: hidden;
  border: ${({ theme }) => theme.border.hairline} solid ${brandColour.ink};
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${brandPill.light.bg};
`;
const SwitchButton = styled.button`
  min-height: 2.25rem;
  padding: 0.375rem 0.875rem;
  border: 0;
  background: transparent;
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: ${({ theme }) => theme.type.weight.strong};

  &[aria-pressed='true'] {
    background: ${brandColour.ink};
    color: ${brandColour.beige};
  }
`;
const PrintButton = styled.button`
  min-height: 2.25rem;
  padding: 0.375rem 0.875rem;
  border: ${({ theme }) => theme.border.hairline} solid ${brandColour.ink};
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${brandPill.light.bg};
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
const MascotBox = styled.div`
  position: absolute;
  right: max(12.5rem, calc(50% - 24.375rem));
  bottom: 0;
  z-index: 1;
  width: 11.875rem;

  @media (max-width: 51.25rem) {
    right: ${({ theme }) => theme.spacing.md};
    width: 6rem;
  }
  @media print {
    display: none;
  }
`;
const Main = styled.main`
  box-sizing: border-box;
  max-width: 73.75rem;
  margin: 0 auto;
  padding: 1.25rem ${({ theme }) => theme.spacing.xl} 2.5rem;

  @media (max-width: 51.25rem) {
    padding: 0.875rem ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xxl};
  }
`;
const SearchBox = styled.div`
  position: relative;
  margin-bottom: 0.875rem;

  svg {
    position: absolute;
    left: 0.8125rem;
    top: 0.8125rem;
    width: 1.125rem;
    height: 1.125rem;
    fill: none;
    stroke: ${({ theme }) => theme.c.muted};
    stroke-width: 2;
  }
  @media print {
    display: none;
  }
`;
const SearchInput = styled.input`
  box-sizing: border-box;
  width: 100%;
  min-height: ${({ theme }) => theme.minTapTarget};
  padding: ${({ theme }) => theme.spacing.sm} 0.875rem ${({ theme }) => theme.spacing.sm} 2.5rem;
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
  border-radius: 0.625rem;
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.text};
  font: inherit;
`;
const Layout = styled.div<{ $split: boolean }>`
  display: grid;
  grid-template-columns: ${({ $split }) => ($split ? '21.25rem 1fr' : '1fr')};
  gap: ${({ theme }) => theme.spacing.xl};
  align-items: start;
`;
const List = styled.ol`
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  overflow: hidden;
  list-style: none;
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.c.surf};

  li + li {
    border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  }
  @media print {
    border: 0;
    li {
      break-inside: avoid;
    }
  }
`;
const TopicButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  box-sizing: border-box;
  width: 100%;
  min-height: 3.5rem;
  padding: ${({ theme }) => theme.spacing.md} 0.875rem;
  border: 0;
  background: transparent;
  text-align: left;

  &:hover {
    background: ${({ theme }) => theme.c.surf2};
  }
  &[aria-expanded='true'] {
    background: ${({ theme }) => theme.c.tint};
  }
  @media print {
    pointer-events: none;
    break-after: avoid;
  }
`;
const Num = styled.span`
  flex: none;
  display: grid;
  place-items: center;
  width: 1.75rem;
  height: 1.75rem;
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: 50%;
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: ${({ theme }) => theme.type.weight.strong};

  [aria-expanded='true'] > & {
    border-color: ${({ theme }) => theme.c.fill};
    background: ${({ theme }) => theme.c.fill};
    color: ${({ theme }) => theme.c.on};
  }
`;
const Name = styled.span`
  flex: 1;
  font-weight: ${({ theme }) => theme.type.weight.strong};
  line-height: ${({ theme }) => theme.type.lineHeight.tight};
`;
const Summary = styled.span`
  display: block;
  margin-top: 0.0625rem;
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: ${({ theme }) => theme.type.weight.regular};
`;
const Chevron = styled.svg<{ $open: boolean }>`
  flex: none;
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: ${({ theme }) => theme.c.muted};
  stroke-width: 2;
  transform: rotate(${({ $open }) => ($open ? '90deg' : '0deg')});
  transition: transform ${({ theme }) => theme.motion.fast};

  @media print {
    display: none;
  }
`;
const Inline = styled.div`
  padding: 0.125rem 0.875rem 0.875rem;
  background: ${({ theme }) => theme.c.surf};

  @media print {
    padding-left: 2.5rem;
  }
`;
const Detail = styled.section`
  box-sizing: border-box;
  min-height: 18.75rem;
  padding: 1.375rem ${({ theme }) => theme.spacing.xl};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.c.surf};

  h2 {
    margin: 0 0 ${({ theme }) => theme.spacing.xs};
    font-size: 1.25rem;
    letter-spacing: -0.01em;
  }
`;
const Lead = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.md};
`;
const Steps = styled.ol`
  margin: 0;
  padding: 0;
  list-style: none;

  & > li {
    position: relative;
    padding: ${({ theme }) => theme.spacing.md} 0 ${({ theme }) => theme.spacing.md} 2.5rem;
    border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  }
  & > li:first-child {
    border-top: 0;
  }
  & > li::before {
    content: attr(data-n);
    position: absolute;
    left: 0;
    top: ${({ theme }) => theme.spacing.md};
    display: grid;
    place-items: center;
    width: 1.625rem;
    height: 1.625rem;
    border-radius: 50%;
    background: ${({ theme }) => theme.c.fill};
    color: ${({ theme }) => theme.c.on};
    font-size: ${({ theme }) => theme.type.size.sm};
    font-weight: ${({ theme }) => theme.type.weight.strong};
  }
  & > li.part {
    padding: 0.875rem 0 0.375rem;
    border-top: ${({ theme }) => theme.border.focus} solid ${({ theme }) => theme.c.line};
    color: ${({ theme }) => theme.c.atext};
    font-weight: 700;
  }
  & > li.part::before {
    display: none;
  }
  & > li.part:first-child {
    padding-top: 0;
    border-top: 0;
  }
  p {
    max-width: 62ch;
    margin: 0;
  }
  b {
    padding: 0 0.3em;
    border-radius: ${({ theme }) => theme.radius.sm};
    background: ${({ theme }) => theme.c.surf2};
    font-weight: 700;
  }
  @media (max-width: 51.25rem) {
    & > li {
      padding-left: 2.25rem;
    }
  }
`;
const Picture = styled.img`
  display: block;
  box-sizing: border-box;
  max-width: min(100%, 26.25rem);
  height: auto;
  margin-top: ${({ theme }) => theme.spacing.sm};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: ${({ theme }) => theme.radius.md};
`;
const Note = styled.p`
  margin: ${({ theme }) => theme.spacing.lg} 0 0;
  padding: 0.625rem ${({ theme }) => theme.spacing.md};
  border-left: 0.1875rem solid ${brandColour.bobo};
  border-radius: 0 ${({ theme }) => theme.radius.md} ${({ theme }) => theme.radius.md} 0;
  background: ${({ theme }) => theme.c.surf2};
  font-size: 0.875rem;
`;
const None = styled.p`
  margin: 0;
  padding: 1.125rem;
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.md};
`;
const Foot = styled.p`
  margin: ${({ theme }) => theme.spacing.xl} 0 0;
  color: ${({ theme }) => theme.c.muted};
  font-family: ${({ theme }) => theme.font.mono};
  font-size: 0.75rem;
  text-align: center;

  @media print {
    display: none;
  }
`;

/** `**bold**` marks a button or label as the app shows it. */
function Rich({ text }: Readonly<{ text: string }>) {
  return <>{text.split('**').map((part, i) => (i % 2 === 1 ? <b key={i}>{part}</b> : part))}</>;
}

const plain = (text: string) => text.replaceAll('**', '');
const stepText = (step: HelpStep) => ('part' in step ? step.part : step.text);

function matches(topic: HelpTopicText, query: string): boolean {
  if (query === '') return true;
  const all = [topic.n, topic.s, topic.l, ...topic.steps.map(stepText), topic.note];
  return plain(all.join(' ')).toLowerCase().includes(query);
}

function StepsView({
  topic,
  index,
  alt,
}: Readonly<{ topic: HelpTopicText; index: number; alt: (what: string) => string }>) {
  // A step's number restarts after each part heading (A, B, iPhone, Android).
  const numbers = topic.steps.reduce<Array<number>>((all, step, i) => {
    all.push('part' in step ? 0 : (all[i - 1] ?? 0) + 1);
    return all;
  }, []);
  return (
    <>
      <Lead>{topic.l}</Lead>
      <Steps>
        {topic.steps.map((step, i) => {
          if ('part' in step) {
            return (
              <li key={i} className="part">
                {step.part}
              </li>
            );
          }
          const file = STEP_IMAGES[`${index + 1}.${i + 1}`];
          return (
            <li key={i} data-n={numbers[i]}>
              <p>
                <Rich text={step.text} />
              </p>
              {file !== undefined ? (
                <Picture
                  src={`${PIC_DIR}${file}`}
                  alt={alt(step.pic ?? '')}
                  loading="lazy"
                  decoding="async"
                />
              ) : null}
            </li>
          );
        })}
      </Steps>
      <Note>{topic.note}</Note>
    </>
  );
}

/** `?topic=3` (from 1) opens that topic; anything else opens the first. */
function topicFromAddress(value: string | null): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= TOPICS.length ? n - 1 : 0;
}

export type HelpScreenProps = Readonly<{
  /** The ShaggyBobo logo and the waving mascot come from the app layer (a feature may not import it). */
  logo: ReactNode;
  mascot: ReactNode;
}>;

export function HelpScreen({ logo, mascot }: HelpScreenProps) {
  const { t, i18n } = useTranslation(HELP_NS);
  const lang = i18n.language.startsWith('id') ? 'id' : 'en';
  const phone = useMediaQuery(PHONE_QUERY);
  const [params] = useSearchParams();
  const [open, setOpen] = useState(() => topicFromAddress(params.get('topic')));
  const [query, setQuery] = useState('');
  const [printing, setPrinting] = useState(false);
  const q = query.trim().toLowerCase();

  useEffect(() => {
    // Public but not for search engines (D-095): the Worker also sends X-Robots-Tag for this address.
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.append(meta);
    return () => meta.remove();
  }, []);
  useEffect(() => {
    const before = () => setPrinting(true);
    const after = () => setPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);
  useEffect(() => {
    document.title = `${t('pageTitle')} · ShaggyBobo`;
  }, [t, lang]);

  const shown = useMemo(
    () => TOPICS.map((topic, i) => ({ topic: topic[lang], i })).filter((x) => matches(x.topic, q)),
    [lang, q],
  );
  // The open topic stays one that is shown; a search moves it to the first match.
  const current = shown.some((x) => x.i === open) ? open : (shown[0]?.i ?? -1);
  const accordion = phone || printing;
  const alt = (what: string) => t('picture', { what });
  const toggle = (i: number) => setOpen(accordion && current === i ? -1 : i);
  const detail = shown.find((x) => x.i === current);

  return (
    <Page>
      <Band>
        <Scene src="/brand/nusantara-market.webp" alt="" aria-hidden="true" />
        <BandIn>
          <Logo>{logo}</Logo>
          <Heading>
            <h1>{t('title')}</h1>
            <p>{t('sub')}</p>
          </Heading>
          <Tools>
            <Switch role="group" aria-label={t('language')}>
              {(['en', 'id'] as const).map((code) => (
                <SwitchButton
                  key={code}
                  type="button"
                  aria-pressed={lang === code}
                  onClick={() => void i18n.changeLanguage(code)}
                >
                  {code.toUpperCase()}
                </SwitchButton>
              ))}
            </Switch>
            <PrintButton type="button" onClick={() => window.print()}>
              {t('print')}
            </PrintButton>
          </Tools>
        </BandIn>
        <MascotBox>{mascot}</MascotBox>
      </Band>
      <Main>
        <SearchBox>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <SearchInput
            type="search"
            autoComplete="off"
            aria-label={t('search')}
            placeholder={t('search')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </SearchBox>
        <Layout $split={!accordion}>
          {shown.length === 0 ? (
            <None role="status">{t('none')}</None>
          ) : (
            <List aria-label={t('topics')}>
              {shown.map(({ topic, i }) => {
                const on = printing || i === current;
                return (
                  <li key={i}>
                    <TopicButton
                      type="button"
                      aria-expanded={on}
                      aria-controls={`help-topic-${i}`}
                      onClick={() => toggle(i)}
                    >
                      <Num>{i + 1}</Num>
                      <Name>
                        {topic.n}
                        <Summary>{topic.s}</Summary>
                      </Name>
                      <Chevron viewBox="0 0 24 24" aria-hidden="true" $open={on}>
                        <path d="m9 6 6 6-6 6" />
                      </Chevron>
                    </TopicButton>
                    {accordion && on ? (
                      <Inline id={`help-topic-${i}`}>
                        <StepsView topic={topic} index={i} alt={alt} />
                      </Inline>
                    ) : null}
                  </li>
                );
              })}
            </List>
          )}
          {!accordion && detail ? (
            <Detail id={`help-topic-${detail.i}`} aria-live="polite">
              <h2>
                {detail.i + 1}. {detail.topic.n}
              </h2>
              <StepsView topic={detail.topic} index={detail.i} alt={alt} />
            </Detail>
          ) : null}
        </Layout>
        <Foot>{t('foot')}</Foot>
      </Main>
    </Page>
  );
}
