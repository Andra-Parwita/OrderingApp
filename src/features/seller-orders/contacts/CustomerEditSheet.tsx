import { useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { normaliseAuMobile } from '../../../../shared/phone';
import { Button, SlideOver, TextArea, TextField } from '../../../ui';
import { SELLER_NS } from '../i18n/register';
import { emptyAddress, newId } from './addressBook';
import type { Customer } from './bookTypes';
import { localPhone } from './customerFormat';

// Plan 106 (Q1, Q3, Q4): one sheet to add or edit a saved customer, with Delete inside.

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding: 0 ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.xl};
  h2,
  p {
    margin: 0;
  }
`;
const Two = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Danger = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding-top: ${({ theme }) => theme.spacing.md};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;

export type CustomerEditSheetProps = Readonly<{
  /** The customer to edit, or null to add a new one. */
  customer: Customer | null;
  device: string;
  onSave: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
  onClose: () => void;
}>;

export function CustomerEditSheet({
  customer,
  device,
  onSave,
  onDelete,
  onClose,
}: CustomerEditSheetProps) {
  const { t } = useTranslation(SELLER_NS);
  const start = customer?.address ?? emptyAddress();
  const [name, setName] = useState(customer?.firstName ?? '');
  const [phone, setPhone] = useState(localPhone(customer?.phone));
  const [street, setStreet] = useState(start.street);
  const [suburb, setSuburb] = useState(start.suburb);
  const [postcode, setPostcode] = useState(start.postcode);
  const [notes, setNotes] = useState(start.notes);
  const [errors, setErrors] = useState<{ name?: boolean; phone?: boolean }>({});
  const [removing, setRemoving] = useState(false);
  const title = t(customer ? 'customers.list.editTitle' : 'customers.list.addTitle');
  const text =
    (set: (next: string) => void) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      set(event.target.value);
      setErrors({});
    };

  const save = () => {
    const firstName = name.trim();
    const typed = phone.trim();
    const digits = typed === '' ? undefined : normaliseAuMobile(typed);
    if (firstName === '' || digits === null) {
      setErrors({ name: firstName === '', phone: digits === null });
      return;
    }
    const address = {
      street: street.trim(),
      suburb: suburb.trim(),
      postcode: postcode.trim(),
      notes: notes.trim(),
    };
    const hasAddress = Object.values(address).some((part) => part !== '');
    const at = new Date().toISOString();
    onSave({
      id: customer?.id ?? newId(),
      firstName,
      ...(digits ? { phone: digits } : {}),
      ...(hasAddress ? { address } : {}),
      customerCodes: customer?.customerCodes ?? [],
      orderCodes: customer?.orderCodes ?? [],
      lastOrderDate: customer?.lastOrderDate ?? '',
      createdAt: customer?.createdAt ?? at,
      updatedAt: at,
    });
  };

  return (
    <SlideOver
      label={title}
      closeLabel={t('customers.list.close')}
      onClose={onClose}
      footer={
        <Row>
          <Button onClick={save}>{t('customers.list.save')}</Button>
          <Button variant="secondary" onClick={onClose}>
            {t('customers.list.cancel')}
          </Button>
        </Row>
      }
    >
      <Body>
        <h2>{title}</h2>
        <TextField
          label={t('customers.list.name')}
          value={name}
          onChange={text(setName)}
          autoComplete="off"
          {...(errors.name ? { error: t('customers.list.nameRequired') } : {})}
        />
        <TextField
          label={t('customers.list.phone')}
          helper={t('customers.list.phoneHelper')}
          value={phone}
          onChange={text(setPhone)}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          {...(errors.phone ? { error: t('contact.invalid') } : {})}
        />
        <TextField
          label={t('customers.list.street')}
          value={street}
          onChange={text(setStreet)}
          autoComplete="off"
        />
        <Two>
          <TextField
            label={t('customers.list.suburb')}
            value={suburb}
            onChange={text(setSuburb)}
            autoComplete="off"
          />
          <TextField
            label={t('customers.list.postcode')}
            value={postcode}
            onChange={text(setPostcode)}
            inputMode="numeric"
            autoComplete="off"
          />
        </Two>
        <TextArea
          label={t('customers.list.notes')}
          value={notes}
          onChange={text(setNotes)}
          maxLength={300}
        />
        {customer ? (
          <Danger>
            {removing ? (
              <>
                <p>{t('customers.list.deleteAsk', { name: customer.firstName, device })}</p>
                <Row>
                  <Button onClick={() => onDelete(customer)}>
                    {t('customers.list.deleteYes')}
                  </Button>
                  <Button variant="secondary" onClick={() => setRemoving(false)}>
                    {t('customers.list.deleteNo')}
                  </Button>
                </Row>
              </>
            ) : (
              <Row>
                <Button variant="secondary" onClick={() => setRemoving(true)}>
                  {t('customers.list.delete')}
                </Button>
              </Row>
            )}
          </Danger>
        ) : null}
      </Body>
    </SlideOver>
  );
}
