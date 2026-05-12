/* =========================================================
   Big Ben's Towing — quote calculator (postcode + GPS edition)
   Formula: per-mile rate × (base→pickup + pickup→dropoff + dropoff→base).
   The rate itself is held in a private constant below and is not
   surfaced to the customer — they only see the final figure.

   Distance source:
     - Postcode → lat/lng via api.postcodes.io (free, no key, CORS-OK)
     - Live location via the browser Geolocation API
     - Distance computed by Haversine × ROAD_FACTOR (≈ road miles)

   When postcodes.io is down, we fall back to a "ring us" prompt
   so the customer is never blocked.
   ========================================================= */
(function () {
  // Internal rate — never displayed to the customer. They see only the
  // final quote. The figure is given on Ben's rate sheet (kept private).
  var RATE_PER_MILE = 1.75;
  var ROAD_FACTOR   = 1.4;         // crow → road approximation (UK)
  var URGENT_UPLIFT = 0.20;        // +20% priority callout
  var CLASSIC_UPLIFT= 0.15;        // +15% specialist handling
  var MIN_CHARGE    = 40;          // £ minimum for any local job

  // Big Ben's depot — DH3 4HU, Great Lumley, County Durham.
  // Coords from postcodes.io (lat 54.838030, lng -1.545536).
  var BASE = {
    lat: 54.838030,
    lng: -1.545536,
    label: 'Base (DH3 4HU)'
  };

  var pickupInput  = document.getElementById('pickup');
  var dropoffInput = document.getElementById('dropoff');
  var resultBox    = document.getElementById('quoteResult');
  var form         = document.getElementById('quoteForm');
  var locateBtn    = document.getElementById('useMyLocation');
  var pickupHelp   = document.getElementById('pickupHelp');
  var photoInput   = document.getElementById('photo');
  var photoPreview = document.getElementById('photoPreview');
  var photoClear   = document.getElementById('photoClear');

  // ---------- Photo picker + compress ----------------------------------------
  // Photos straight from a phone camera can be 4-8MB. We canvas-compress to
  // ~1200px on the long edge / quality 0.78, which usually lands in 200-400KB
  // — plenty for Ben to spot the damage, light enough for slow signal.
  if (photoInput) {
    photoInput.addEventListener('change', function () {
      var f = photoInput.files && photoInput.files[0];
      window.__quotePhoto = f || null;
      if (!f) { photoPreview.style.display = 'none'; return; }
      var img = photoPreview.querySelector('img');
      img.src = URL.createObjectURL(f);
      photoPreview.style.display = 'block';
    });
  }
  if (photoClear) {
    photoClear.addEventListener('click', function () {
      photoInput.value = '';
      window.__quotePhoto = null;
      photoPreview.style.display = 'none';
    });
  }

  function compressImage(file, maxEdge, quality) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        try {
          var w = img.naturalWidth, h = img.naturalHeight;
          var scale = Math.min(1, maxEdge / Math.max(w, h));
          var canvas = document.createElement('canvas');
          canvas.width  = Math.round(w * scale);
          canvas.height = Math.round(h * scale);
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(function (blob) {
            URL.revokeObjectURL(img.src);
            if (!blob) return reject(new Error('encode failed'));
            resolve(new File([blob], 'roadside.jpg', { type: 'image/jpeg' }));
          }, 'image/jpeg', quality);
        } catch (e) { reject(e); }
      };
      img.onerror = function () { reject(new Error('image load failed')); };
      img.src = URL.createObjectURL(file);
    });
  }

  function compressAndUploadPhoto(file) {
    return compressImage(file, 1200, 0.78).then(function (small) {
      var fd = new FormData();
      fd.append('photo', small);
      return fetch('/api/upload-photo', { method: 'POST', body: fd })
        .then(function (r) {
          if (!r.ok) return null;
          return r.json().then(function (j) { return j.url || null; });
        })
        .catch(function () { return null; });
    });
  }

  // Track when the pickup field is fed by GPS rather than typing — that lets us
  // show a friendly "Your current location" label in the result instead of a
  // postcode the user never typed.
  var pickupOverride = null;       // { lat, lng, label } or null

  // Reset the GPS override the moment the user starts typing in pickup.
  pickupInput.addEventListener('input', function () {
    pickupOverride = null;
    pickupHelp.textContent = "Where the vehicle is now. Tap the pin if you're at the roadside.";
    pickupHelp.style.color = '';
  });

  // ---------- Use my location ------------------------------------------------
  locateBtn.addEventListener('click', function () {
    if (!('geolocation' in navigator)) {
      pickupHelp.textContent = "Sorry — your browser can't share location. Type a postcode instead.";
      pickupHelp.style.color = '#ffb86b';
      return;
    }
    pickupHelp.textContent = 'Getting your location…';
    pickupHelp.style.color = '#ffb86b';
    locateBtn.disabled = true;

    navigator.geolocation.getCurrentPosition(
      function (pos) {
        var lat = pos.coords.latitude;
        var lng = pos.coords.longitude;
        // Reverse-look up to a nearby postcode for the label (and so we can
        // show the customer something recognisable).
        fetch('https://api.postcodes.io/postcodes?lat=' + lat + '&lon=' + lng + '&limit=1')
          .then(function (r) { return r.json(); })
          .then(function (j) {
            var nearest = (j && j.result && j.result[0]) ? j.result[0] : null;
            var label = nearest ? ('Your location (~' + nearest.postcode + ')') : 'Your current location';
            pickupOverride = { lat: lat, lng: lng, label: label };
            pickupInput.value = nearest ? nearest.postcode : 'My location';
            pickupHelp.textContent = '✓ Pinned to ' + label;
            pickupHelp.style.color = '#5cdb71';
          })
          .catch(function () {
            pickupOverride = { lat: lat, lng: lng, label: 'Your current location' };
            pickupInput.value = 'My location';
            pickupHelp.textContent = '✓ Got your location.';
            pickupHelp.style.color = '#5cdb71';
          })
          .finally(function () { locateBtn.disabled = false; });
      },
      function (err) {
        var msg = 'Could not get your location.';
        if (err && err.code === 1) msg = 'Permission denied — type a postcode instead.';
        if (err && err.code === 3) msg = 'Location timed out — try again or type a postcode.';
        pickupHelp.textContent = msg;
        pickupHelp.style.color = '#ff6b6b';
        locateBtn.disabled = false;
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });

  // ---------- Postcode lookup ------------------------------------------------
  function normalisePostcode(raw) {
    return raw.replace(/\s+/g, '').toUpperCase();
  }
  // Loose UK postcode pattern (matches all real-world formats)
  var POSTCODE_RE = /^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$/;

  function lookupPostcode(raw) {
    var pc = normalisePostcode(raw);
    if (!POSTCODE_RE.test(pc)) {
      return Promise.reject(new Error('"' + raw + '" doesn\'t look like a UK postcode'));
    }
    return fetch('https://api.postcodes.io/postcodes/' + encodeURIComponent(pc))
      .then(function (r) {
        if (r.status === 404) {
          throw new Error('Postcode "' + raw + '" not found — please double-check.');
        }
        if (!r.ok) throw new Error('Postcode lookup failed (' + r.status + '). Please try again.');
        return r.json();
      })
      .then(function (j) {
        if (!j || !j.result) throw new Error('Postcode lookup returned no result.');
        return {
          lat: j.result.latitude,
          lng: j.result.longitude,
          label: j.result.postcode
        };
      });
  }

  // ---------- Distance -------------------------------------------------------
  function haversineMiles(a, b) {
    var R = 3958.8; // Earth radius in miles
    var toRad = function (x) { return x * Math.PI / 180; };
    var dLat = toRad(b.lat - a.lat);
    var dLng = toRad(b.lng - a.lng);
    var lat1 = toRad(a.lat);
    var lat2 = toRad(b.lat);
    var h = Math.sin(dLat/2)*Math.sin(dLat/2) +
            Math.sin(dLng/2)*Math.sin(dLng/2) * Math.cos(lat1) * Math.cos(lat2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function roadMiles(a, b) {
    return Math.max(1, Math.round(haversineMiles(a, b) * ROAD_FACTOR));
  }

  // ---------- Formatting -----------------------------------------------------
  function fmtGBP(n) {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
  }

  function showError(msg) {
    resultBox.style.display = 'block';
    resultBox.innerHTML =
      '<div class="quote-result" style="background:linear-gradient(135deg, #ff8a8a, #ffd0d0); color:#000;">' +
        '<h3>Couldn\'t generate a quote</h3>' +
        '<p style="margin:0 0 10px;">' + escapeHtml(msg) + '</p>' +
        '<p style="margin:0 0 14px;">Best to give us a quick call — we\'ll quote on the spot:</p>' +
        '<a class="btn danger btn-call" href="tel:+447754984147">Call 07754 984 147</a>' +
      '</div>';
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c];
    });
  }

  // ---------- Pay deposit ----------------------------------------------------
  // POSTs the booking details to /api/checkout/deposit. The server creates a
  // Stripe Checkout Session for £50 and returns the URL — we redirect.
  // If Stripe isn't configured yet (no STRIPE_SECRET_KEY), the server returns
  // 503 and we fall back to a "Call to book" message.
  function payDepositClick(e) {
    var btn = e.currentTarget;
    var booking;
    try { booking = JSON.parse(btn.getAttribute('data-booking')); }
    catch (_) { booking = null; }
    if (!booking) { showError('Could not read your quote — please refresh and try again.'); return; }

    var origLabel = btn.textContent;
    btn.textContent = 'Opening secure payment…';
    btn.disabled = true;

    // If the customer attached a photo, upload it first. The returned URL
    // gets added to the booking metadata so it shows up in Ben's email and
    // the admin dashboard. Failures are non-blocking — we'd rather have a
    // booking without a photo than no booking.
    var photoFile = window.__quotePhoto;       // set by the picker, see below
    var uploadStep = photoFile
      ? compressAndUploadPhoto(photoFile).then(function (url) {
          if (url) booking.photoUrl = url;
        }).catch(function () { /* silent */ })
      : Promise.resolve();

    uploadStep.then(function () {
      return fetch('/api/checkout-deposit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(booking)
      });
    })
      .then(function (r) {
        return r.json().then(function (j) { return { ok: r.ok, body: j }; });
      })
      .then(function (resp) {
        if (resp.ok && resp.body.url) {
          // Hand off to Stripe-hosted checkout.
          window.location.href = resp.body.url;
        } else if (!resp.ok && resp.body && resp.body.error === 'stripe_not_configured') {
          // Big Ben hasn't opened the Stripe account yet — gracefully degrade.
          showError(
            "Card payment isn't switched on yet. Give us a quick call on " +
            "07754 984 147 and we'll lock the booking in straight away."
          );
        } else {
          showError(
            (resp.body && resp.body.error) ||
            'Could not start the payment. Please call us on 07754 984 147.'
          );
        }
      })
      .catch(function () {
        showError('Network problem starting the payment. Please call us on 07754 984 147.');
      })
      .finally(function () {
        btn.textContent = origLabel;
        btn.disabled = false;
      });
  }

  // ---------- Submit ---------------------------------------------------------
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    // Resolve pickup: either GPS override or postcode lookup
    var pickupPromise = pickupOverride
      ? Promise.resolve(pickupOverride)
      : lookupPostcode(pickupInput.value);

    var dropoffPromise = lookupPostcode(dropoffInput.value);

    // Submitting state
    var submitBtn = form.querySelector('button[type=submit]');
    var origLabel = submitBtn.textContent;
    submitBtn.textContent = 'Calculating…';
    submitBtn.disabled = true;

    Promise.all([pickupPromise, dropoffPromise])
      .then(function (results) {
        var p = results[0];
        var d = results[1];

        var basToP = roadMiles(BASE, p);
        var pToD   = roadMiles(p, d);
        var dToBas = roadMiles(d, BASE);
        var totalMiles = basToP + pToD + dToBas;
        var price  = totalMiles * RATE_PER_MILE;

        var vtype = document.getElementById('vtype').value;
        var when  = document.getElementById('when').value;
        var upliftPct = 0;
        if (when === 'urgent')   upliftPct += URGENT_UPLIFT;
        if (vtype === 'classic') upliftPct += CLASSIC_UPLIFT;
        var uplift = price * upliftPct;
        var grand  = price + uplift;
        grand = Math.round(grand);
        if (grand < MIN_CHARGE) grand = MIN_CHARGE;

        // Deposit policy: standard £50, BUT for a small job where the total
        // is £50 or less, just take the full amount up-front (otherwise we'd
        // ask for more than the job cost). When deposit==total, balance is
        // £0 and the customer never sees a "balance owed" line.
        var STANDARD_DEPOSIT = 50;
        var deposit    = Math.min(STANDARD_DEPOSIT, grand);
        var balanceDue = Math.max(0, grand - deposit);
        var payInFull  = balanceDue === 0;

        var bookingPayload = {
          pickup: p.label, dropoff: d.label,
          totalMiles: totalMiles, total: grand,
          deposit: deposit, balance: balanceDue,
          vehicleType: vtype, when: when
        };

        // ---- Deposit summary box: two slightly different shapes ----
        var depositBoxHtml;
        if (payInFull) {
          depositBoxHtml =
            '<div class="deposit-box">' +
              '<div class="deposit-line"><span>Pay now to lock in</span><strong>' + fmtGBP(deposit) + ' (full amount)</strong></div>' +
              '<p class="deposit-note">Job\'s short enough that we\'ll take it in one go — no balance to chase later. Fully refundable if we can\'t do the job; just give us a ring.</p>' +
            '</div>';
        } else {
          depositBoxHtml =
            '<div class="deposit-box">' +
              '<div class="deposit-line"><span>Pay now to lock in</span><strong>' + fmtGBP(deposit) + ' deposit</strong></div>' +
              '<div class="deposit-line muted"><span>Balance on drop-off</span><strong>' + fmtGBP(balanceDue) + '</strong></div>' +
              '<p class="deposit-note">Pay the balance in cash on drop-off, or by card via the website later. Deposit is fully refundable if we can\'t do the job — just give us a ring.</p>' +
            '</div>';
        }

        var ctaLabel = payInFull
          ? 'Accept &amp; Pay ' + fmtGBP(deposit) + ' Now &rarr;'
          : 'Accept &amp; Pay ' + fmtGBP(deposit) + ' Deposit &rarr;';

        var html =
          '<div class="quote-result">' +
            '<h3>Your indicative quote</h3>' +
            '<div class="price">' + fmtGBP(grand) + '</div>' +
            '<p style="margin:6px 0 0; color:#000;"><strong>' + escapeHtml(p.label) + '</strong> &rarr; <strong>' + escapeHtml(d.label) + '</strong> · ' + totalMiles + ' miles round-trip</p>' +
            '<div class="breakdown">' +
              '<div><span>' + escapeHtml(BASE.label) + ' → ' + escapeHtml(p.label) + '</span><span>' + basToP + ' mi</span></div>' +
              '<div><span>' + escapeHtml(p.label) + ' → ' + escapeHtml(d.label) + '</span><span>' + pToD + ' mi</span></div>' +
              '<div><span>' + escapeHtml(d.label) + ' → ' + escapeHtml(BASE.label) + '</span><span>' + dToBas + ' mi</span></div>' +
              (upliftPct > 0
                ? '<div style="border-top:1px dashed rgba(0,0,0,.3); padding-top:6px;"><span>Includes priority/specialist surcharge</span><span></span></div>'
                : '') +
            '</div>' +

            depositBoxHtml +

            '<div class="quote-cta">' +
              '<button type="button" class="btn primary btn-pay-deposit" data-booking=\'' + escapeHtml(JSON.stringify(bookingPayload)) + '\'>' + ctaLabel + '</button>' +
              '<a class="btn danger btn-call" href="tel:+447754984147">Or call — 07754 984 147</a>' +
              '<a class="btn secondary" href="contact?pickup=' + encodeURIComponent(p.label) + '&dropoff=' + encodeURIComponent(d.label) + '&estimate=' + grand + '">Send by message</a>' +
            '</div>' +

            '<p style="margin:14px 0 0; color:#000; font-size:.88rem;"><em>Indicative only — final price confirmed by phone. £' + MIN_CHARGE + ' minimum on local jobs.</em></p>' +
          '</div>';

        resultBox.innerHTML = html;
        resultBox.style.display = 'block';
        resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Wire up the "Pay deposit" button just rendered.
        var payBtn = resultBox.querySelector('.btn-pay-deposit');
        if (payBtn) payBtn.addEventListener('click', payDepositClick);
      })
      .catch(function (err) {
        showError(err && err.message ? err.message : 'Something went wrong looking up that postcode.');
      })
      .finally(function () {
        submitBtn.textContent = origLabel;
        submitBtn.disabled = false;
      });
  });
})();
