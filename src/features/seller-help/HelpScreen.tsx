import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { useMediaQuery } from '../../components/useMediaQuery';
import { HELP_NS } from './i18n/register';
import { CUSTOMER_TOPICS } from './customerTopics';
import { TOPICS, type HelpTopic } from './topics';
import { StepsView, matches } from './HelpSteps';
import {
  Chevron,
  Detail,
  Foot,
  Inline,
  Layout,
  List,
  Main,
  Name,
  None,
  Num,
  OtherTab,
  SearchBox,
  SearchInput,
  Summary,
  TabButton,
  TabList,
  TopicButton,
} from './helpListStyles';
import {
  Band,
  BandIn,
  EmbeddedHead,
  EmbeddedPrint,
  Heading,
  Logo,
  MascotBox,
  Page,
  PrintButton,
  Scene,
  Switch,
  SwitchButton,
  Tools,
} from './helpStyles';

// Plan 058, D-095: the seller Help page. Public (no sign-in), noindex, in the user's language with
// an EN | ID switch. A tablet shows the topic list beside the steps; a phone shows an accordion.
// Print opens every topic and hides the controls.

const PHONE_QUERY = '(max-width: 51.25rem)';

type Tab = 'seller' | 'customer';
const TABS: ReadonlyArray<Tab> = ['seller', 'customer'];
const topicsOf = (tab: Tab): ReadonlyArray<HelpTopic> =>
  tab === 'customer' ? CUSTOMER_TOPICS : TOPICS;

/** `?topic=4` (from 1) opens that topic of the tab; anything else opens the first. */
function topicFromAddress(value: string | null, tab: Tab): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= topicsOf(tab).length ? n - 1 : 0;
}

export type HelpScreenProps = Readonly<{
  /** The ShaggyBobo logo and the waving mascot come from the app layer (a feature may not import it). */
  logo?: ReactNode;
  mascot?: ReactNode;
  /** Plan 079: shown inside the seller app (no brand band, footer or language switch); the public page leaves it off. */
  embedded?: boolean;
}>;

export function HelpScreen({ logo, mascot, embedded = false }: HelpScreenProps) {
  const { t, i18n } = useTranslation(HELP_NS);
  const lang = i18n.language.startsWith('id') ? 'id' : 'en';
  const phone = useMediaQuery(PHONE_QUERY);
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() =>
    params.get('tab') === 'customer' ? 'customer' : 'seller',
  );
  const [open, setOpen] = useState(() => topicFromAddress(params.get('topic'), tab));
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ seller: null, customer: null });
  const [query, setQuery] = useState('');
  const [printing, setPrinting] = useState(false);
  const q = query.trim().toLowerCase();

  useEffect(() => {
    // Public but not for search engines (D-095): the Worker also sends X-Robots-Tag for this address.
    if (embedded) return;
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.append(meta);
    return () => meta.remove();
  }, [embedded]);
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
    () =>
      topicsOf(tab)
        .map((topic, i) => ({ topic: topic[lang], i }))
        .filter((x) => matches(x.topic, q)),
    [lang, q, tab],
  );
  const other: Tab = tab === 'seller' ? 'customer' : 'seller';
  const otherCount = useMemo(
    () => (q === '' ? 0 : topicsOf(other).filter((x) => matches(x[lang], q)).length),
    [lang, q, other],
  );
  const pick = (next: Tab, focus = false) => {
    setTab(next);
    setOpen(0);
    if (focus) tabRefs.current[next]?.focus();
  };
  const onTabKey = (event: KeyboardEvent) => {
    const at = TABS.indexOf(tab);
    const to =
      event.key === 'ArrowRight' || event.key === 'ArrowLeft'
        ? TABS[(at + (event.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]
        : event.key === 'Home'
          ? TABS[0]
          : event.key === 'End'
            ? TABS[TABS.length - 1]
            : undefined;
    if (to === undefined) return;
    event.preventDefault();
    pick(to, true);
  };
  // The open topic stays one that is shown; a search moves it to the first match.
  const current = shown.some((x) => x.i === open) ? open : (shown[0]?.i ?? -1);
  const accordion = phone || printing;
  const alt = (what: string) => t('picture', { what });
  const toggle = (i: number) => setOpen(accordion && current === i ? -1 : i);
  const detail = shown.find((x) => x.i === current);
  const detailRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (detailRef.current) detailRef.current.scrollTop = 0;
  }, [current, tab]);

  return (
    <Page $split={!accordion} $embedded={embedded}>
      {embedded ? (
        <EmbeddedHead>
          <h1>{t('title')}</h1>
          <EmbeddedPrint type="button" onClick={() => window.print()}>
            {t('print')}
          </EmbeddedPrint>
        </EmbeddedHead>
      ) : (
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
      )}
      <Main $split={!accordion}>
        <TabList role="tablist" aria-label={t('tabs')} onKeyDown={onTabKey}>
          {TABS.map((id) => (
            <TabButton
              key={id}
              ref={(el) => {
                tabRefs.current[id] = el;
              }}
              type="button"
              role="tab"
              id={`help-tab-${id}`}
              aria-selected={tab === id}
              aria-controls="help-panel"
              tabIndex={tab === id ? 0 : -1}
              onClick={() => pick(id)}
            >
              {t(id === 'seller' ? 'tabSeller' : 'tabCustomer')}
            </TabButton>
          ))}
        </TabList>
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
        <Layout
          $split={!accordion}
          role="tabpanel"
          id="help-panel"
          aria-labelledby={`help-tab-${tab}`}
        >
          {shown.length === 0 ? (
            <div role="status">
              <None>{t('none')}</None>
              {otherCount > 0 ? (
                <OtherTab type="button" onClick={() => pick(other)}>
                  {t('foundIn', {
                    tab: t(other === 'seller' ? 'tabSeller' : 'tabCustomer'),
                    count: otherCount,
                  })}
                </OtherTab>
              ) : null}
            </div>
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
                        <StepsView topic={topic} index={i} alt={alt} pictures={tab === 'seller'} />
                      </Inline>
                    ) : null}
                  </li>
                );
              })}
            </List>
          )}
          {!accordion && detail ? (
            <Detail ref={detailRef} id={`help-topic-${detail.i}`} aria-live="polite">
              <h2>
                {detail.i + 1}. {detail.topic.n}
              </h2>
              <StepsView
                topic={detail.topic}
                index={detail.i}
                alt={alt}
                pictures={tab === 'seller'}
              />
            </Detail>
          ) : null}
        </Layout>
        {embedded ? null : <Foot>{t('foot')}</Foot>}
      </Main>
    </Page>
  );
}
