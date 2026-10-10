import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mockStore } from '../../../mocks/handlers';
import { server } from '../../../mocks/server';
import { SettingsScreen } from './SettingsScreen';
import { createTestStore, renderWithStore, setupI18n } from './testSupport';

beforeAll(setupI18n);

describe('SettingsScreen', () => {
  beforeEach(() => mockStore.reset());

  async function renderSettings() {
    const store = createTestStore();
    renderWithStore(<SettingsScreen />, store);
    await screen.findByLabelText('Your WhatsApp number');
    return store;
  }
  const number = () => screen.getByLabelText('Your WhatsApp number');

  it('shows the switch, the cut-off line, the number and the texts with counters', async () => {
    await renderSettings();
    expect(screen.getByRole('radio', { name: 'Open' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Closes automatically at Fri 9 Oct, 9 pm')).toBeInTheDocument();
    expect(number()).toHaveValue('');
    expect(screen.getByLabelText('Greeting (English)')).toHaveValue(
      (await mockStore.getSettings()).postGreeting.en,
    );
    expect(screen.getAllByText('{phone} is replaced with your number')).toHaveLength(2);
    expect(screen.getAllByText(/^\d+\/500$/)).toHaveLength(4);
  });

  it('refuses an invalid number inline and does not send it', async () => {
    let puts = 0;
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'PUT') puts += 1;
    });
    await renderSettings();
    fireEvent.change(number(), { target: { value: '12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText('Enter an Australian mobile number, for example 0412 345 678.'),
    ).toBeInTheDocument();
    expect(number()).toHaveAttribute('aria-invalid', 'true');
    expect(puts).toBe(0);
  });

  it('shows the server refusal on the number field', async () => {
    server.use(
      http.put('*/api/seller/settings', () =>
        HttpResponse.json({ error: 'invalid_request', message: 'Bad number' }, { status: 400 }),
      ),
    );
    await renderSettings();
    fireEvent.change(number(), { target: { value: '0412 345 678' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText('Enter an Australian mobile number, for example 0412 345 678.'),
    ).toBeInTheDocument();
  });

  it('shows a general message when saving fails for another reason', async () => {
    server.use(http.put('*/api/seller/settings', () => HttpResponse.error()));
    await renderSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save. Try again.');
  });

  it('saves: the server normalises the number and a toast says Saved', async () => {
    await renderSettings();
    fireEvent.change(number(), { target: { value: '0412 345 678' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Closed' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    await waitFor(() => expect(number()).toHaveValue('+61 412 345 678'));
    expect(await mockStore.getSettings()).toMatchObject({
      whatsappNumber: '61412345678',
      orderingOpen: false,
    });
    expect(screen.getByRole('radio', { name: 'Closed' })).toHaveAttribute('aria-checked', 'true');
  });

  it('removes the number when the field is emptied', async () => {
    await mockStore.setSettings({
      ...(await mockStore.getSettings()),
      whatsappNumber: '61412345678',
    });
    await renderSettings();
    expect(number()).toHaveValue('+61 412 345 678');
    fireEvent.change(number(), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved');
    expect((await mockStore.getSettings()).whatsappNumber).toBeUndefined();
  });
});
