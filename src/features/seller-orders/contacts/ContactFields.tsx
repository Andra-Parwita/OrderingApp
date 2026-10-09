import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { TextArea, TextField } from '../../../ui';
import { SELLER_NS } from '../i18n/register';

const Fields = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Note = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.8125rem;
`;

export type ContactFieldsProps = Readonly<{
  phone: string;
  address: string;
  onPhone: (next: string) => void;
  onAddress: (next: string) => void;
  /** Shows "not a valid number" under the phone field. */
  phoneInvalid: boolean;
  /** Delivery orders only; pickup orders keep just the number. */
  showAddress: boolean;
}>;

/** The two device-only fields (D-059): a WhatsApp number and a delivery address. Phone widths only. */
export function ContactFields({
  phone,
  address,
  onPhone,
  onAddress,
  phoneInvalid,
  showAddress,
}: ContactFieldsProps) {
  const { t } = useTranslation(SELLER_NS);
  return (
    <Fields>
      <TextField
        label={t('contact.phone')}
        helper={t('contact.phoneHelper')}
        value={phone}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onPhone(event.target.value)}
        type="tel"
        inputMode="tel"
        autoComplete="off"
        {...(phoneInvalid ? { error: t('contact.invalid') } : {})}
      />
      {showAddress ? (
        <TextArea
          label={t('contact.address')}
          helper={t('contact.addressHelper')}
          value={address}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onAddress(event.target.value)}
          maxLength={300}
        />
      ) : null}
      <Note>{t('contact.onlyHere')}</Note>
    </Fields>
  );
}
