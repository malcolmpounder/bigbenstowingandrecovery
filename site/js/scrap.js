/* =========================================================
   Big Ben's Towing — scrap-car offer calculator
   Logic:
     EMR offer (indicative)  = vehicle_tonnes × £/tonne × condition_multiplier + cat_bonus
     Recovery cost            = (base→pickup + pickup→EMR Sunderland + EMR→base) × £1.75
     Customer net             = max(EMR offer − recovery cost, MIN_PAYOUT)

   £/tonne is editable here in EMR_RATE_PER_TONNE — Big Ben updates it
   when EMR changes their rate (no code changes elsewhere needed).
   EMR Sunderland location: Pallion industrial estate, ~SR4.
   ========================================================= */
(function () {
  // === Tunables — Big Ben edits these as the market moves =====
  var EMR_RATE_PER_TONNE   = 270;    // £/tonne — UK avg in 2026
  var RECOVERY_PER_MILE    = 1.75;   // £/mile — same as recovery quote
  var MIN_PAYOUT           = 30;     // £ minimum we'll pay even on tiny jobs
  // EMR Sunderland — Pallion (approximate centroid for distance calc)
  var EMR_SUNDERLAND       = { name: 'EMR Sunderland', lat: 54.9080, lng: -1.4080, miles_from_base: 13 };
  var ROAD_FACTOR          = 1.3;
  // ============================================================

  var pickupSel = document.getElementById('pickup');
  var resultBox = document.getElementById('scrapResult');
  var form      = document.getElementById('scrapForm');
  var regInput  = document.getElementById('reg');
  var regBtn    = document.getElementById('regLookupBtn');
  var regStatus = document.getElementById('regStatus');
  var vclassSel = document.getElementById('vclass');
  var vmodelInp = document.getElementById('vmodel');
  var DATA      = null;
  var WEIGHTS   = null;

  // Load the weight lookup table
  fetch('data/weights.json').then(function (r) { return r.json(); }).then(function (w) { WEIGHTS = w; });

  fetch('data/areas.json')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      DATA = d;
      d.areas
        .slice()
        .sort(function (a, b) { return a.name.localeCompare(b.name); })
        .forEach(function (a) {
          pickupSel.add(new Option(a.name + ' (' + a.postcode + ')', a.slug));
        });
      pickupSel.add(new Option('Somewhere else (call us)', '__other'));
    });

  function find(slug) {
    if (!DATA) return null;
    return DATA.areas.find(function (a) { return a.slug === slug; });
  }
  function haversineMiles(a, b) {
    var R = 3958.8, toRad = function (x) { return x * Math.PI / 180; };
    var dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    var lat1 = toRad(a.lat), lat2 = toRad(b.lat);
    var h = Math.sin(dLat/2)*Math.sin(dLat/2) +
            Math.sin(dLng/2)*Math.sin(dLng/2)*Math.cos(lat1)*Math.cos(lat2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function fmtGBP(n) {
    return new Intl.NumberFormat('en-GB', { style:'currency', currency:'GBP', maximumFractionDigits: 0 }).format(n);
  }

  // ============ Reg lookup ============
  function normaliseReg(s) {
    return (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
  function classifyVehicle(make, model) {
    if (!WEIGHTS) return null;
    var key = ((make || '') + ' ' + (model || '')).toUpperCase().trim();
    // Most-specific-first: longest match wins
    var matches = WEIGHTS.vehicles
      .filter(function (v) { return key.indexOf(v.match) === 0 || key.indexOf(' ' + v.match) >= 0 || key === v.match; })
      .sort(function (a, b) { return b.match.length - a.match.length; });
    return matches[0] || null;
  }
  function setStatus(msg, kind) {
    // kind: 'ok' | 'warn' | 'err' | 'info'
    var colours = {
      ok:   { bg: '#1f3d1f', fg: '#a4d965', border: '#6dba2c' },
      warn: { bg: '#3d3217', fg: '#ffd54a', border: '#ffc20e' },
      err:  { bg: '#3d1f1f', fg: '#ff8088', border: '#e63946' },
      info: { bg: 'transparent', fg: '#9b9b9b', border: 'transparent' }
    }[kind || 'info'];
    regStatus.style.cssText = 'min-height:18px;margin-top:6px;padding:6px 10px;border-radius:4px;border-left:3px solid ' + colours.border + ';background:' + colours.bg + ';color:' + colours.fg + ';font-size:.9rem;';
    regStatus.textContent = msg;
  }

  function doLookup() {
    var reg = normaliseReg(regInput.value);
    if (reg.length < 5) {
      setStatus("That doesn't look like a UK reg — give it another go.", 'warn');
      return;
    }
    setStatus('Looking up ' + reg + '…', 'info');
    regBtn.disabled = true;

    fetch('/api/reg-lookup?reg=' + encodeURIComponent(reg))
      .then(function (r) {
        if (!r.ok) throw new Error('lookup failed (' + r.status + ')');
        return r.json();
      })
      .then(function (v) {
        // v = { make, model, year, fuel, colour, source }
        if (vmodelInp) vmodelInp.value = [v.year, v.make, v.model].filter(Boolean).join(' ');
        var match = classifyVehicle(v.make, v.model);
        if (match) {
          // Find the option whose value matches the class
          for (var i = 0; i < vclassSel.options.length; i++) {
            if (vclassSel.options[i].value === match.class) {
              vclassSel.selectedIndex = i;
              break;
            }
          }
          setStatus('Found: ' + (v.year ? v.year + ' ' : '') + v.make + ' ' + (v.model || '') + ' — class set to ' + vclassSel.options[vclassSel.selectedIndex].textContent.split(' (')[0].toLowerCase() + '. Adjust if needed.', 'ok');
        } else {
          setStatus('Found ' + v.make + ' ' + (v.model || '') + ' — please pick a vehicle class below.', 'warn');
        }
      })
      .catch(function (e) {
        setStatus("Couldn't find that reg — please pick a vehicle class below. (We can confirm by phone.)", 'err');
      })
      .finally(function () { regBtn.disabled = false; });
  }
  regBtn.addEventListener('click', doLookup);
  regInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); doLookup(); }
  });
  regInput.addEventListener('blur', function () {
    if (regInput.value.length >= 5 && !vclassSel.value) doLookup();
  });
  // ============ /Reg lookup ============

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var pickupSlug = pickupSel.value;
    if (!pickupSlug) return;

    if (pickupSlug === '__other') {
      resultBox.style.display = 'block';
      resultBox.innerHTML =
        '<div class="quote-result" style="background:linear-gradient(135deg, var(--yellow), #ffe07a); color:#000;">' +
          '<h3>Outside our standard collection list</h3>' +
          '<p style="margin:0 0 10px;">No problem — give us a quick call and we\'ll quote your collection cost on the spot.</p>' +
          '<a class="btn danger btn-call" href="tel:+447754984147">Call 07754 984 147</a>' +
        '</div>';
      resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    var vclassEl  = document.getElementById('vclass');
    var condEl    = document.getElementById('condition');
    var catEl     = document.getElementById('cat');
    if (!vclassEl.value) return;

    var tonnes    = parseFloat(vclassEl.options[vclassEl.selectedIndex].dataset.tonnes);
    var condMult  = parseFloat(condEl.options[condEl.selectedIndex].dataset.mult);
    var catBonus  = parseFloat(catEl.options[catEl.selectedIndex].dataset.bonus) || 0;

    var emrOffer  = (tonnes * EMR_RATE_PER_TONNE * condMult) + catBonus;

    var pickup = find(pickupSlug);
    // Round trip: base → pickup → EMR → base
    var miBaseToPickup = pickup.miles;
    var miPickupToEmr  = Math.round(haversineMiles(pickup, EMR_SUNDERLAND) * ROAD_FACTOR);
    var miEmrToBase    = EMR_SUNDERLAND.miles_from_base;
    var totalMiles     = miBaseToPickup + miPickupToEmr + miEmrToBase;
    var recoveryCost   = totalMiles * RECOVERY_PER_MILE;

    var net = emrOffer - recoveryCost;
    if (net < MIN_PAYOUT) net = MIN_PAYOUT;
    net = Math.round(net);

    var positive = (emrOffer - recoveryCost) > MIN_PAYOUT;

    var html =
      '<div class="quote-result ' + (positive ? 'scrap-positive' : 'scrap-negative') + '">' +
        '<h3>Your indicative offer</h3>' +
        '<div class="price">' + fmtGBP(net) + '</div>' +
        '<p style="margin:6px 0 0;"><strong>' + pickup.name + '</strong> collection · ' + tonnes.toFixed(2) + ' tonnes ·  EMR rate ' + fmtGBP(EMR_RATE_PER_TONNE) + '/t</p>' +
        '<div class="breakdown">' +
          '<div><span>EMR Sunderland indicative offer</span><span>' + fmtGBP(emrOffer) + '</span></div>' +
          '<div><span>Less recovery (' + totalMiles + ' mi @ £1.75)</span><span>−' + fmtGBP(recoveryCost) + '</span></div>' +
          '<div style="border-top:1px dashed rgba(0,0,0,.3); padding-top:6px; font-weight:700;"><span>Cash to you</span><span>' + fmtGBP(net) + '</span></div>' +
        '</div>' +
        '<p style="margin:0 0 14px; font-size:.92rem;"><em>EMR rates change weekly — final offer confirmed before we collect. ' + (!positive ? 'Note: this vehicle is close to break-even on transport. We pay a guaranteed ' + fmtGBP(MIN_PAYOUT) + ' minimum.' : '') + '</em></p>' +
        '<a class="btn danger btn-call" href="tel:+447754984147">Lock in this offer — 07754 984 147</a>' +
      '</div>';

    resultBox.innerHTML = html;
    resultBox.style.display = 'block';
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
})();
