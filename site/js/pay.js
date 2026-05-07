/* Pay-by-code resolver — looks up the entered short code in
   /data/payment-links.json and redirects to the Stripe Payment Link.
   Lookup is case-insensitive. Submitting an unknown code shows a clear
   "we'll need to send a fresh link" message rather than redirecting to a
   broken URL. */
(function () {
  var form   = document.getElementById('payCodeForm');
  var input  = document.getElementById('payCode');
  var status = document.getElementById('payStatus');
  if (!form || !input) return;

  // Allow ?code=BB-1234 in the URL to pre-fill from a deep link
  var qs = new URLSearchParams(location.search);
  if (qs.get('code')) input.value = qs.get('code');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var code = (input.value || '').trim().toUpperCase();
    if (!code) {
      status.innerHTML = '<div class="form-error">Please enter the code we sent you.</div>';
      return;
    }

    status.innerHTML = '<div style="color: var(--grey);">Looking up…</div>';

    fetch('data/payment-links.json', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var links = (d.links || {});
        // Build a case-insensitive map
        var found = null;
        Object.keys(links).forEach(function (k) {
          if (k.toUpperCase() === code) found = links[k];
        });

        if (found && /^https:\/\/(buy\.)?stripe\.com\//.test(found)) {
          status.innerHTML = '<div class="form-success">Found — opening Stripe Checkout…</div>';
          window.location.href = found;
        } else {
          status.innerHTML =
            '<div class="form-error">' +
              "We can't find that code. Double-check it, or " +
              '<a href="contact.html?subject=' + encodeURIComponent('Payment link for ' + code) + '" class="form-error-call">message us</a> ' +
              'and we\'ll send a fresh link.' +
            '</div>';
        }
      })
      .catch(function () {
        status.innerHTML =
          '<div class="form-error">' +
            "Couldn't load the payment list. Please call " +
            '<a href="tel:+447754984147" class="form-error-call">07754&nbsp;984&nbsp;147</a>.' +
          '</div>';
      });
  });
})();
