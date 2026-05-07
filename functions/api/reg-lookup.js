/* =========================================================
   Cloudflare Pages Function — /api/reg-lookup
   Mirrors the local mock in scripts/serve.js so the scrap
   calculator works identically in dev and prod.

   Deployment notes:
     • This file is auto-routed by Cloudflare Pages because of
       its location: /functions/api/reg-lookup.js → /api/reg-lookup
     • In the Pages dashboard, set environment variable:
         DVLA_VES_KEY = <key from
           https://developer-portal.driver-vehicle-licensing.api.gov.uk/>
     • Optional: DVSA_MOT_KEY for richer model data (not used yet).

   Response shape (matches site/js/scrap.js expectations):
     200  { make, model, year, fuel, colour, source }
     400  { error }   reg too short
     404  { error }   reg not found
     500  { error }   upstream / parse error
     503  { error }   no DVLA_VES_KEY configured
   ========================================================= */

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

    return json({
      make:   j.make || '',
      model:  j.model || '',                 // VES rarely returns model
      year:   parseInt(j.yearOfManufacture, 10) || null,
      fuel:   j.fuelType || '',
      colour: j.colour || '',
      source: 'dvla-ves'
    });
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
