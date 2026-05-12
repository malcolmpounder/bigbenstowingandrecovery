/* =========================================================
   Coverage map for /areas — replaces the old town-list grid.
   Uses self-hosted Leaflet 1.9.4 (no external CDN, no API key).
   Free OpenStreetMap tiles for the basemap.

   Loads town list + lat/lng from /data/areas.json. Each town becomes
   a clickable marker that links to /areas/<slug>. The free 15-mile
   scrap-collection radius and the typical service-area radius are
   drawn as soft circles around the depot.

   We keep an A-Z list below the map for accessibility, SEO and the
   "I just want a list" mindset.
   ========================================================= */
(function () {
  if (typeof L === 'undefined') { return; } // Leaflet didn't load

  var mapEl  = document.getElementById('coverageMap');
  var listEl = document.getElementById('coverageList');
  if (!mapEl) return;

  // Big Ben's depot — DH3 4HU, Great Lumley.
  var BASE = { lat: 54.838030, lng: -1.545536, label: "Big Ben's depot — DH3 4HU" };
  var FREE_SCRAP_RADIUS_MI = 15;
  var TYPICAL_SERVICE_MI   = 35;
  var MILES_TO_METRES      = 1609.344;

  var map = L.map(mapEl, {
    center: [BASE.lat, BASE.lng],
    zoom: 9,
    scrollWheelZoom: false,            // less likely to hijack a phone scroll
    tap: true
  });
  // Re-enable scroll wheel zoom only after the user has clicked once,
  // so the page-scroll experience stays predictable.
  map.on('click', function () { map.scrollWheelZoom.enable(); });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap</a> contributors'
  }).addTo(map);

  // Override Leaflet's marker icon URLs since we self-host them under
  // /img/vendor/leaflet/ rather than next to leaflet.js.
  // NB: do NOT set L.Icon.Default.imagePath — when both imagePath and
  // iconUrl are set, Leaflet concatenates them and you get a doubled path
  // like /img/vendor/leaflet//img/vendor/leaflet/marker-icon.png. Setting
  // imagePath to '' (or just leaving it default) keeps full URLs intact.
  L.Icon.Default.imagePath = '';
  L.Icon.Default.prototype.options.iconUrl       = '/img/vendor/leaflet/marker-icon.png';
  L.Icon.Default.prototype.options.iconRetinaUrl = '/img/vendor/leaflet/marker-icon-2x.png';
  L.Icon.Default.prototype.options.shadowUrl     = '/img/vendor/leaflet/marker-shadow.png';

  // The depot icon is bigger + orange so it stands out as our HQ.
  var depotIcon = L.divIcon({
    className: 'bb-depot-marker',
    html: '<div style="background:#e85b14; color:#fff; border:3px solid #fff; box-shadow:0 2px 6px rgba(0,0,0,.4); border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:.85rem;">B</div>',
    iconSize: [28, 28], iconAnchor: [14, 14]
  });
  L.marker([BASE.lat, BASE.lng], { icon: depotIcon, zIndexOffset: 1000 })
    .addTo(map)
    .bindPopup(
      '<strong>Big Ben\'s Towing &amp; Recovery</strong><br>' +
      'Great Lumley · DH3 4HU<br>' +
      '<a href="tel:+447754984147">📞 07754&nbsp;984&nbsp;147</a>'
    );

  // 15-mile FREE SCRAP COLLECTION ring
  L.circle([BASE.lat, BASE.lng], {
    radius: FREE_SCRAP_RADIUS_MI * MILES_TO_METRES,
    color: '#fdd91a', weight: 2, opacity: 0.9,
    fillColor: '#fdd91a', fillOpacity: 0.08,
    dashArray: '6 4'
  }).addTo(map).bindPopup(
    '<strong>15-mile free scrap collection</strong><br>' +
    'Anywhere inside this ring, we collect your scrap car for free.'
  );

  // Typical recovery service area — soft fill, no border so it doesn't compete
  L.circle([BASE.lat, BASE.lng], {
    radius: TYPICAL_SERVICE_MI * MILES_TO_METRES,
    color: '#e85b14', weight: 1, opacity: 0.4,
    fillColor: '#e85b14', fillOpacity: 0.04
  }).addTo(map);

  // Load the towns
  fetch('data/areas.json?v=2')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var areas = d.areas.slice().sort(function (a, b) {
        return a.name.localeCompare(b.name);
      });

      var bounds = [[BASE.lat, BASE.lng]];
      areas.forEach(function (a) {
        var marker = L.marker([a.lat, a.lng]).addTo(map);
        marker.bindPopup(
          '<strong>' + a.name + '</strong> (' + a.postcode + ')<br>' +
          a.miles + ' mi from base<br>' +
          '<a href="areas/' + a.slug + '">See ' + a.name + ' recovery info →</a>'
        );
        bounds.push([a.lat, a.lng]);
      });

      // Re-fit so all markers are visible, with a sensible margin.
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });

      // A-Z list below the map for accessibility / SEO. Hidden inside a
      // <details> so it doesn't dominate the visual.
      if (listEl) {
        listEl.innerHTML = areas.map(function (a) {
          return '<a href="areas/' + a.slug + '">' + a.name + '</a>';
        }).join('');
      }
    })
    .catch(function () {
      mapEl.innerHTML = '<p style="text-align:center; color:#999; padding:40px;">Couldn\'t load the coverage map. Call us on 07754&nbsp;984&nbsp;147 to confirm we cover your area.</p>';
    });
})();
