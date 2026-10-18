import { styled } from 'styled-components';
import { brandColour } from '../../theme/brandTokens';
import { STEP_IMAGES } from './images';
import type { HelpStep, HelpTopicText } from './topics';

const PIC_DIR = '/help/';

export const Lead = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.md};
`;
export const Steps = styled.ol`
  margin: 0;
  padding: 0;
  list-style: none;

  & > li {
    position: relative;
    padding: ${({ theme }) => theme.spacing.md} 0 ${({ theme }) => theme.spacing.md} 2.5rem;
    border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  }
  & > li:first-child {
    border-top: 0;
  }
  & > li::before {
    content: attr(data-n);
    position: absolute;
    left: 0;
    top: ${({ theme }) => theme.spacing.md};
    display: grid;
    place-items: center;
    width: 1.625rem;
    height: 1.625rem;
    border-radius: 50%;
    background: ${({ theme }) => theme.c.fill};
    color: ${({ theme }) => theme.c.on};
    font-size: ${({ theme }) => theme.type.size.sm};
    font-weight: ${({ theme }) => theme.type.weight.strong};
  }
  & > li.part {
    padding: 0.875rem 0 0.375rem;
    border-top: ${({ theme }) => theme.border.focus} solid ${({ theme }) => theme.c.line};
    color: ${({ theme }) => theme.c.atext};
    font-weight: 700;
  }
  & > li.part::before {
    display: none;
  }
  & > li.part:first-child {
    padding-top: 0;
    border-top: 0;
  }
  p {
    max-width: 62ch;
    margin: 0;
  }
  b {
    padding: 0 0.3em;
    border-radius: ${({ theme }) => theme.radius.sm};
    background: ${({ theme }) => theme.c.surf2};
    font-weight: 700;
  }
  @media (max-width: 51.25rem) {
    & > li {
      padding-left: 2.25rem;
    }
  }
`;
export const Picture = styled.img`
  display: block;
  box-sizing: border-box;
  max-width: min(100%, 26.25rem);
  height: auto;
  margin-top: ${({ theme }) => theme.spacing.sm};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: ${({ theme }) => theme.radius.md};
`;
export const Note = styled.p`
  margin: ${({ theme }) => theme.spacing.lg} 0 0;
  padding: 0.625rem ${({ theme }) => theme.spacing.md};
  border-left: 0.1875rem solid ${brandColour.bobo};
  border-radius: 0 ${({ theme }) => theme.radius.md} ${({ theme }) => theme.radius.md} 0;
  background: ${({ theme }) => theme.c.surf2};
  font-size: 0.875rem;
`;

/** `**bold**` marks a button or label as the app shows it. */
function Rich({ text }: Readonly<{ text: string }>) {
  return <>{text.split('**').map((part, i) => (i % 2 === 1 ? <b key={i}>{part}</b> : part))}</>;
}

const plain = (text: string) => text.replaceAll('**', '');
const stepText = (step: HelpStep) => ('part' in step ? step.part : step.text);

export function matches(topic: HelpTopicText, query: string): boolean {
  if (query === '') return true;
  const all = [topic.n, topic.s, topic.l, ...topic.steps.map(stepText), topic.note];
  return plain(all.join(' ')).toLowerCase().includes(query);
}

export function StepsView({
  topic,
  index,
  alt,
  pictures,
}: Readonly<{
  topic: HelpTopicText;
  index: number;
  alt: (what: string) => string;
  pictures: boolean;
}>) {
  // A step's number restarts after each part heading (A, B, iPhone, Android).
  const numbers = topic.steps.reduce<Array<number>>((all, step, i) => {
    all.push('part' in step ? 0 : (all[i - 1] ?? 0) + 1);
    return all;
  }, []);
  return (
    <>
      <Lead>{topic.l}</Lead>
      <Steps>
        {topic.steps.map((step, i) => {
          if ('part' in step) {
            return (
              <li key={i} className="part">
                {step.part}
              </li>
            );
          }
          const file = pictures ? STEP_IMAGES[`${index + 1}.${i + 1}`] : undefined;
          return (
            <li key={i} data-n={numbers[i]}>
              <p>
                <Rich text={step.text} />
              </p>
              {file !== undefined ? (
                <Picture
                  src={`${PIC_DIR}${file}`}
                  alt={alt(step.pic ?? '')}
                  loading="lazy"
                  decoding="async"
                />
              ) : null}
            </li>
          );
        })}
      </Steps>
      <Note>{topic.note}</Note>
    </>
  );
}
