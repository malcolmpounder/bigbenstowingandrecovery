/* =========================================================
   Contact form — quote-handoff prefill, validation, honeypot,
   POST to /api/contact (Cloudflare Pages Function), graceful
   fallback to "call us instead" on network error.

   Externalised from contact.html so the page can ship under a
   strict CSP without 'unsafe-inline' for executable scripts.
   ========================================================= */
(function () {
  // ---- Quote-handoff prefill (?pickup=...&dropoff=...&estimate=...) ----
  var p = new URLSearchParams(location.search);
  if (p.get('pickup') || p.get('dropoff') || p.get('estimate')) {
    var msg = document.getElementById('cmsg');
    if (msg) {
      msg.value =
        "Hi — I'd like to book a recovery.\n" +
        (p.get('pickup')   ? 'Pickup:   ' + p.get('pickup')   + '\n' : '') +
        (p.get('dropoff')  ? 'Drop-off: ' + p.get('dropoff')  + '\n' : '') +
        (p.get('estimate') ? 'Quote:    £' + p.get('estimate') + '\n' : '') +
        "\nPlease give me a call back to arrange.";
    }
  }

  // ---- Form validation + submit handler ----
  var form   = document.getElementById('contactForm');
  var status = document.getElementById('contactStatus');
  if (!form) return;

  var fields = {
    cname:  { msg: 'Please give us your name so we know who to call back.' },
    cphone: { msg: 'A phone number lets us call you back fastest. Numbers, +, ( ) and - are fine.' },
    cemail: { msg: "That email address doesn't look right." },
    cmsg:   { msg: 'A short message helps us prepare for the call (a few words is plenty).' }
  };

  function setErr(id, on) {
    var el  = document.getElementById(id);
    var err = document.getElementById(id + '-err');
    if (!el || !err) return;
    if (on) {
      err.textContent = fields[id].msg;
      err.hidden = false;
      el.setAttribute('aria-invalid', 'true');
      el.classList.add('is-invalid');
    } else {
      err.hidden = true;
      el.removeAttribute('aria-invalid');
      el.classList.remove('is-invalid');
    }
  }

  function validate() {
    var valid = true;
    Object.keys(fields).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var ok = el.checkValidity();
      setErr(id, !ok);
      if (!ok) valid = false;
    });
    return valid;
  }

  // Live-clear errors as the user types
  Object.keys(fields).forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', function () { setErr(id, false); });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var hp = document.getElementById('website');
    if (hp && hp.value) {
      // Honeypot tripped — pretend success (don't tip off the bot)
      status.innerHTML = '<div class="form-success">Thanks — we\'ll be in touch shortly.</div>';
      form.reset();
      return;
    }

    if (!validate()) {
      status.innerHTML = '<div class="form-error">Please fix the highlighted fields and try again.</div>';
      return;
    }

    var qsp = new URLSearchParams(location.search);
    var payload = {
      name:    document.getElementById('cname').value.trim(),
      phone:   document.getElementById('cphone').value.trim(),
      email:   document.getElementById('cemail').value.trim(),
      message: document.getElementById('cmsg').value.trim(),
      website: hp ? hp.value : '',
      pickup:   qsp.get('pickup')   || '',
      dropoff:  qsp.get('dropoff')  || '',
      estimate: qsp.get('estimate') || ''
    };

    var btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Sending…';
    status.innerHTML = '';

    var fallbackCallLink =
      '<a href="tel:+447754984147" class="form-error-call">07754&nbsp;984&nbsp;147</a>';

    fetch('/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok && res.j && res.j.ok) {
          status.innerHTML = '<div class="form-success">Thanks — your message is on its way. We\'ll come back to you by phone or email shortly.</div>';
          form.reset();
        } else {
          var msg = (res.j && res.j.error) || 'Something went wrong sending that.';
          status.innerHTML = '<div class="form-error">' + msg + ' If it\'s urgent please call ' + fallbackCallLink + '.</div>';
        }
      })
      .catch(function () {
        status.innerHTML = '<div class="form-error">No connection. Please call ' + fallbackCallLink + '.</div>';
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = 'Send Message';
      });
  });
})();
