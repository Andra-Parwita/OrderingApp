import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { SELLER_NS } from '../i18n/register';
import { addressText } from './addressBook';
import type { Customer } from './bookTypes';
import { lastDigits, shortDay } from './customerFormat';

// Plan 106 (Q1, Q2): the saved customers, A to Z; tapping a row opens Edit.

const List = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
`;
const RowButton = styled.button`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  width: 100%;
  min-height: ${({ theme }) => theme.minTapTarget};
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border: 0;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  overflow-wrap: anywhere;
  .muted {
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.875rem;
  }
`;
const Empty = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.875rem;
`;

const sameName = (name: string): string => name.trim().toLowerCase();
const shortAddress = (customer: Customer): string =>
  [customer.address?.street, customer.address?.suburb].filter((part) => part).join(', ');

/** Customers matching what was typed (name, number or address), A to Z by name. */
export function visibleCustomers(
  customers: ReadonlyArray<Customer>,
  query: string,
  lang: string,
): Array<Customer> {
  const wanted = query.trim().toLowerCase();
  return customers
    .filter(
      (customer) =>
        wanted === '' ||
        [customer.firstName, customer.phone ?? '', addressText(customer.address)]
          .join(' ')
          .toLowerCase()
          .includes(wanted),
    )
    .sort(
      (a, b) =>
        a.firstName.localeCompare(b.firstName, lang, { sensitivity: 'base' }) ||
        b.lastOrderDate.localeCompare(a.lastOrderDate),
    );
}

export function CustomerList({
  customers,
  query,
  onOpen,
}: Readonly<{
  customers: ReadonlyArray<Customer>;
  query: string;
  onOpen: (customer: Customer) => void;
}>) {
  const { t, i18n } = useTranslation(SELLER_NS);
  const shown = useMemo(
    () => visibleCustomers(customers, query, i18n.language),
    [customers, query, i18n.language],
  );
  if (shown.length === 0) {
    return (
      <Empty>{t(customers.length === 0 ? 'customers.list.empty' : 'customers.list.noMatch')}</Empty>
    );
  }
  const copies = new Map<string, number>();
  for (const customer of customers) {
    const key = sameName(customer.firstName);
    copies.set(key, (copies.get(key) ?? 0) + 1);
  }
  return (
    <List>
      {shown.map((customer) => {
        const count = copies.get(sameName(customer.firstName)) ?? 1;
        const name =
          count > 1
            ? t('customers.list.dup', { count, name: customer.firstName })
            : customer.firstName;
        const facts = [
          lastDigits(customer.phone),
          shortAddress(customer),
          customer.lastOrderDate
            ? t('customers.list.last', { date: shortDay(customer.lastOrderDate, i18n.language) })
            : '',
        ].filter((part) => part !== '');
        return (
          <li key={customer.id}>
            <RowButton type="button" onClick={() => onOpen(customer)}>
              <b>{name}</b>
              {facts.length > 0 ? <span className="muted">{facts.join(' · ')}</span> : null}
            </RowButton>
          </li>
        );
      })}
    </List>
  );
}
