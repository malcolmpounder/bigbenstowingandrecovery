/* =========================================================
   Big Ben's Towing — scrap-car offer calculator
   Logic:
     Base offer    = tonnes × £/tonne
     + cat bonus  (catalytic converter present)
     + alloys bonus (factory alloy wheels)
     × condition multiplier
     − £20 if no V5C logbook
     − collection cost
     Customer net  = max(MIN_PAYOUT, the lot above)

   Collection cost rules:
     - Free within 15 driving miles of our base (DH3 4HU)
     - Beyond that, a per-mile contribution covers the longer trip.
       The rate is private (held in COLLECTION_RATE) and only the
       resulting deduction is shown to the customer, not the rate.
     - Round-trip portion beyond the free radius is what gets charged
       (so if pickup is 25 mi from base: chargeable = (25 − 15) × 2 = 20 mi)

   £/tonne is editable here in OFFER_PER_TONNE (this one IS public).
   ========================================================= */
(function () {
  // === Tunables — Big Ben edits these as the market moves =====
  var OFFER_PER_TONNE  = 60;     // £/tonne — flat rate paid to the customer
  var FREE_RADIUS_MI   = 15;     // free collection within this radius of base
  // Internal — never displayed to the customer. Per-mile collection
  // contribution beyond the free radius. Rate sheet is private.
  var COLLECTION_RATE  = 1.75;
  var NO_V5C_DEDUCT    = 20;     // £ deducted if no logbook
  var ALLOYS_BONUS     = 25;     // £ added if factory alloys
  var MIN_PAYOUT       = 30;     // £ minimum we'll pay even on tiny jobs
  // ============================================================

  var pickupSel = document.getElementById('pickup');
  var resultBox = document.getElementById('scrapResult');
  var form      = document.getElementById('scrapForm');
  var regInput  = document.getElementById('reg');
  var regBtn    = document.getElementById('regLookupBtn');
  var regStatus = document.getElementById('regStatus');
  var vclassSel = document.getElementById('vclass');
  var vmodelInp = document.getElementById('vmodel');
  // The "Vehicle confirmed" pill + manual-fallback row introduced when we
  // started auto-classifying via DVLA. When the lookup matches a known
  // weight class we collapse the manual row entirely.
  var vehicleConfirmed       = document.getElementById('vehicleConfirmed');
  var vehicleConfirmedLabel  = document.getElementById('vehicleConfirmedLabel');
  var vehicleConfirmedTonnes = document.getElementById('vehicleConfirmedTonnes');
  var vehicleManualRow       = document.getElementById('vehicleManualRow');
  var vehicleEditBtn         = document.getElementById('vehicleEditBtn');
  var DATA      = null;
  var WEIGHTS   = null;

  function showConfirmedVehicle(label, classOption, certainty, hasModel) {
    if (!vehicleConfirmed || !vehicleManualRow) return;
    vehicleConfirmedLabel.textContent = label;
    var opt = classOption ? classOption.textContent.split(' (')[0] : '';
    var tonnes = classOption ? classOption.dataset.tonnes : '';
    var classLabel = tonnes
      ? tonnes + ' tonnes · ' + opt.toLowerCase()
      : opt;

    var header = document.getElementById('vehicleConfirmedHeader');
    // Best-guess framing: we picked a class based on the make alone (no
    // exact model match in our weights table). Visually different to a
    // confirmed match so the customer knows to double-check.
    if (certainty === 'guess') {
      // Don't claim "model not in DVLA reply" if we DO have a model — DVSA
      // sometimes returns a short form (e.g. "C" for C-Class) that we
      // haven't mapped specifically. Use a neutral framing in that case.
      var suffix = hasModel ? '' : ' (model not on file)';
      vehicleConfirmedLabel.textContent = label + suffix;
      vehicleConfirmedTonnes.textContent = 'Estimated as ' + opt.toLowerCase() + ' (' + tonnes + ' t) — tap "Edit" if that\'s wrong';
      // Switch the green panel to a cautionary yellow.
      vehicleConfirmed.style.background = '#3d3217';
      vehicleConfirmed.style.borderLeftColor = '#ffc20e';
      if (header) {
        header.textContent = 'Best guess';
        header.style.color = '#ffd54a';
      }
    } else {
      vehicleConfirmedTonnes.textContent = classLabel;
      vehicleConfirmed.style.background = '#1f3d1f';
      vehicleConfirmed.style.borderLeftColor = '#6dba2c';
      if (header) {
        header.textContent = 'Vehicle confirmed';
        header.style.color = '#a4d965';
      }
    }

    vehicleConfirmed.hidden = false;
    vehicleConfirmed.style.display = '';                  // un-hide
    // .form-row sets display:grid which beats the [hidden] UA stylesheet, so
    // we set display:none explicitly to actually collapse the manual row.
    vehicleManualRow.style.display = 'none';
    vehicleManualRow.hidden = true;
    // The manual select is required=true; if we hide it we must drop required
    // or the form won't submit. The class is already programmatically selected,
    // so the value's there — just lift the constraint.
    vclassSel.required = false;
  }
  function showManualVehicle() {
    if (!vehicleConfirmed || !vehicleManualRow) return;
    vehicleConfirmed.hidden = true;
    vehicleConfirmed.style.display = 'none';
    vehicleManualRow.style.display = '';                  // back to grid
    vehicleManualRow.hidden = false;
    vclassSel.required = true;
  }
  if (vehicleEditBtn) {
    vehicleEditBtn.addEventListener('click', showManualVehicle);
  }

  // Load the weight lookup table. v= query string busts old CDN-cached
  // copies whenever we add new vehicles or new make-default entries.
  fetch('data/weights.json?v=4').then(function (r) { return r.json(); }).then(function (w) { WEIGHTS = w; });

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
  function fmtGBP(n) {
    return new Intl.NumberFormat('en-GB', { style:'currency', currency:'GBP', maximumFractionDigits: 0 }).format(n);
  }

  // Round-trip miles charged for a pickup that is `miles` from base.
  //   miles ≤ 15 → 0 (free)
  //   miles > 15 → (miles − 15) × 2  (chargeable on the way out AND back)
  function chargeableMiles(milesFromBase) {
    return Math.max(0, milesFromBase - FREE_RADIUS_MI) * 2;
  }

  // ============ Reg lookup ============
  function normaliseReg(s) {
    return (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
  // Tight matcher: the character immediately AFTER the match in the key
  // must be a non-letter (digit, space, hyphen, or end-of-string). This
  //   - allows "BMW 3" to match "BMW 320D" (digit follows 3)
  //   - allows "MERCEDES-BENZ C" to match "MERCEDES-BENZ C 220 CDI" (space)
  //   - REFUSES "MERCEDES-BENZ C" to match "MERCEDES-BENZ CLA" (letter)
  //   - REFUSES "MERCEDES-BENZ S" to match "MERCEDES-BENZ SLK" (letter)
  // Start boundary is handled by the three top-level checks: at position 0,
  // preceded by a space, or exact equality.
  function endBoundaryOk(key, endPos) {
    if (endPos >= key.length) return true;
    var c = key.charAt(endPos);
    return c < 'A' || c > 'Z';   // key is already uppercased
  }
  function matchesEntry(key, m) {
    if (!m) return false;
    // m at position 0
    if (key.indexOf(m) === 0 && endBoundaryOk(key, m.length)) return true;
    // m preceded by a space (mid-string)
    var idx = key.indexOf(' ' + m);
    if (idx >= 0 && endBoundaryOk(key, idx + 1 + m.length)) return true;
    // exact equality
    if (key === m) return true;
    return false;
  }

  // Returns { class, certainty: 'exact' | 'guess' } or null when we can't even
  // make a sensible guess. 'exact' = matched by full make+model. 'guess' =
  // matched only by make (e.g. DVLA gave us "MERCEDES-BENZ" with no model;
  // we default Mercedes scrap jobs to medium-class). UI surfaces 'guess'
  // differently so the customer knows to double-check.
  function classifyVehicle(make, model) {
    if (!WEIGHTS) return null;
    var key = ((make || '') + ' ' + (model || '')).toUpperCase().trim();
    var matches = WEIGHTS.vehicles
      .filter(function (v) { return matchesEntry(key, v.match); })
      .sort(function (a, b) { return b.match.length - a.match.length; });
    if (matches[0]) return { class: matches[0].class, certainty: 'exact' };

    // Make-only fallback: DVLA's free VES API often returns make without model.
    // Better to give a sensible default than to bail and show the manual list.
    if (WEIGHTS._makes_default && make) {
      var makeUpper = make.toUpperCase().trim();
      if (WEIGHTS._makes_default[makeUpper]) {
        return { class: WEIGHTS._makes_default[makeUpper], certainty: 'guess' };
      }
    }
    return null;
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
        var label = [v.year, v.make, v.model].filter(Boolean).join(' ');
        if (vmodelInp) vmodelInp.value = label;
        var match = classifyVehicle(v.make, v.model);
        if (match) {
          var matchedOption = null;
          for (var i = 0; i < vclassSel.options.length; i++) {
            if (vclassSel.options[i].value === match.class) {
              vclassSel.selectedIndex = i;
              matchedOption = vclassSel.options[i];
              break;
            }
          }
          // Collapse the manual class+model row. With certainty='exact'
          // we render a green "Confirmed" pill; with 'guess' we render a
          // yellow "Estimated — tap to override" pill instead.
          var hasModel = !!v.model;
          showConfirmedVehicle(label, matchedOption, match.certainty, hasModel);
          var classWord = matchedOption.textContent.split(' (')[0].toLowerCase();
          if (match.certainty === 'exact') {
            setStatus('Found ' + label + ' — using ' + classWord + ' class. Tap "Edit" to override.', 'ok');
          } else if (hasModel) {
            // We have a model but it doesn't match our weights table (e.g.
            // DVSA returned "C" for Mercedes C-Class). Keep the framing
            // honest — we found the model, we just classified by make.
            setStatus('Found ' + label + ' — best-guess: ' + classWord + ' class. Tap "Edit" if your model is heavier/lighter.', 'warn');
          } else {
            setStatus('Found ' + (v.make || '') + ' (model not on file) — best-guess: ' + classWord + ' class. Tap "Edit" if your model is different.', 'warn');
          }
        } else {
          // We got a vehicle from DVLA but our weights table doesn't know
          // even the make (very rare — kit cars, ultra-niche imports).
          showManualVehicle();
          setStatus('Found ' + label + ' — please pick a vehicle class below.', 'warn');
        }
      })
      .catch(function (e) {
        showManualVehicle();
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

    var vclassEl    = document.getElementById('vclass');
    var condEl      = document.getElementById('condition');
    var catEl       = document.getElementById('cat');
    var alloysEl    = document.getElementById('alloys');
    var paperworkEl = document.getElementById('paperwork');
    if (!vclassEl.value) return;

    var tonnes      = parseFloat(vclassEl.options[vclassEl.selectedIndex].dataset.tonnes);
    var condMult    = parseFloat(condEl.options[condEl.selectedIndex].dataset.mult);
    var catBonus    = parseFloat(catEl.options[catEl.selectedIndex].dataset.bonus) || 0;
    var alloysBonus = (alloysEl && alloysEl.value === 'yes') ? ALLOYS_BONUS : 0;
    var noV5C       = paperworkEl && paperworkEl.value === 'no';

    // ----- The offer -----
    var basePerTonne = tonnes * OFFER_PER_TONNE;       // raw scrap value
    var preCondition = basePerTonne + catBonus + alloysBonus;
    var afterCond    = preCondition * condMult;
    var afterPaperwork = afterCond - (noV5C ? NO_V5C_DEDUCT : 0);

    var pickup = find(pickupSlug);
    var milesFromBase = pickup.miles;
    var chargeMi      = chargeableMiles(milesFromBase);
    var collectionCost = chargeMi * COLLECTION_RATE;

    var net = Math.round(afterPaperwork - collectionCost);
    if (net < MIN_PAYOUT) net = MIN_PAYOUT;

    // Build the breakdown rows. We only show a row if it changed the offer
    // (e.g. no point showing "alloys: £0" when they said no).
    var rows = '';
    rows += '<div><span>Vehicle ' + tonnes.toFixed(2) + ' tonnes × £' + OFFER_PER_TONNE + '/t</span><span>' + fmtGBP(basePerTonne) + '</span></div>';
    if (catBonus > 0) {
      rows += '<div><span>Catalytic converter bonus</span><span>+' + fmtGBP(catBonus) + '</span></div>';
    }
    if (alloysBonus > 0) {
      rows += '<div><span>Alloy wheels bonus</span><span>+' + fmtGBP(alloysBonus) + '</span></div>';
    }
    if (condMult !== 1.00) {
      var condLabel = condEl.options[condEl.selectedIndex].textContent;
      var pct = Math.round((condMult - 1) * 100);
      rows += '<div><span>' + condLabel + ' (' + (pct >= 0 ? '+' : '') + pct + '%)</span><span>' + fmtGBP(afterCond - preCondition) + '</span></div>';
    }
    if (noV5C) {
      rows += '<div><span>No V5C logbook</span><span>−' + fmtGBP(NO_V5C_DEDUCT) + '</span></div>';
    }
    if (collectionCost > 0) {
      // Show distance from base (helpful) but NOT the chargeable miles —
      // that would let the customer back-calculate the per-mile rate, which
      // we deliberately keep off the public site.
      rows += '<div><span>Collection (' + Math.round(milesFromBase) + ' mi from base — outside the free zone)</span><span>−' + fmtGBP(collectionCost) + '</span></div>';
    } else {
      rows += '<div><span>Collection within ' + FREE_RADIUS_MI + ' mi of base</span><span style="color:#3a8a3a;">FREE</span></div>';
    }
    rows += '<div style="border-top:1px dashed rgba(0,0,0,.3); padding-top:6px; font-weight:700;"><span>Cash to you</span><span>' + fmtGBP(net) + '</span></div>';

    var html =
      '<div class="quote-result scrap-positive">' +
        '<h3>Your indicative offer</h3>' +
        '<div class="price">' + fmtGBP(net) + '</div>' +
        '<p style="margin:6px 0 0;"><strong>' + pickup.name + '</strong> collection · ' + tonnes.toFixed(2) + ' tonnes · £' + OFFER_PER_TONNE + '/tonne flat</p>' +
        '<div class="breakdown">' + rows + '</div>' +
        '<p style="margin:0 0 14px; font-size:.92rem;"><em>Indicative only — final figure confirmed once we\'ve seen the vehicle. We always pay at least ' + fmtGBP(MIN_PAYOUT) + ' even when the numbers say less.</em></p>' +
        '<a class="btn danger btn-call" href="tel:+447754984147">Lock in this offer — 07754 984 147</a>' +
      '</div>';

    resultBox.innerHTML = html;
    resultBox.style.display = 'block';
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
})();
