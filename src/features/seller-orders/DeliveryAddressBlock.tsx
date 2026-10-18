import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { styled } from 'styled-components';
import { addressLine, checkOnMapUrl, directionsUrl } from '../../../shared/address';
import type { Order } from '../../../shared/domain';
import { deleteOrderAddress, markOrderAddressSeen } from '../../api/client';
import { whatsAppUrl } from '../../api/device/whatsapp';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { Button } from '../../ui';
import { isIphone } from '../../components/isIphone';
import { QuietMapLinks } from '../../components/QuietMapLinks';
import { getContactDigits } from './contacts';
import { SELLER_NS } from './i18n/register';
import { useReadOnlyOrders } from './orderAccess';
import { refreshRequested } from './sellerOrdersSlice';

// Plan 071 (D-099): the delivery address on an order, for the kitchen's team only: the lines, the
// notes for the driver (never sent to Maps), Directions, and Call / WhatsApp when this phone has
// the customer's number saved. "Delete address now" for an owner or chef.

const Box = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  p {
    margin: 0;
    overflow-wrap: anywhere;
  }
  .muted {
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.875rem;
  }
`;
const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Link = styled.a`
  display: inline-flex;
  align-items: center;
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  color: ${({ theme }) => theme.c.text};
  font-size: 0.9375rem;
  font-weight: 600;
  text-decoration: none;
`;
const Changed = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  strong {
    font-size: 0.875rem;
  }
`;
const Plain = styled.button`
  align-self: flex-start;
  padding: 0;
  border: 0;
  background: none;
  color: ${({ theme }) => theme.c.danger};
  font: inherit;
  font-size: 0.875rem;
  text-decoration: underline;
  cursor: pointer;
`;

/** WhatsApp and Call, when this phone has the customer's number saved. */
export function ContactLinks({ digits }: Readonly<{ digits: string }>) {
  const { t } = useTranslation(SELLER_NS);
  return (
    <>
      <Link href={whatsAppUrl(undefined, digits)} target="_blank" rel="noopener noreferrer">
        {t('address.whatsapp')}
      </Link>
      <Link href={`tel:+${digits}`}>{t('address.call')}</Link>
    </>
  );
}

/** The actions on a delivery address, shared by the address block and the Deliveries rows. */
export function useAddressActions(order: Order) {
  const { t } = useTranslation(SELLER_NS);
  const dispatch = useDispatch();
  const readOnly = useReadOnlyOrders();
  const digits = getContactDigits(currentSellerSlug(), order.code, order.customerCode);
  const remove = useCallback(() => {
    if (!window.confirm(t('address.deleteConfirm'))) return;
    void deleteOrderAddress(order.code).then(() => dispatch(refreshRequested()));
  }, [dispatch, order.code, t]);

  const gotIt = useCallback(() => {
    void markOrderAddressSeen(order.code, undefined, currentSellerSlug()).then(() =>
      dispatch(refreshRequested()),
    );
  }, [dispatch, order.code]);
  return { readOnly, digits, remove, gotIt };
}

export function DeliveryAddressBlock({
  order,
  showEmpty = false,
}: Readonly<{ order: Order; showEmpty?: boolean }>) {
  const { t } = useTranslation(SELLER_NS);
  const { readOnly, digits, remove, gotIt } = useAddressActions(order);

  if (order.fulfilment !== 'delivery') return null;
  const { address } = order;
  if (!address && !showEmpty) return null;

  const contact = digits ? <ContactLinks digits={digits} /> : null;

  if (!address) {
    return (
      <Box aria-label={t('address.title')}>
        <p className="muted">{t('address.none')}</p>
        {contact ? <Actions>{contact}</Actions> : null}
      </Box>
    );
  }
  if ('unavailable' in address) {
    return (
      <Box aria-label={t('address.title')} role="status">
        <p>{t('address.unavailable')}</p>
        {contact ? <Actions>{contact}</Actions> : null}
      </Box>
    );
  }
  const a = address.address;
  return (
    <Box aria-label={t('address.title')}>
      {order.addressChanged === 'new' ? (
        <Changed role="status">
          <strong>↻ {t('address.changedMark')}</strong>
          {readOnly ? null : (
            <Button variant="quiet" onClick={gotIt}>
              {t('address.gotIt')} ✓
            </Button>
          )}
        </Changed>
      ) : null}
      <p>
        <b>{addressLine(a)}</b>
      </p>
      {a.notes ? (
        <p>
          <span className="muted">{t('address.notes')}: </span>
          {a.notes}
        </p>
      ) : null}
      {a.lat !== undefined ? <p className="muted">{t('address.pinned')}</p> : null}
      <Actions>
        {/* Plan 083: quiet Directions / Map links, like the private orders (plan 081). */}
        <QuietMapLinks
          directions={{ href: directionsUrl(a), label: t('address.directions') }}
          map={{ href: checkOnMapUrl(a), label: t('address.viewOnMap') }}
        />
        {isIphone() ? (
          <Link href={directionsUrl(a, true)} target="_blank" rel="noopener noreferrer">
            {t('address.appleMaps')}
          </Link>
        ) : null}
        {contact}
      </Actions>
      {readOnly ? null : (
        <Plain type="button" onClick={remove}>
          {t('address.deleteNow')}
        </Plain>
      )}
    </Box>
  );
}
