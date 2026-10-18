import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import { formatOrderCode } from '../../../../shared/orderCode';
import { normaliseAuMobile } from '../../../../shared/phone';
import { currentSellerSlug } from '../../../api/device/sellerContext';
import { useMediaQuery } from '../../../components/useMediaQuery';
import { Button, SlideOver, TextField } from '../../../ui';
import { SELLER_NS } from '../i18n/register';
import { selectCurrent, selectLinkPrompt, selectOrders } from '../sellerOrdersSelectors';
import { linkPromptClosed } from '../sellerOrdersSlice';
import {
  addressText,
  backupStatus,
  createForCode,
  linkCode,
  loadBook,
  similarCustomers,
  useAddressBook,
} from './addressBook';
import { changeSummary, downloadBackup } from './backupFile';
import { lastDigits, shortDay } from './customerFormat';
import { isPromptMuted, mutePrompt } from './promptMute';

// Plan 071 (D-099): the two prompts about the seller's device address book, mounted once in the
// seller shell: "Link to a saved customer?" when she confirms an order from an unknown phone, and
// "Back up your customer details?" when a menu has finished and the book has new or changed data.

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding: 0 ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.xl};
  p {
    margin: 0;
  }
  .muted {
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.875rem;
  }
`;
const Matches = styled.ul`
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
`;
const Match = styled.li`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  div {
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow-wrap: anywhere;
  }
`;
const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding-top: ${({ theme }) => theme.spacing.md};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  h3,
  p {
    margin: 0;
  }
  h3 {
    font-size: 1rem;
  }
`;

// Same width as the tablet breakpoint elsewhere in the seller app; below it the device is a "phone".
const TABLET_QUERY = '(min-width: 600px)';

// Plan 106 (option A): one window after Confirm, with "Same person on a new phone" and "Someone new".
function LinkSheet({ code }: Readonly<{ code: string }>) {
  const { t, i18n } = useTranslation(SELLER_NS);
  const dispatch = useDispatch();
  const slug = currentSellerSlug();
  const order = useSelector(selectOrders).find((candidate) => candidate.code === code);
  const customerCode = order?.customerCode;
  const device = t(
    useMediaQuery(TABLET_QUERY) ? 'customers.device.tablet' : 'customers.device.phone',
  );
  const [name, setName] = useState(order?.firstName ?? '');
  const [number, setNumber] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [noName, setNoName] = useState(false);
  const close = useCallback(() => dispatch(linkPromptClosed()), [dispatch]);
  const muted = isPromptMuted(code);
  useEffect(() => {
    if (!order || customerCode === undefined || muted) close();
  }, [order, customerCode, muted, close]);
  if (!order || customerCode === undefined || muted) return null;
  const date = order.createdAt.slice(0, 10);
  const matches = similarCustomers(slug, order.firstName);
  const wanted = order.firstName.trim().toLowerCase();
  const sameName = matches.filter((c) => c.firstName.trim().toLowerCase() === wanted).length;
  const confirmed = t('customers.link.confirmed', { code: formatOrderCode(order.code) });
  const save = () => {
    const typed = number.trim();
    if (name.trim() === '') {
      setNoName(true);
      return;
    }
    const phone = typed === '' ? undefined : normaliseAuMobile(typed);
    if (phone === null) {
      setInvalid(true);
      return;
    }
    createForCode(slug, name, customerCode, date, new Date(), phone);
    close();
  };
  return (
    <SlideOver label={confirmed} closeLabel={t('customers.link.close')} onClose={close}>
      <Body>
        <h2>{confirmed}</h2>
        <p>{t('customers.link.ask', { name: order.firstName, device })}</p>
        <Section aria-labelledby="link-same">
          {matches.length === 0 ? (
            <p>
              <b>{t('customers.link.none', { name: order.firstName })}</b>
            </p>
          ) : (
            <>
              <h3 id="link-same">
                {sameName > 0
                  ? t('customers.link.found', { count: sameName, name: order.firstName })
                  : t('customers.link.foundSimilar')}
              </h3>
              <Matches>
                {matches.map((customer) => (
                  <Match key={customer.id}>
                    <div>
                      <b>
                        {[
                          customer.firstName,
                          lastDigits(customer.phone),
                          customer.lastOrderDate
                            ? t('customers.link.last', {
                                date: shortDay(customer.lastOrderDate, i18n.language),
                              })
                            : '',
                        ]
                          .filter((part) => part !== '')
                          .join(' · ')}
                      </b>
                      {addressText(customer.address) ? (
                        <span className="muted">{addressText(customer.address)}</span>
                      ) : null}
                    </div>
                    <Button
                      onClick={() => {
                        linkCode(slug, customer.id, customerCode, date);
                        close();
                      }}
                    >
                      {t('customers.link.link')}
                    </Button>
                  </Match>
                ))}
              </Matches>
              <p className="muted">{t('customers.link.hint')}</p>
            </>
          )}
        </Section>
        <Section aria-labelledby="link-new">
          <h3 id="link-new">{t('customers.link.newH')}</h3>
          <TextField
            label={t('customers.link.name')}
            value={name}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setName(event.target.value);
              setNoName(false);
            }}
            autoComplete="off"
            {...(noName ? { error: t('customers.list.nameRequired') } : {})}
          />
          <TextField
            label={t('customers.link.number')}
            value={number}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setNumber(event.target.value);
              setInvalid(false);
            }}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="0412 345 678"
            {...(invalid ? { error: t('contact.invalid') } : {})}
          />
          <Row>
            <Button onClick={save}>{t('customers.link.save')}</Button>
          </Row>
        </Section>
        <Row>
          <Button variant="secondary" onClick={close}>
            {t('customers.link.skipNow')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              mutePrompt(code);
              close();
            }}
          >
            {t('customers.link.skipOrder')}
          </Button>
        </Row>
      </Body>
    </SlideOver>
  );
}

function BackupReminder() {
  const { t } = useTranslation(SELLER_NS);
  const slug = currentSellerSlug();
  const current = useSelector(selectCurrent);
  useAddressBook(slug);
  // "Later" lasts until the app is opened again (this page load).
  const [later, setLater] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    void loadBook(slug).then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, [slug]);
  if (!ready || later || current.status !== 'ready') return null;
  const { menu, dishes } = current.view;
  // A menu deleted without ever being published is "no menu yet", not a finished one.
  const finished = menu.state === 'finished' && (dishes.length > 0 || Boolean(menu.publishedAt));
  const { added, changed } = backupStatus(slug);
  if (!finished || added + changed === 0) return null;
  const parts = changeSummary(slug, t);
  return (
    <SlideOver
      label={t('customers.reminder.title')}
      closeLabel={t('customers.reminder.close')}
      onClose={() => setLater(true)}
    >
      <Body>
        <h2>{t('customers.reminder.title')}</h2>
        <p>{t('customers.reminder.body', { parts: t('customers.pending', { parts }) })}</p>
        <p className="muted">{t('customers.private')}</p>
        <Row>
          <Button onClick={() => downloadBackup(slug)}>{t('customers.reminder.download')}</Button>
          <Button variant="secondary" onClick={() => setLater(true)}>
            {t('customers.reminder.later')}
          </Button>
        </Row>
        <p className="muted">{t('customers.reminder.laterHelp')}</p>
      </Body>
    </SlideOver>
  );
}

/** Mounted once inside the seller shell (inside the Redux provider). */
export function CustomerDetailsHost() {
  const prompt = useSelector(selectLinkPrompt);
  useEffect(() => {
    void loadBook(currentSellerSlug());
  }, []);
  return (
    <>
      {prompt ? <LinkSheet key={prompt.code} code={prompt.code} /> : null}
      <BackupReminder />
    </>
  );
}
