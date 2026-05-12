/* =========================================================
   Cloudflare Pages Function — /api/reg-lookup
   Two-tier vehicle lookup:
     1. DVLA Vehicle Enquiry Service (free, fast, returns
        make/year/fuel/colour but rarely model)
     2. DVSA MOT History API fallback (free with OAuth, fills
        in model when DVLA didn't)

   Env vars (Pages → Settings → Environment vars):
     DVLA_VES_KEY             — DVLA VES API key
     DVSA_MOT_CLIENT_ID       — DVSA app registration client ID
     DVSA_MOT_CLIENT_SECRET   — DVSA app registration client secret
     DVSA_MOT_API_KEY         — DVSA API key (separate from OAuth)
     DVSA_MOT_TOKEN_URL       — Microsoft Entra ID token endpoint

   The DVSA OAuth access_token is cached in module scope until 1 min
   before its expiry. Cloudflare reuses isolates across requests, so
   one token typically covers a few hundred lookups before refresh.

   Response shape (matches site/js/scrap.js expectations):
     200  { make, model, year, fuel, colour, source }
     400  { error }   reg too short
     404  { error }   reg not found
     500  { error }   upstream / parse error
     503  { error }   no DVLA_VES_KEY configured
   ========================================================= */

// ---- DVSA OAuth token cache (module scope = per isolate) ----
let cachedDvsaToken = null;   // { token, expiresAt }

async function getDvsaToken(env) {
  const now = Date.now();
  if (cachedDvsaToken && cachedDvsaToken.expiresAt > now + 60_000) {
    return cachedDvsaToken.token;
  }
  const form = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: env.DVSA_MOT_CLIENT_ID,
    client_secret: env.DVSA_MOT_CLIENT_SECRET,
    scope: 'https://tapi.dvsa.gov.uk/.default'
  });
  const r = await fetch(env.DVSA_MOT_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString()
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error('DVSA token fetch failed: ' + r.status + ' ' + t.slice(0, 200));
  }
  const j = await r.json();
  cachedDvsaToken = {
    token: j.access_token,
    expiresAt: now + ((j.expires_in || 3600) * 1000)
  };
  return cachedDvsaToken.token;
}

// Fetch model + extra detail from DVSA MOT History API.
// Returns null if not configured / not found / errors — never throws.
async function dvsaLookup(env, reg) {
  if (!env.DVSA_MOT_CLIENT_ID || !env.DVSA_MOT_CLIENT_SECRET ||
      !env.DVSA_MOT_API_KEY || !env.DVSA_MOT_TOKEN_URL) {
    return null;
  }
  try {
    const token = await getDvsaToken(env);
    const r = await fetch(
      'https://history.mot.api.gov.uk/v1/trade/vehicles/registration/' + encodeURIComponent(reg),
      {
        headers: {
          'Authorization': 'Bearer ' + token,
          'x-api-key': env.DVSA_MOT_API_KEY,
          'accept': 'application/json'
        }
      }
    );
    if (!r.ok) return null;          // 404 = unknown, anything else = silently degrade
    const j = await r.json();
    // The API has returned a single object or an array depending on whether
    // there are multiple vehicles for that reg. Normalise to the first hit.
    const v = Array.isArray(j) ? j[0] : j;
    if (!v || (!v.make && !v.model)) return null;
    return {
      make:   (v.make   || '').toUpperCase(),
      model:  (v.model  || '').toUpperCase(),
      fuel:   (v.fuelType || v.fuel_type || '').toUpperCase(),
      colour: (v.primaryColour || v.primary_colour || '').toUpperCase()
    };
  } catch (_) {
    return null;
  }
}

// Embedded fixtures — mirrors data/fixture-regs.json. Useful for demos
// (e.g. a journalist or potential customer trying the test reg) and as a
// safety net if DVLA is briefly unavailable. Kept tiny on purpose.
const FIXTURES = {
  'AB12CDE': { make: 'FORD',       model: 'FIESTA',   year: 2014, fuel: 'PETROL',   colour: 'BLUE'   },
  'BD18FGH': { make: 'VAUXHALL',   model: 'CORSA',    year: 2018, fuel: 'PETROL',   colour: 'WHITE'  },
  'CD15JKL': { make: 'FORD',       model: 'FOCUS',    year: 2015, fuel: 'DIESEL',   colour: 'SILVER' },
  'DE16MNO': { make: 'VOLKSWAGEN', model: 'GOLF',     year: 2016, fuel: 'DIESEL',   colour: 'GREY'   },
  'EF19PQR': { make: 'NISSAN',     model: 'QASHQAI',  year: 2019, fuel: 'PETROL',   colour: 'RED'    },
  'FG13STU': { make: 'FORD',       model: 'TRANSIT',  year: 2013, fuel: 'DIESEL',   colour: 'WHITE'  },
  'GH17VWX': { make: 'BMW',        model: '3 SERIES', year: 2017, fuel: 'DIESEL',   colour: 'BLACK'  },
  'HJ20YZA': { make: 'TESLA',      model: 'MODEL 3',  year: 2020, fuel: 'ELECTRIC', colour: 'WHITE'  },
  'SR16KPX': { make: 'IVECO',      model: 'DAILY',    year: 2016, fuel: 'DIESEL',   colour: 'WHITE'  }
};

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  // Lock down to same-origin — this endpoint isn't for third parties.
  'access-control-allow-origin': 'same-origin',
  'x-content-type-options': 'nosniff'
};

function normaliseReg(s) {
  return (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const reg = normaliseReg(url.searchParams.get('reg') || '');

  if (reg.length < 5) {
    return json({ error: "That doesn't look like a UK reg" }, 400);
  }

  // Fixture wins — covers our demo plates even in production
  if (FIXTURES[reg]) {
    return json({ ...FIXTURES[reg], source: 'fixture' });
  }

  const key = env && env.DVLA_VES_KEY;
  if (!key) {
    return json({ error: 'Reg lookup not configured' }, 503);
  }

  try {
    const upstream = await fetch(
      'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles',
      {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'content-type': 'application/json',
          'accept': 'application/json'
        },
        body: JSON.stringify({ registrationNumber: reg })
      }
    );

    const j = await upstream.json().catch(() => ({}));

    if (!upstream.ok || (j && j.errors)) {
      const msg = (j.errors && j.errors[0] && j.errors[0].title)
        || `Lookup failed (${upstream.status})`;
      return json({ error: msg }, upstream.status === 404 ? 404 : 502);
    }

    const result = {
      make:   j.make || '',
      model:  j.model || '',                 // VES rarely returns model
      year:   parseInt(j.yearOfManufacture, 10) || null,
      fuel:   j.fuelType || '',
      colour: j.colour || '',
      source: 'dvla-ves'
    };

    // If DVLA didn't give us a model, fall back to DVSA MOT history. We only
    // bother when the model is missing because DVSA's a slower path (OAuth
    // + separate fetch) and the make-only is enough for ~half our scrap
    // quotes anyway.
    if (!result.model) {
      const extra = await dvsaLookup(env, reg);
      if (extra) {
        if (extra.model)  result.model  = extra.model;
        if (!result.fuel   && extra.fuel)   result.fuel   = extra.fuel;
        if (!result.colour && extra.colour) result.colour = extra.colour;
        result.source = 'dvla-ves+dvsa-mot';
      }
    }

    return json(result);
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 500);
  }
}

// Allow CORS preflight to noop cleanly (browsers shouldn't preflight a
// same-origin GET, but some proxies do).
export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'content-type'
    }
  });
}
