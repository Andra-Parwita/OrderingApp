import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { CustomerOrder, Language } from '../../../shared/domain';
import type { MenuResponse } from '../../../shared/menuContract';
import { formatMoney } from '../../../shared/money';
import { formatOrderCode } from '../../../shared/orderCode';
import { OrderQr } from '../../components/OrderQr';
import { PageTopBar } from '../../components/CustomerPage';
import { orderTotalCents } from './helpers';
import { ORDERS_NS } from './i18n/register';
import { OrderIcon } from './orderIcons';
import { orderInfo } from './orderInfo';
import { OrderCode } from './orderParts';

// order-qr (spec §4.3): full screen on `surf`. The QR stays dark on white in every theme.

const Screen = styled.div`
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-bottom: calc(var(--sab) + ${({ theme }) => theme.spacing.lg});
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.text};
  text-align: center;
`;
const Top = styled.div`
  width: 100%;
`;
const Title = styled.h1`
  margin: ${({ theme }) => theme.spacing.xs} 0 ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.type.size.xl};
  line-height: 1.2;
  font-weight: 700;
`;
const Lead = styled.p`
  margin: 0 ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.md};
`;
const Card = styled.div`
  padding: ${({ theme }) => theme.spacing.lg};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: 1.5rem;
  line-height: 0;

  svg {
    max-width: 100%;
    height: auto;
    border-radius: ${({ theme }) => theme.radius.md};
  }
`;
const Code = styled.div`
  margin: ${({ theme }) => theme.spacing.lg} 0 ${({ theme }) => theme.spacing.md};
`;
const Summary = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.md};

  b {
    font-weight: 700;
  }
  span {
    display: block;
    color: ${({ theme }) => theme.c.muted};
  }
`;
const Brightness = styled.p`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  margin: auto 0 0;
  padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.lg} 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.md};
  text-align: left;
`;

/** The QR encodes the raw order code, the same value the seller's hand-over search accepts. */
export function OrderQrView({
  order,
  menu,
  lang,
  onBack,
}: Readonly<{
  order: CustomerOrder;
  menu: MenuResponse | undefined;
  lang: Language;
  onBack: () => void;
}>) {
  const { t } = useTranslation(ORDERS_NS);
  const info = orderInfo(order, menu, lang);
  const items = order.lines.reduce((sum, line) => sum + line.qty, 0);
  const place = order.fulfilment === 'pickup' ? info.place : undefined;
  const where = [place, info.whenText].filter(Boolean).join(' · ');
  return (
    <Screen>
      <Top>
        <PageTopBar
          kitchenName={info.kitchenName}
          logoSrc={info.logoSrc}
          backLabel={t('order.titleShort')}
          onBack={onBack}
        />
      </Top>
      <Title>{t('order.qrTitle')}</Title>
      <Lead>{t('order.qrBody', { cook: info.cook })}</Lead>
      <Card>
        <OrderQr
          code={order.code}
          size={250}
          label={t('order.qrAlt', { code: formatOrderCode(order.code) })}
        />
      </Card>
      <Code>
        <OrderCode code={order.code} size="2.75rem" />
      </Code>
      <Summary>
        <b>{order.firstName}</b> · {t('order.items', { count: items })} ·{' '}
        {formatMoney(orderTotalCents(order), lang)}
        {where ? <span>{where}</span> : null}
      </Summary>
      <Brightness>
        <OrderIcon name="sun" />
        {t('order.qrBrightness')}
      </Brightness>
    </Screen>
  );
}
