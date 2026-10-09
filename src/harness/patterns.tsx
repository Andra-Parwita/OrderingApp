import { useState } from 'react';
import { styled } from 'styled-components';
import { LanguageSwitch } from '../components/LanguageSwitch';
import {
  BottomSheet,
  Button,
  ComposeAndSend,
  EmptyState,
  ListWithPanel,
  Pager,
  SheetRow,
  SlideOverEditor,
  UndoToast,
  WarningDialog,
  pageItems,
  type ComposeLanguage,
} from '../ui';
import { AppThemeProvider } from '../theme/AppThemeProvider';

// ?harness=patterns: each pattern of plan 001 stage 2, once, with sample content (dev only).

const Page = styled.main`
  max-width: 64rem;
  margin: 0 auto;
  padding: ${({ theme }) => theme.size.pagePadTablet}px;
  color: ${({ theme }) => theme.c.text};
`;
const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.xl} 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const Heading = styled.h2`
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
`;
const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const ORDERS = ['K7F-2QX Rina', 'M3H-9TD Tom', 'P2Q-4WE Sari', 'T8N-1ZB Made'];
const PEOPLE = Array.from({ length: 64 }, (_, index) => `Earlier menu ${index + 1}`);
const MESSAGE: Record<ComposeLanguage, string> = {
  en: 'Hi! Your order is ready for pickup at Pickup A. See you soon.',
  id: 'Halo! Pesanan Anda siap diambil di Pickup A. Sampai jumpa.',
};

export function Harness() {
  const [open, setOpen] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(ORDERS[0] ?? null);
  const [toast, setToast] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [language, setLanguage] = useState<ComposeLanguage>('en');
  const close = () => setOpen(null);

  return (
    <AppThemeProvider>
      <Page>
        <Row>
          <LanguageSwitch />
        </Row>
        <Section>
          <Heading>List + side panel (384 px)</Heading>
          <ListWithPanel
            panelLabel="Order detail"
            panel={selected ? <p>{selected}: 2 Lemper, 1 Tempe</p> : undefined}
            panelAction={<Button variant="primary">Confirm</Button>}
            list={
              <div>
                {ORDERS.map((order) => (
                  <Button key={order} onClick={() => setSelected(order)} fullWidth>
                    {order}
                  </Button>
                ))}
              </div>
            }
          />
        </Section>
        <Section>
          <Heading>Slide-over, warning dialog, bottom sheet, toast</Heading>
          <Row>
            <Button onClick={() => setOpen('editor')}>Slide-over editor</Button>
            <Button onClick={() => setOpen('warning')}>Warning dialog</Button>
            <Button onClick={() => setOpen('sheet')}>Bottom sheet</Button>
            <Button onClick={() => setToast('Rina confirmed')}>Toast with Undo</Button>
          </Row>
        </Section>
        <Section>
          <Heading>Empty state and first run</Heading>
          <EmptyState
            title="No menu yet"
            why="Make your first menu to start taking orders."
            steps={[
              { id: 'pictures', label: 'Add pictures', done: true },
              { id: 'whatsapp', label: 'Add your WhatsApp number', done: false },
              { id: 'menu', label: 'Make a menu', done: false },
            ]}
            action={<Button variant="primary">Make a menu</Button>}
          />
        </Section>
        <Section>
          <Heading>Pager of 20</Heading>
          {pageItems(PEOPLE, page).map((name) => (
            <span key={name}>{name}</span>
          ))}
          <Pager page={page} total={PEOPLE.length} onPage={setPage} />
        </Section>
        <Section>
          <Heading>Compose and send</Heading>
          <ComposeAndSend
            text={MESSAGE[language]}
            language={language}
            onLanguage={setLanguage}
            sendLabel="Send to Pickup A"
            onSend={() => setToast('Sent')}
          />
        </Section>
      </Page>
      {open === 'editor' ? (
        <SlideOverEditor title="Edit Rendang" dirty onCancel={close} onSave={close}>
          <p>Dish fields go here.</p>
        </SlideOverEditor>
      ) : null}
      {open === 'warning' ? (
        <WarningDialog
          title="Delete Rendang?"
          cancelLabel="Keep dish"
          continueLabel="Delete anyway"
          onCancel={close}
          onContinue={close}
        >
          3 people ordered Rendang. Their orders keep it.
        </WarningDialog>
      ) : null}
      {open === 'sheet' ? (
        <BottomSheet title="Filter orders" onClose={close}>
          <SheetRow $selected onClick={close}>
            All
          </SheetRow>
          <SheetRow onClick={close}>Changed</SheetRow>
          <SheetRow onClick={close}>Not paid</SheetRow>
        </BottomSheet>
      ) : null}
      <UndoToast message={toast} onUndo={() => setToast(null)} onDismiss={() => setToast(null)} />
    </AppThemeProvider>
  );
}
