import { styled } from 'styled-components';
import { BottomSheet } from '../../ui';

// Plan 092 (option D): the picker behind a value row. Real radio inputs in one group, so the arrow
// keys work; picking one applies it at once and closes the sheet.

export type Choice<T extends string> = Readonly<{ value: T; label: string; hint?: string }>;

const Option = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: 3rem;
  padding: 0 ${({ theme }) => theme.spacing.sm};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  cursor: pointer;

  input {
    flex: none;
    width: 1.25rem;
    height: 1.25rem;
    margin: 0;
    accent-color: ${({ theme }) => theme.c.fill};
  }
  &:has(input:focus-visible) {
    outline: ${({ theme }) => theme.border.focus} solid ${({ theme }) => theme.c.atext};
    outline-offset: -${({ theme }) => theme.border.focus};
  }
`;
const Words = styled.span`
  display: flex;
  flex-direction: column;

  small {
    color: ${({ theme }) => theme.c.muted};
    font-size: ${({ theme }) => theme.type.size.md};
  }
`;

export function ChoiceSheet<T extends string>({
  title,
  choices,
  value,
  onPick,
  onClose,
}: Readonly<{
  title: string;
  choices: ReadonlyArray<Choice<T>>;
  value: T;
  onPick: (next: T) => void;
  onClose: () => void;
}>) {
  return (
    <BottomSheet title={title} onClose={onClose}>
      <div role="radiogroup" aria-label={title}>
        {choices.map((choice) => (
          <Option key={choice.value}>
            <input
              type="radio"
              name={`choice-${title}`}
              value={choice.value}
              checked={choice.value === value}
              onChange={() => {
                onPick(choice.value);
              }}
              onClick={onClose}
            />
            <Words>
              {choice.label}
              {choice.hint ? <small>{choice.hint}</small> : null}
            </Words>
          </Option>
        ))}
      </div>
    </BottomSheet>
  );
}
