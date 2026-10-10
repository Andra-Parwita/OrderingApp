import type { ComponentPropsWithoutRef } from 'react';
import { styled } from 'styled-components';
import { FieldFrame, fieldControlStyle, useFieldIds, type FieldProps } from './Field';

export type TextAreaProps = FieldProps &
  Readonly<{ value: string }> &
  Omit<ComponentPropsWithoutRef<'textarea'>, 'className' | 'style' | 'value' | 'id'>;

const Area = styled.textarea<{ $invalid: boolean }>`
  ${fieldControlStyle}
  min-height: calc(${({ theme }) => theme.minTapTarget} * 2);
  resize: vertical;
`;

export function TextArea({
  label,
  helper,
  error,
  showCounter,
  value,
  maxLength,
  ...rest
}: TextAreaProps) {
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
      <Area
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
