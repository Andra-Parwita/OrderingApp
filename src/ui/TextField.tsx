import type { ComponentPropsWithoutRef } from 'react';
import { styled } from 'styled-components';
import { FieldFrame, fieldControlStyle, useFieldIds, type FieldProps } from './Field';

export type TextFieldProps = FieldProps &
  Readonly<{ value: string }> &
  Omit<ComponentPropsWithoutRef<'input'>, 'className' | 'style' | 'value' | 'id'>;

const Input = styled.input<{ $invalid: boolean }>`
  ${fieldControlStyle}
`;

export function TextField({
  label,
  helper,
  error,
  showCounter,
  value,
  maxLength,
  ...rest
}: TextFieldProps) {
  const { id, helperId, errorId, describedBy } = useFieldIds(helper, error);
  const counter = showCounter && maxLength != null ? `${value.length}/${maxLength}` : undefined;
  return (
    <FieldFrame
      label={label}
      helper={helper}
      error={error}
      id={id}
      helperId={helperId}
      errorId={errorId}
      counter={counter}
    >
      <Input
        {...rest}
        id={id}
        value={value}
        maxLength={maxLength}
        $invalid={error != null}
        aria-invalid={error != null ? true : undefined}
        aria-describedby={describedBy}
      />
    </FieldFrame>
  );
}
