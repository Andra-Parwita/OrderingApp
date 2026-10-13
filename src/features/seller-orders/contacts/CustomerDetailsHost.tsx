import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import { formatPhone } from '../../../../shared/phone';
import { currentSellerSlug } from '../../../api/device/sellerContext';
import { Button, SlideOver } from '../../../ui';
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

function LinkSheet({ code }: Readonly<{ code: string }>) {
  const { t } = useTranslation(SELLER_NS);
  const dispatch = useDispatch();
  const slug = currentSellerSlug();
  const order = useSelector(selectOrders).find((candidate) => candidate.code === code);
  const customerCode = order?.customerCode;
  const close = useCallback(() => dispatch(linkPromptClosed()), [dispatch]);
  useEffect(() => {
    if (!order || customerCode === undefined) close();
  }, [order, customerCode, close]);
  if (!order || customerCode === undefined) return null;
  const date = order.createdAt.slice(0, 10);
  const matches = similarCustomers(slug, order.firstName);
  return (
    <SlideOver
      label={t('customers.link.title')}
      closeLabel={t('customers.link.close')}
      onClose={close}
    >
      <Body>
        <h2>{t('customers.link.title')}</h2>
        <p>{t('customers.link.intro', { name: order.firstName })}</p>
        {matches.length === 0 ? <p className="muted">{t('customers.link.none')}</p> : null}
        <Matches>
          {matches.map((customer) => (
            <Match key={customer.id}>
              <div>
                <b>{customer.firstName}</b>
                <span className="muted">
                  {[
                    customer.phone ? formatPhone(customer.phone) : '',
                    addressText(customer.address),
                    customer.lastOrderDate
                      ? t('customers.link.last', { date: customer.lastOrderDate })
                      : '',
                  ]
                    .filter((part) => part !== '')
                    .join(' · ')}
                </span>
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
        <Row>
          <Button
            onClick={() => {
              createForCode(slug, order.firstName, customerCode, date);
              close();
            }}
          >
            {t('customers.link.newCustomer')}
          </Button>
          <Button variant="secondary" onClick={close}>
            {t('customers.link.skip')}
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
