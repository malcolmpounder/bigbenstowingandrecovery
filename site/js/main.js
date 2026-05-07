/* =========================================================
   Big Ben's Towing & Recovery — main.js
   Handles: cookie banner, year stamp, area-cloud population,
            sticky action bar (Call + WhatsApp + Share location)
   ========================================================= */
(function () {
  // ---- Constants ---------------------------------------------------
  var PHONE_TEL = '+447754984147';                  // tel: link
  var PHONE_DISPLAY = '07754 984 147';              // human-readable
  var WHATSAPP_NUM = '447754984147';                // wa.me path
  var WHATSAPP_DEFAULT_MSG =
    "Hi Big Ben's — I need vehicle recovery. Could you call me back please?";

  // Official WhatsApp glyph (single-colour, recolourable via fill="currentColor"
  // when used inside a coloured pill).
  var WA_LOGO_SVG =
    '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path fill="currentColor" d="M16.001 3.2c-7.07 0-12.8 5.73-12.8 12.8 0 2.26.59 4.47 1.71 6.42L3.2 28.8l6.55-1.71a12.78 12.78 0 0 0 6.25 1.6h.01c7.07 0 12.8-5.73 12.8-12.8 0-3.42-1.33-6.63-3.75-9.05A12.71 12.71 0 0 0 16 3.2zm0 23.36h-.01a10.6 10.6 0 0 1-5.4-1.48l-.39-.23-3.89 1.02 1.04-3.79-.25-.4a10.62 10.62 0 0 1-1.62-5.65c0-5.87 4.78-10.65 10.65-10.65 2.84 0 5.51 1.11 7.52 3.12a10.55 10.55 0 0 1 3.12 7.53c0 5.87-4.78 10.55-10.77 10.55zm5.83-7.96c-.32-.16-1.89-.93-2.18-1.04-.29-.11-.5-.16-.71.16-.21.32-.82 1.04-1 1.25-.18.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.59-1.9-1.78-2.22-.18-.32-.02-.5.14-.66.14-.14.32-.37.48-.55.16-.18.21-.32.32-.53.11-.21.05-.4-.03-.55-.08-.16-.71-1.71-.97-2.34-.26-.62-.52-.53-.71-.54l-.61-.01c-.21 0-.55.08-.84.4-.29.32-1.1 1.07-1.1 2.62 0 1.55 1.13 3.05 1.29 3.26.16.21 2.22 3.39 5.39 4.76.75.32 1.34.52 1.8.66.76.24 1.45.21 1.99.13.61-.09 1.89-.77 2.16-1.51.27-.74.27-1.38.19-1.51-.08-.13-.29-.21-.61-.37z"/>' +
    '</svg>';

  // Phone glyph — same monoline weight as the WhatsApp logo so the two
  // pills look like a matched pair, not bolted-together stock icons.
  var PHONE_SVG =
    '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path fill="currentColor" d="M22.18 19.06c-.4-.2-2.36-1.16-2.72-1.3-.36-.13-.62-.2-.89.2-.27.4-1.02 1.3-1.25 1.56-.23.27-.46.3-.86.1-2.36-1.18-3.91-2.1-5.47-4.78-.41-.7.41-.65 1.18-2.17.13-.27.07-.5-.03-.7-.1-.2-.89-2.16-1.22-2.96-.32-.77-.65-.66-.89-.68-.23-.01-.5-.01-.76-.01-.27 0-.7.1-1.07.5-.36.4-1.4 1.36-1.4 3.32s1.43 3.85 1.63 4.12c.2.27 2.82 4.31 6.83 6.04 2.55 1.1 3.55 1.19 4.82.99.78-.12 2.36-.96 2.69-1.9.33-.93.33-1.73.23-1.9-.1-.16-.36-.27-.76-.46zM16 4C9.37 4 4 9.37 4 16c0 2.12.55 4.18 1.6 6L4 28l6.16-1.61A11.93 11.93 0 0 0 16 28c6.63 0 12-5.37 12-12S22.63 4 16 4zm0 21.84c-1.83 0-3.62-.49-5.18-1.42l-.37-.22-3.66.96.98-3.57-.24-.37a9.88 9.88 0 0 1-1.51-5.22c0-5.46 4.44-9.9 9.9-9.9s9.9 4.44 9.9 9.9c0 5.46-4.44 9.84-9.82 9.84z"/>' +
    '</svg>';

  // ---- Helpers -----------------------------------------------------
  function buildWhatsAppHref(message) {
    var msg = (message == null || message === '') ? WHATSAPP_DEFAULT_MSG : message;
    return 'https://wa.me/' + WHATSAPP_NUM + '?text=' + encodeURIComponent(msg);
  }

  // ---- Year stamp --------------------------------------------------
  var yr = document.getElementById('yr');
  if (yr) yr.textContent = new Date().getFullYear();

  // ---- A11y: inject skip-to-content link as first body child --------
  if (!document.querySelector('.skip-link')) {
    var skip = document.createElement('a');
    skip.className = 'skip-link';
    skip.href = '#main';
    skip.textContent = 'Skip to main content';
    document.body.insertBefore(skip, document.body.firstChild);
  }

  // ---- A11y: ensure a single <main> landmark exists -----------------
  // Lighthouse / WCAG want one <main>. Most legacy pages render their
  // content as <section>…</section> at top level. We tag the first
  // such section with role="main" so screen readers and the audit pass.
  if (!document.querySelector('main')) {
    var firstSection = document.querySelector('body > section, body > div + section');
    if (firstSection) {
      firstSection.setAttribute('role', 'main');
      firstSection.id = 'main';
      firstSection.setAttribute('tabindex', '-1');
    }
  } else if (!document.getElementById('main')) {
    document.querySelector('main').id = 'main';
  }

  // ---- A11y: nav-toggle aria-expanded + cleaner handler ------------
  var navToggle = document.querySelector('.nav-toggle');
  var navLinks = document.getElementById('navlinks');
  if (navToggle && navLinks) {
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-controls', 'navlinks');
    // Replace inline onclick with managed listener so we keep aria in sync
    navToggle.onclick = null;
    navToggle.addEventListener('click', function () {
      var open = navLinks.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // ---- Sticky action bar -------------------------------------------
  // Replaces the lone .float-call link with a paired Call + WhatsApp
  // action bar. CSS handles desktop (stacked floating circles) vs
  // mobile (full-width split bottom bar). One JS upgrade so we never
  // have to edit the 60+ page templates.
  var floatCall = document.querySelector('.float-call');
  if (floatCall && !floatCall.dataset.enhanced) {
    floatCall.dataset.enhanced = '1';

    // Rebuild the call link with proper structured markup
    floatCall.innerHTML =
      '<span class="fc-icon" aria-hidden="true">' + PHONE_SVG + '</span>' +
      '<span class="fc-text">' +
        '<span class="fc-label">Call 24/7 — broken down?</span>' +
        '<span class="fc-num">' + PHONE_DISPLAY + '</span>' +
      '</span>';
    /* aria-label removed — accessible name now derives from visible text
       so it matches what users see (Lighthouse a11y rule). */
    floatCall.removeAttribute('aria-label');

    // Wrap call link + new WhatsApp link in a single sticky stack
    var stack = document.createElement('div');
    stack.className = 'float-stack';
    floatCall.parentNode.insertBefore(stack, floatCall);
    stack.appendChild(floatCall);

    var wa = document.createElement('a');
    wa.className = 'float-wa';
    wa.href = buildWhatsAppHref();
    wa.target = '_blank';
    wa.rel = 'noopener';
    /* No aria-label — visible text "WhatsApp" is the accessible name. */
    wa.innerHTML =
      '<span class="fc-icon" aria-hidden="true">' + WA_LOGO_SVG + '</span>' +
      '<span class="fc-text">' +
        '<span class="fc-label">Or message us</span>' +
        '<span class="fc-num">WhatsApp</span>' +
      '</span>';
    stack.appendChild(wa);
  }

  // ---- Hero CTA: inject "Share my location" button ----------------
  // Sits between the existing Call and Quote buttons. Reading the
  // GPS, building a Google Maps link and opening WhatsApp pre-filled
  // is handled below. Only injected where a hero-cta exists.
  var heroCta = document.querySelector('.hero-cta');
  if (heroCta && !heroCta.dataset.shareInjected) {
    heroCta.dataset.shareInjected = '1';
    var share = document.createElement('button');
    share.type = 'button';
    share.id = 'share';                                  // anchor target from other pages
    share.className = 'btn btn-share-loc';
    share.innerHTML =
      '<span class="bsl-icon" aria-hidden="true">📍</span>' +
      '<span class="bsl-label">Share my location</span>';
    // Insert as the second item (after the primary Call button)
    var firstBtn = heroCta.querySelector('.btn');
    if (firstBtn && firstBtn.nextSibling) {
      heroCta.insertBefore(share, firstBtn.nextSibling);
    } else {
      heroCta.appendChild(share);
    }
    share.addEventListener('click', function () { shareLocation(share); });
  }

  // ---- Share-my-location flow -------------------------------------
  // Geolocation → opens WhatsApp with maps link + accuracy pre-filled.
  // States: idle → locating → success/error. Visual feedback via
  // class names on the button so CSS owns the look.
  function shareLocation(btn) {
    if (btn.dataset.busy === '1') return;
    if (!('geolocation' in navigator)) {
      setShareState(btn, 'error', "Your browser can't share location — please call us instead.");
      return;
    }
    btn.dataset.busy = '1';
    setShareState(btn, 'locating', 'Getting your location…');

    navigator.geolocation.getCurrentPosition(
      function (pos) {
        var lat = pos.coords.latitude.toFixed(6);
        var lng = pos.coords.longitude.toFixed(6);
        var acc = Math.round(pos.coords.accuracy || 0);
        var mapsUrl = 'https://maps.google.com/?q=' + lat + ',' + lng;
        var msg =
          "Hi Big Ben's — I've broken down and need recovery.\n" +
          "My location: " + mapsUrl + "\n" +
          "(GPS accurate to ~" + acc + "m)\n" +
          "Please come and get me.";
        setShareState(btn, 'success', 'Got it — opening WhatsApp…');
        // Brief pause so the user sees the success state
        setTimeout(function () {
          window.location.href = buildWhatsAppHref(msg);
          btn.dataset.busy = '';
        }, 600);
      },
      function (err) {
        btn.dataset.busy = '';
        var deniedMsg = err && err.code === 1
          ? "Location blocked — please tap CALL instead, or enable location in your browser settings."
          : "Couldn't get your location — please tap CALL instead.";
        setShareState(btn, 'error', deniedMsg);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }

  function setShareState(btn, state, label) {
    btn.classList.remove('is-locating', 'is-success', 'is-error');
    if (state === 'locating') btn.classList.add('is-locating');
    if (state === 'success')  btn.classList.add('is-success');
    if (state === 'error')    btn.classList.add('is-error');
    var labelEl = btn.querySelector('.bsl-label');
    if (labelEl) labelEl.textContent = label;
    if (state === 'error') {
      // Auto-restore the idle label after a few seconds so they can retry
      setTimeout(function () {
        btn.classList.remove('is-error');
        if (labelEl) labelEl.textContent = 'Try sharing location again';
        setTimeout(function () {
          if (labelEl && !btn.classList.contains('is-locating')) {
            labelEl.textContent = 'Share my location';
          }
        }, 2500);
      }, 5000);
    }
  }

  // ---- Cookie banner (preview=1 suppresses for screenshot mode) ----
  var previewMode = /[?&]preview=1\b/.test(location.search);
  if (!previewMode && !localStorage.getItem('bb_cookie_ok')) {
    var b = document.getElementById('cookieBanner');
    if (b) b.classList.add('show');
  }
  function acceptCookies() {
    localStorage.setItem('bb_cookie_ok', '1');
    var b = document.getElementById('cookieBanner');
    if (b) b.classList.remove('show');
  }
  // Bind the cookie-banner OK click via JS so the HTML has no inline onclick
  var cookieOk = document.querySelector('#cookieBanner .btn');
  if (cookieOk) cookieOk.addEventListener('click', acceptCookies);

  // Date-stamp helper — terms / privacy show a "last updated" date.
  // Look for #dt and fill with today's localised date.
  var dt = document.getElementById('dt');
  if (dt) dt.textContent = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });

  // FAQ hash auto-open — if the URL has a #q-... fragment matching a
  // <details> on the page, open it and scroll into view.
  if (location.hash && /^#q-[a-z0-9-]+$/i.test(location.hash)) {
    var item = document.querySelector(location.hash);
    if (item && item.tagName === 'DETAILS') {
      document.querySelectorAll('.faq-item[open]').forEach(function (d) {
        if (d !== item) d.removeAttribute('open');
      });
      item.setAttribute('open', '');
      item.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // ---- Service worker (offline / poor-signal mode) ------------------
  // Caches the homepage, motorway-breakdown safety guide and core assets
  // so the call number is reachable even when signal drops on the hard
  // shoulder. Skipped on file:// and other non-secure contexts.
  if ('serviceWorker' in navigator) {
    var isSecure = location.protocol === 'https:'
      || location.hostname === 'localhost'
      || location.hostname === '127.0.0.1';
    if (isSecure) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('/sw.js').catch(function () { /* silently ignore */ });
      });
    }
  }

  // ---- Homepage availability badge --------------------------------
  // Reads data/availability.json. Renders a coloured pill into #availability
  // showing whether the truck is available, busy, or offline.
  var availSlot = document.getElementById('availability');
  if (availSlot) {
    fetch('data/availability.json', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (a) {
        var html = '';
        if (a.status === 'available') {
          html = '<span class="avail avail--ok"><span class="avail-dot" aria-hidden="true"></span>Available now</span>';
        } else if (a.status === 'busy') {
          var by = a.returnBy ? ' — back by ' + escapeHTML(a.returnBy) : '';
          html = '<span class="avail avail--busy"><span class="avail-dot" aria-hidden="true"></span>On a job' + by + '</span>';
        } else if (a.status === 'offline') {
          var why = a.reason ? ' — ' + escapeHTML(a.reason) : '';
          html = '<span class="avail avail--off"><span class="avail-dot" aria-hidden="true"></span>Offline' + why + '</span>';
        }
        availSlot.innerHTML = html;
      })
      .catch(function () { /* fail silently — badge is optional */ });
  }

  // ---- Homepage testimonials renderer ------------------------------
  // Reads data/testimonials.json. Hides the section if empty or all
  // entries are still placeholder templates. Big Ben edits the JSON
  // directly to add real reviews — no code changes needed.
  var testimonialsRoot = document.getElementById('testimonialsList');
  if (testimonialsRoot) {
    fetch('data/testimonials.json')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var real = (d.reviews || []).filter(function (rev) {
          return !rev._template;       // hide placeholder entries
        });
        if (!real.length) {
          var section = document.getElementById('testimonialsSection');
          if (section) section.style.display = 'none';
          return;
        }
        var html = real.map(function (rev) {
          var stars = '★'.repeat(rev.rating || 5) + '☆'.repeat(5 - (rev.rating || 5));
          var date = rev.date ? new Date(rev.date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '';
          return (
            '<figure class="testimonial">' +
              '<div class="testimonial__stars" aria-label="' + (rev.rating || 5) + ' out of 5 stars">' + stars + '</div>' +
              '<blockquote>' + escapeHTML(rev.quote) + '</blockquote>' +
              '<figcaption>' +
                '<strong>' + escapeHTML(rev.name) + '</strong>' +
                (rev.town    ? ' · ' + escapeHTML(rev.town)    : '') +
                (rev.vehicle ? ' · ' + escapeHTML(rev.vehicle) : '') +
                (date        ? ' · ' + date                    : '') +
                (rev.source  ? ' <span class="testimonial__source">via ' + escapeHTML(rev.source) + '</span>' : '') +
              '</figcaption>' +
            '</figure>'
          );
        }).join('');
        testimonialsRoot.innerHTML = html;
      })
      .catch(function () {
        var section = document.getElementById('testimonialsSection');
        if (section) section.style.display = 'none';
      });
  }

  // ---- Recent jobs feed renderer -----------------------------------
  // Same pattern as testimonials — JSON-driven, hand-editable.
  var jobsRoot = document.getElementById('recentJobsList');
  if (jobsRoot) {
    fetch('data/recent-jobs.json')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var real = (d.jobs || []).filter(function (j) { return !j._template; });
        if (!real.length) {
          var section = document.getElementById('recentJobsSection');
          if (section) section.style.display = 'none';
          return;
        }
        var html = real.slice(0, 6).map(function (job) {
          var date = job.date ? new Date(job.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
          return (
            '<article class="recent-job">' +
              (date ? '<div class="recent-job__date">' + date + '</div>' : '') +
              '<div class="recent-job__route">' + escapeHTML(job.route || '') + '</div>' +
              '<div class="recent-job__vehicle">' + escapeHTML(job.vehicle || '') + '</div>' +
              (job.summary ? '<p class="recent-job__summary">' + escapeHTML(job.summary) + '</p>' : '') +
              (job.miles ? '<div class="recent-job__meta">' + job.miles + ' mi' +
                (job.price ? ' · £' + job.price : '') + '</div>' : '') +
            '</article>'
          );
        }).join('');
        jobsRoot.innerHTML = html;
      })
      .catch(function () {
        var section = document.getElementById('recentJobsSection');
        if (section) section.style.display = 'none';
      });
  }

  function escapeHTML(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ---- Area cloud (homepage / areas index) -------------------------
  var cloud = document.getElementById('areaCloud');
  if (cloud) {
    fetch('data/areas.json')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        d.areas
          .slice()
          .sort(function (a, b) { return a.name.localeCompare(b.name); })
          .forEach(function (a) {
            var link = document.createElement('a');
            link.href = 'areas/' + a.slug + '.html';
            link.textContent = a.name;
            cloud.appendChild(link);
          });
      })
      .catch(function () { /* fail silently — list is optional */ });
  }
})();
