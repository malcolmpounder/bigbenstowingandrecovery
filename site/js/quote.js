/* =========================================================
   Big Ben's Towing — quote calculator
   Formula: £1.75 × (base→pickup + pickup→dropoff + dropoff→base)

   Distance source today: pre-baked town distances in data/areas.json
   (good enough for quoting; we never quote a real job without phoning)
   pickup→dropoff is approximated via Haversine × 1.3 road factor.

   Production: swap the resolveDistance() function to call
   /api/distance (Cloudflare Pages Function → Google Distance Matrix)
   without changing any other code in this file.
   ========================================================= */
(function () {
  var RATE_PER_MILE = 1.75;       // £/mile
  var ROAD_FACTOR   = 1.3;        // crow → road approximation
  var URGENT_UPLIFT = 0.20;       // +20% priority callout
  var CLASSIC_UPLIFT= 0.15;       // +15% specialist handling

  var pickupSel  = document.getElementById('pickup');
  var dropoffSel = document.getElementById('dropoff');
  var resultBox  = document.getElementById('quoteResult');
  var form       = document.getElementById('quoteForm');
  var DATA       = null;

  fetch('data/areas.json')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      DATA = d;
      d.areas
        .slice()
        .sort(function (a, b) { return a.name.localeCompare(b.name); })
        .forEach(function (a) {
          var label = a.name + ' (' + a.postcode + ')';
          pickupSel.add(new Option(label, a.slug));
          dropoffSel.add(new Option(label, a.slug));
        });
      // Trailing "other" option
      pickupSel.add(new Option('Somewhere else (call us)', '__other'));
      dropoffSel.add(new Option('Somewhere else (call us)', '__other'));
    });

  function find(slug) {
    if (!DATA) return null;
    return DATA.areas.find(function (a) { return a.slug === slug; });
  }

  // Haversine distance in miles
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

  // base→loc and loc→loc distances. Returns { base_to_pickup, pickup_to_dropoff, dropoff_to_base }
  function resolveDistance(pickupSlug, dropoffSlug) {
    var p = find(pickupSlug);
    var d = find(dropoffSlug);
    var base = DATA.base;
    return {
      base_to_pickup    : p ? p.miles : null,
      pickup_to_dropoff : (p && d) ? Math.round(haversineMiles(p, d) * ROAD_FACTOR) : null,
      dropoff_to_base   : d ? d.miles : null
    };
  }

  function fmtGBP(n) {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var pSlug = pickupSel.value;
    var dSlug = dropoffSel.value;

    if (!pSlug || !dSlug) { return; }

    if (pSlug === '__other' || dSlug === '__other') {
      resultBox.style.display = 'block';
      resultBox.innerHTML =
        '<div class="quote-result" style="background:linear-gradient(135deg, var(--yellow), #ffe07a); color:#000;">' +
          '<h3>Outside our standard area list</h3>' +
          '<p style="margin:0 0 10px;">No problem — we cover the whole UK for transport jobs. Give us a quick call and we\'ll work out the exact mileage and price for you.</p>' +
          '<a class="btn danger btn-call" href="tel:+447754984147">Call 07754 984 147</a>' +
        '</div>';
      resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    var dist = resolveDistance(pSlug, dSlug);
    var totalMiles = dist.base_to_pickup + dist.pickup_to_dropoff + dist.dropoff_to_base;
    var price = totalMiles * RATE_PER_MILE;

    var vtype = document.getElementById('vtype').value;
    var when  = document.getElementById('when').value;
    var upliftPct = 0;
    if (when === 'urgent')   upliftPct += URGENT_UPLIFT;
    if (vtype === 'classic') upliftPct += CLASSIC_UPLIFT;
    var uplift = price * upliftPct;
    var grand  = price + uplift;
    // Round to whole pounds for cleanliness
    grand = Math.round(grand);
    // Minimum charge of £40 for any local job
    if (grand < 40) grand = 40;

    var p = find(pSlug);
    var d = find(dSlug);

    var html =
      '<div class="quote-result">' +
        '<h3>Your indicative quote</h3>' +
        '<div class="price">' + fmtGBP(grand) + '</div>' +
        '<p style="margin:6px 0 0; color:#000;"><strong>' + p.name + '</strong> &rarr; <strong>' + d.name + '</strong> · ' + totalMiles + ' miles round-trip · ' + fmtGBP(RATE_PER_MILE) + '/mile</p>' +
        '<div class="breakdown">' +
          '<div><span>Base (DH3 4HU) → ' + p.name + '</span><span>' + dist.base_to_pickup + ' mi</span></div>' +
          '<div><span>' + p.name + ' → ' + d.name + '</span><span>' + dist.pickup_to_dropoff + ' mi</span></div>' +
          '<div><span>' + d.name + ' → Base</span><span>' + dist.dropoff_to_base + ' mi</span></div>' +
          '<div style="border-top:1px dashed rgba(0,0,0,.3); padding-top:6px; font-weight:700;"><span>Total mileage</span><span>' + totalMiles + ' mi</span></div>' +
          '<div><span>Mileage charge</span><span>' + fmtGBP(price) + '</span></div>' +
          (upliftPct > 0
            ? '<div><span>Surcharge (' + Math.round(upliftPct*100) + '%)</span><span>' + fmtGBP(uplift) + '</span></div>'
            : '') +
        '</div>' +
        '<p style="margin:0 0 14px; color:#000; font-size:.92rem;"><em>Indicative only — final price confirmed by phone. £40 minimum on local jobs.</em></p>' +
        '<a class="btn danger btn-call" href="tel:+447754984147">Call to book — 07754 984 147</a>' +
        ' &nbsp; ' +
        '<a class="btn secondary" href="contact.html?pickup=' + encodeURIComponent(p.name) + '&dropoff=' + encodeURIComponent(d.name) + '&estimate=' + grand + '">Send by message instead</a>' +
      '</div>';

    resultBox.innerHTML = html;
    resultBox.style.display = 'block';
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
})();
