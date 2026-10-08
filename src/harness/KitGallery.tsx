import { useCallback, useState, type ChangeEvent } from 'react';
import { styled, ThemeProvider } from 'styled-components';
import {
  Button,
  ConfirmButton,
  IconButton,
  ListRow,
  Pill,
  Segmented,
  Stepper,
  TabBar,
  TextArea,
  TextField,
  Toast,
  type SegmentedOption,
  type TabBarItem,
} from '../ui';
import { GlobalStyle } from '../theme/GlobalStyle';
import { darkTheme, lightTheme } from '../theme/themes';
import { statusTones } from '../theme/tokens';

type Mode = 'light' | 'dark';

const MODE_OPTIONS: ReadonlyArray<SegmentedOption<Mode>> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];
const LANG_OPTIONS: ReadonlyArray<SegmentedOption<'en' | 'id'>> = [
  { value: 'en', label: 'EN' },
  { value: 'id', label: 'ID' },
];
const TABS: ReadonlyArray<TabBarItem> = [
  { id: 'menu', label: 'Menu', href: '#menu' },
  { id: 'order', label: 'Order', href: '#order' },
  { id: 'info', label: 'Info', href: '#info', disabled: true, hint: 'coming soon' },
];

const Page = styled.main`
  max-width: min(100%, 45rem);
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.lg};
  padding-bottom: calc(${({ theme }) => theme.minTapTarget} * 2);
`;

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.lg} 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid
    ${({ theme }) => theme.colour.hairline};
`;

const Heading = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: ${({ theme }) => theme.type.weight.strong};
  color: ${({ theme }) => theme.colour.textMuted};
`;

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;

const CONFIRMED_PILL = <Pill tone="confirmed">Confirmed</Pill>;
const ORDERED_PILL = <Pill tone="ordered">Ordered</Pill>;

const noop = () => undefined;

export function KitGallery() {
  const [mode, setMode] = useState<Mode>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );
  const [lang, setLang] = useState<'en' | 'id'>('en');
  const [qty, setQty] = useState(2);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const onName = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setName(event.target.value),
    [],
  );
  const onNote = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => setNote(event.target.value),
    [],
  );
  const showToast = useCallback(() => setToast('Order sent'), []);
  const clearToast = useCallback(() => setToast(null), []);

  return (
    <ThemeProvider theme={mode === 'dark' ? darkTheme : lightTheme}>
      <GlobalStyle />
      <Page>
        <Section>
          <Heading>Theme and Segmented</Heading>
          <Row>
            <Segmented options={MODE_OPTIONS} value={mode} onChange={setMode} label="Theme" />
            <Segmented options={LANG_OPTIONS} value={lang} onChange={setLang} label="Language" />
          </Row>
        </Section>

        <Section>
          <Heading>Button</Heading>
          <Row>
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="quiet">Quiet</Button>
            <Button variant="primary" autoFocus>
              Focused
            </Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
            <Button variant="secondary" disabled>
              Disabled
            </Button>
            <IconButton label="Close">×</IconButton>
            <IconButton label="Close (disabled)" disabled>
              ×
            </IconButton>
          </Row>
          <Button variant="primary" fullWidth>
            Full width
          </Button>
        </Section>

        <Section>
          <Heading>ConfirmButton</Heading>
          <Row>
            <ConfirmButton
              label="Cancel order"
              confirmLabel="Tap again to cancel"
              onConfirm={noop}
            />
            <ConfirmButton
              label="Cancel order"
              confirmLabel="Tap again to cancel"
              onConfirm={noop}
              initiallyArmed
            />
            <ConfirmButton
              label="Cancel order"
              confirmLabel="Tap again"
              onConfirm={noop}
              disabled
            />
          </Row>
        </Section>

        <Section>
          <Heading>TextField and TextArea</Heading>
          <TextField
            label="Name"
            helper="As you want it on the order"
            value={name}
            onChange={onName}
            maxLength={40}
            showCounter
          />
          <TextField label="Name (error)" error="Please enter a name" value="" onChange={noop} />
          <TextField label="Name (disabled)" value="Rina" onChange={noop} disabled />
          <TextArea label="Note" value={note} onChange={onNote} maxLength={200} showCounter />
          <TextArea label="Note (error)" error="Note is too long" value="" onChange={noop} />
        </Section>

        <Section>
          <Heading>Stepper</Heading>
          <Row>
            <Stepper
              label="Chicken lemper"
              decreaseLabel="Decrease"
              increaseLabel="Increase"
              value={qty}
              onChange={setQty}
              max={5}
            />
            <Stepper
              label="Sold out item"
              decreaseLabel="Decrease"
              increaseLabel="Increase"
              value={0}
              onChange={noop}
              disabled
            />
          </Row>
        </Section>

        <Section>
          <Heading>Pill</Heading>
          <Row>
            {statusTones.map((tone) => (
              <Pill key={tone} tone={tone}>
                {tone}
              </Pill>
            ))}
          </Row>
        </Section>

        <Section>
          <Heading>ListRow</Heading>
          <div>
            <ListRow
              primary="K7F-2QX  Rina"
              secondary="2 Lemper, 1 Tempe · Pickup"
              trailing={CONFIRMED_PILL}
              onClick={noop}
            />
            <ListRow
              primary="M3H-9TD  Tom"
              secondary="1 Nasi campur · Delivery"
              trailing={ORDERED_PILL}
              href="#row"
            />
          </div>
        </Section>

        <Section>
          <Heading>Toast</Heading>
          <Row>
            <Button onClick={showToast}>Show toast</Button>
          </Row>
        </Section>

        <TabBar items={TABS} activeId="menu" label="Main" />
        <Toast message={toast} onDismiss={clearToast} />
      </Page>
    </ThemeProvider>
  );
}
