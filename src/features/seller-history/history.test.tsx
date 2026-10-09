import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockStore } from '../../../mocks/handlers';
import { server } from '../../../mocks/server';
import { CSV_BOM } from '../../../shared/csv';
import type { OrderLine, SellerOrder } from '../../../shared/domain';
import { summariseOrders, type PastWeek } from '../../../shared/pastWeeks';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { BackupScreen } from './BackupScreen';
import { PastWeeksScreen } from './PastWeeksScreen';
import { dateStamp, readFileText } from './download';
import { registerSellerHistoryI18n } from './i18n/register';

const lemper: OrderLine = {
  itemId: 'lemper',
  name: { en: 'Chicken lemper', id: 'Lemper ayam' },
  size: { en: '1 portion', id: '1 porsi' },
  priceCents: 1500,
  qty: 2,
};

function order(id: string, code: string, firstName: string, status: SellerOrder['status']) {
  const base: SellerOrder = {
    id,
    sellerId: 's1',
    code,
    token: `tok-${id}`,
    firstName,
    language: 'en',
    lines: [lemper],
    fulfilment: 'pickup',
    status,
    paid: status === 'collected',
    locked: false,
    waReceived: false,
    returning: false,
    changed: false,
    inbox: [],
    audit: [],
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-01T08:00:00Z',
  };
  return base;
}

const ORDERS = [
  order('a', 'K7F2QX', 'Rina', 'collected'),
  order('b', 'M3H9TD', 'Tom', 'confirmed'),
];

function week(id: string, cookingDate: string, withOrders: boolean): PastWeek {
  return {
    id,
    cookingDate,
    closedAt: `${cookingDate}T20:00:00Z`,
    totals: summariseOrders(ORDERS),
    ...(withOrders ? { orders: ORDERS } : {}),
  };
}

const NEW = week('w2', '2026-10-03', true);
const OLD = week('w1', '2026-08-01', false);

function servePastWeeks(): void {
  server.use(
    http.get('*/api/seller/past-weeks', () =>
      HttpResponse.json({
        // Oldest first on purpose: the screen sorts newest first.
        weeks: [OLD, NEW].map((w) => ({
          id: w.id,
          cookingDate: w.cookingDate,
          closedAt: w.closedAt,
          totals: w.totals,
          hasOrders: w.orders !== undefined,
        })),
      }),
    ),
    http.get('*/api/seller/past-weeks/:id', ({ params }) =>
      HttpResponse.json({ week: params['id'] === 'w2' ? NEW : OLD }),
    ),
  );
}

function renderThemed(ui: React.ReactNode) {
  return render(<AppThemeProvider>{ui}</AppThemeProvider>);
}

beforeAll(async () => {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  if (!i18n.isInitialized) await initI18n();
  registerSellerHistoryI18n();
});
beforeEach(async () => {
  mockStore.reset();
  localStorage.clear();
  await i18n.changeLanguage('en');
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('PastWeeksScreen', () => {
  it('lists weeks newest first with orders, income, paid and unpaid', async () => {
    servePastWeeks();
    renderThemed(<PastWeeksScreen />);
    const list = await screen.findByRole('list', { name: 'Past weeks' });
    const rows = within(list).getAllByRole('button');
    expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual([
      'Open week Sat 3 Oct',
      'Open week Sat 1 Aug',
    ]);
    // 2 lemper at $15.00 each in two orders: income $60.00, one paid.
    expect(rows[0]).toHaveTextContent('2 orders');
    expect(rows[0]).toHaveTextContent('Income $60.00');
    expect(rows[0]).toHaveTextContent('Paid $30.00');
    expect(rows[0]).toHaveTextContent('Unpaid $30.00');
    expect(
      screen.getByText('Order details are kept for 4 weeks, then only totals remain.'),
    ).toBeInTheDocument();
  });

  it('opens a recent week with totals, item quantities and its orders', async () => {
    servePastWeeks();
    renderThemed(<PastWeeksScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open week Sat 3 Oct' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Sat 3 Oct' })).toBeInTheDocument();
    const items = screen.getByRole('list', { name: 'Item totals' });
    expect(within(items).getByText('Chicken lemper')).toBeInTheDocument();
    expect(within(items).getByText('4')).toBeInTheDocument();
    const orders = screen.getByRole('list', { name: 'Orders' });
    expect(within(orders).getByText('K7F-2QX')).toBeInTheDocument();
    expect(within(orders).getByText('Collected')).toBeInTheDocument();
    expect(within(orders).getByText('Confirmed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'All weeks' }));
    expect(await screen.findByRole('list', { name: 'Past weeks' })).toBeInTheDocument();
  });

  it('says the details have expired for an old week but keeps its totals', async () => {
    servePastWeeks();
    renderThemed(<PastWeeksScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open week Sat 1 Aug' }));
    await screen.findByRole('heading', { level: 1, name: 'Sat 1 Aug' });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Order details are no longer kept for this week. Only the totals remain.',
    );
    expect(screen.getByText('$60.00')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Orders' })).not.toBeInTheDocument();
  });

  it('speaks Indonesian', async () => {
    await i18n.changeLanguage('id');
    servePastWeeks();
    renderThemed(<PastWeeksScreen />);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Pekan lalu');
    expect(screen.getByText(/Rincian pesanan disimpan 4 pekan/)).toBeInTheDocument();
    const row = screen.getAllByRole('button')[0];
    expect(row).toHaveTextContent('2 pesanan');
    expect(row).toHaveTextContent('Belum lunas');
  });
});

type Saved = { name: string; blob: Blob };

function captureDownloads(): Array<Saved> {
  const saved: Array<Saved> = [];
  const blobs = new Map<string, Blob>();
  let counter = 0;
  URL.createObjectURL = (blob: Blob | MediaSource) => {
    counter += 1;
    const url = `blob:test/${String(counter)}`;
    blobs.set(url, blob as Blob);
    return url;
  };
  URL.revokeObjectURL = () => undefined;
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    const blob = blobs.get(this.href);
    if (blob) saved.push({ name: this.download, blob });
  });
  return saved;
}

function readBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsArrayBuffer(blob);
  });
}

describe('BackupScreen downloads', () => {
  it('downloads the backup as delave-<slug>-<date>.json and remembers the date', async () => {
    const saved = captureDownloads();
    renderThemed(<BackupScreen />);
    expect(screen.getByText('No backup made on this device yet.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Download backup' }));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]?.name).toBe(`delave-onde-onde-${dateStamp()}.json`);
    const parsed = JSON.parse(await readFileText(saved[0]?.blob as Blob)) as {
      version: number;
      seller: { slug: string };
    };
    expect(parsed.version).toBe(1);
    expect(parsed.seller.slug).toBe('onde-onde');
    expect(await screen.findByText(/^Last backup on this device: /)).toBeInTheDocument();
    expect(localStorage.getItem('lastBackup:onde-onde')).toBe(dateStamp());
  });

  it('downloads the orders as orders-<slug>-<date>.csv and keeps the BOM', async () => {
    const saved = captureDownloads();
    renderThemed(<BackupScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Download orders (CSV)' }));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]?.name).toBe(`orders-onde-onde-${dateStamp()}.csv`);
    const bytes = await readBytes(saved[0]?.blob as Blob);
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes.slice(3))).toContain('code,first name,items');
    expect(CSV_BOM).toBe('﻿');
  });

  it('says so when the file cannot be made', async () => {
    captureDownloads();
    server.use(http.get('*/api/seller/backup', () => HttpResponse.error()));
    renderThemed(<BackupScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Download backup' }));
    expect(
      await screen.findByText('Could not make the file. Please try again.'),
    ).toBeInTheDocument();
  });
});

async function backupFile(): Promise<File> {
  const response = await fetch('http://localhost/api/seller/backup', {
    headers: { 'X-Seller': 'onde-onde' },
  });
  return new File([await response.text()], 'backup.json', { type: 'application/json' });
}

function chooseFile(file: File): void {
  fireEvent.change(screen.getByLabelText('Choose backup file'), { target: { files: [file] } });
}

describe('BackupScreen restore', () => {
  it('shows what the file contains, asks twice, then restores', async () => {
    const file = await backupFile();
    const restored = vi.fn();
    server.use(
      http.post('*/api/seller/backup', async ({ request }) => {
        restored(await request.json());
        return HttpResponse.json({ ok: true });
      }),
    );
    renderThemed(<BackupScreen />);
    chooseFile(file);
    expect(await screen.findByText(/^This backup is from /)).toBeInTheDocument();
    expect(screen.getByText(/^Orders: \d+$/)).toBeInTheDocument();
    expect(screen.getByText(/^Past weeks: \d+$/)).toBeInTheDocument();
    expect(screen.getByText(/^Menu items: \d+$/)).toBeInTheDocument();
    // First tap only arms the button; nothing is sent yet.
    fireEvent.click(screen.getByRole('button', { name: 'Restore this backup' }));
    expect(restored).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: "Replace all of this kitchen's data?" }));
    expect(await screen.findByText(/^Backup restored/)).toBeInTheDocument();
    expect(restored).toHaveBeenCalledTimes(1);
  });

  it('rejects a file that is not a backup, without calling the server', async () => {
    const restored = vi.fn();
    server.use(
      http.post('*/api/seller/backup', () => {
        restored();
        return HttpResponse.json({ ok: true });
      }),
    );
    renderThemed(<BackupScreen />);
    chooseFile(new File(['{"hello": 1}'], 'x.json', { type: 'application/json' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That file could not be read as a backup.',
    );
    expect(screen.queryByRole('button', { name: 'Restore this backup' })).not.toBeInTheDocument();
    expect(restored).not.toHaveBeenCalled();
  });

  it('explains an invalid_backup answer from the server in plain words', async () => {
    const file = await backupFile();
    server.use(
      http.post('*/api/seller/backup', () =>
        HttpResponse.json(
          { error: 'invalid_backup', message: 'An order belongs to another kitchen' },
          { status: 400 },
        ),
      ),
    );
    renderThemed(<BackupScreen />);
    chooseFile(file);
    await screen.findByText(/^This backup is from /);
    fireEvent.click(screen.getByRole('button', { name: 'Restore this backup' }));
    fireEvent.click(screen.getByRole('button', { name: "Replace all of this kitchen's data?" }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The server did not accept this backup.',
    );
    // The file is still chosen, so the seller can try again or pick another.
    expect(screen.getByRole('button', { name: 'Restore this backup' })).toBeInTheDocument();
  });

  it('speaks Indonesian', async () => {
    await i18n.changeLanguage('id');
    renderThemed(<BackupScreen />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Cadangan');
    expect(screen.getByRole('button', { name: 'Unduh cadangan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unduh pesanan (CSV)' })).toBeInTheDocument();
    expect(screen.getByText('Pulihkan dari cadangan')).toBeInTheDocument();
    expect(screen.getByLabelText('Pilih berkas cadangan')).toBeInTheDocument();
  });
});
