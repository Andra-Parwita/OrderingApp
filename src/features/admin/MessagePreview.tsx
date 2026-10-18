// Plan 104: the short-message composer shows the REAL notice pill at phone and tablet width, so the
// admin sees where the text is cut with "…", and counts the text the way the server does.
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { MESSAGE_MAX } from '../../../shared/shortMessage';
import { Pill, PillBody, PillRow } from '../../components/notice/NoticePill';
import { ADMIN_NS } from './i18n/register';
import { Muted } from './shared';

/** Same counting as the parser: one per symbol, control characters and line breaks as spaces. */
export function countMessage(text: string): number {
  return [...text].length;
}

const NEAR = 80;

const CounterText = styled.span<{ $tone: 'ok' | 'near' | 'over' }>`
  align-self: flex-end;
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: ${({ $tone, theme }) => ($tone === 'ok' ? 'inherit' : theme.type.weight.strong)};
  color: ${({ $tone, theme }) =>
    $tone === 'over'
      ? theme.status.cancelled.fg
      : $tone === 'near'
        ? theme.colour.text
        : theme.colour.textMuted};
`;

export function MessageCounter({ text }: Readonly<{ text: string }>) {
  const n = countMessage(text);
  const tone = n > MESSAGE_MAX ? 'over' : n >= NEAR ? 'near' : 'ok';
  return (
    <CounterText $tone={tone} data-testid="message-counter">
      {n} / {MESSAGE_MAX}
    </CounterText>
  );
}

const Lang = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  min-width: 0;
`;
const Frames = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  min-width: 0;
`;
const Frame = styled.div<{ $width: string }>`
  box-sizing: border-box;
  width: ${({ $width }) => $width};
  max-width: 100%;
  overflow: hidden;
  padding: 0.375rem;
  background: ${({ theme }) => theme.c.surf2};
  border: ${({ theme }) => theme.border.hairline} dashed ${({ theme }) => theme.c.ctrl};
  border-radius: ${({ theme }) => theme.radius.md};
  font-family: ${({ theme }) => theme.font.ui};
  font-size: ${({ theme }) => theme.type.size.sm};
`;
const Caption = styled.span`
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;

function PillFrame({
  text,
  width,
  label,
}: Readonly<{ text: string; width: string; label: string }>) {
  return (
    <div>
      <Muted as="span">{label}</Muted>
      <Frame $width={width} aria-hidden="true">
        <Pill $kind="announce">
          <PillRow>
            <PillBody text={text} />
          </PillRow>
        </Pill>
      </Frame>
    </div>
  );
}

/** One language: the pill at phone (360 px) and tablet (768 px) width. */
export function PillPreview({ text, language }: Readonly<{ text: string; language: string }>) {
  const { t } = useTranslation(ADMIN_NS);
  return (
    <Lang data-testid="message-preview">
      <Caption>{language}</Caption>
      <Frames>
        <PillFrame text={text} width="22.5rem" label={t('home.message.phone')} />
        <PillFrame text={text} width="48rem" label={t('home.message.tablet')} />
      </Frames>
    </Lang>
  );
}
