import { BrowserContext } from '@playwright/test';

type PersistedQuote = {
  id: string;
  quote_number: string;
  title?: string;
  status?: string;
  account_id?: string | null;
  sell_price?: number;
  created_at: string;
  updated_at: string;
};

type MockState = {
  savedQuotes: PersistedQuote[];
};

const defaultLocations = [
  {
    id: 'c3f0574e-c0dd-4d7d-8e1f-7bc4f6ebf001',
    location_name: 'Shanghai',
    location_code: 'CNSHA',
    location_type: 'port',
    country: 'China',
    city: 'Shanghai',
  },
  {
    id: 'd22fa7b7-d915-4f9d-89f0-4f9c9ff32002',
    location_name: 'New York',
    location_code: 'USNYC',
    location_type: 'port',
    country: 'United States',
    city: 'New York',
  },
];

const defaultCarriers = [
  { id: 'carrier-1', carrier_name: 'Maersk', carrier_type: 'ocean', tenant_id: 'tenant-1' },
  { id: 'carrier-2', carrier_name: 'CMA CGM', carrier_type: 'ocean', tenant_id: 'tenant-1' },
];

const defaultIncoterms = [
  { id: 'inc-1', incoterm_code: 'FOB', incoterm_name: 'Free On Board' },
  { id: 'inc-2', incoterm_code: 'CIF', incoterm_name: 'Cost Insurance and Freight' },
];

const asJson = (body: unknown) => JSON.stringify(body);

const readBody = async (payload: string | null) => {
  if (!payload) return {};
  try {
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return {};
  }
};

export const setupQuotationApiMocks = async (context: BrowserContext) => {
  const state: MockState = { savedQuotes: [] };

  await context.route('**/auth/v1/token*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: asJson({
        access_token: 'mock-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock-refresh-token',
        user: {
          id: 'mock-user-1',
          email: 'admin@example.com',
          aud: 'authenticated',
          role: 'authenticated',
        },
      }),
    });
  });

  await context.route('**/auth/v1/user', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: asJson({
        id: 'mock-user-1',
        email: 'admin@example.com',
        app_metadata: { provider: 'email', role: 'tenant_admin' },
        user_metadata: { full_name: 'Mock Admin' },
      }),
    });
  });

  await context.route('**/auth/v1/logout', async (route) => {
    await route.fulfill({ status: 204, body: '' });
  });

  await context.route('**/rest/v1/system_settings*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: asJson([{ setting_key: 'standalone_quote_mode_enabled', setting_value: true }]),
    });
  });

  await context.route('**/rest/v1/ports_locations*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: asJson(defaultLocations) });
  });

  await context.route('**/rest/v1/carriers*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: asJson(defaultCarriers) });
  });

  await context.route('**/rest/v1/incoterms*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: asJson(defaultIncoterms) });
  });

  await context.route('**/rest/v1/accounts*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: asJson([{ id: 'acc-1', name: 'Acme Logistics' }]),
    });
  });

  await context.route('**/rest/v1/contacts*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: asJson([{ id: 'con-1', account_id: 'acc-1', first_name: 'Rita', last_name: 'Buyer' }]),
    });
  });

  await context.route('**/rest/v1/opportunities*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: asJson([{ id: 'opp-1', name: 'Q2 Logistics Expansion', account_id: 'acc-1', contact_id: 'con-1' }]),
    });
  });

  await context.route('**/rest/v1/rpc/search_locations', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: asJson(defaultLocations) });
  });

  await context.route('**/rest/v1/rpc/save_quote_atomic', async (route) => {
    const body = await readBody(route.request().postData());
    const quote_number = `QUO-PW-${String(state.savedQuotes.length + 1).padStart(5, '0')}`;
    const now = new Date().toISOString();
    const quote: PersistedQuote = {
      id: `mock-quote-${state.savedQuotes.length + 1}`,
      quote_number,
      title: String(body.quote_title || body.title || 'Playwright Quote'),
      status: 'draft',
      account_id: (body.account_id as string | null | undefined) ?? null,
      sell_price: Number(body.sell_price || body.total_sell || 0),
      created_at: now,
      updated_at: now,
    };
    state.savedQuotes.push(quote);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: asJson({
        success: true,
        quote_id: quote.id,
        version_id: `${quote.id}-v1`,
      }),
    });
  });

  await context.route('**/rest/v1/quotes*', async (route) => {
    if (route.request().method() === 'DELETE') {
      const url = new URL(route.request().url());
      const id = url.searchParams.get('id');
      if (id) {
        const idValue = id.replace(/^eq\./, '');
        state.savedQuotes = state.savedQuotes.filter((quote) => quote.id !== idValue);
      }
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: asJson(
        state.savedQuotes.length > 0
          ? state.savedQuotes
          : [
              {
                id: 'seed-quote-1',
                quote_number: 'QUO-PW-00000',
                title: 'Seed quotation',
                status: 'draft',
                account_id: 'acc-1',
                sell_price: 1200,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
      ),
    });
  });

  await context.route('**/functions/v1/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: asJson({ ok: true }) });
  });

  await context.route('**/rest/v1/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: asJson([]) });
  });

  return state;
};
