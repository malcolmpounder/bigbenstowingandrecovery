/* =========================================================
   Generate QR codes for the van + business cards.

   Outputs:
     qr/qr-business-card.png   — 600x600, print-ready (300 DPI = 2 inch)
     qr/qr-business-card.svg   — vector, scalable
     qr/qr-van-large.png       — 2400x2400, big enough for door panel
     qr/qr-van-large.svg       — vector
     qr/qr-call-deeplink.png   — clickable phone tel: link

   Notes on QR sizing for vans:
     - Smallest readable scan distance is roughly 10× the QR width.
     - At 6m van-side, customer scanning from 1m needs ~10cm QR.
     - We render at print quality so the black/white edges stay crisp
       even after laminate / vinyl wrap.

   The QRs use ECC level "H" (30% redundancy) — survives a logo overlay
   or a bit of grime/scratching on a vinyl wrap.
   ========================================================= */
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const ROOT   = path.resolve(__dirname, '..');
const OUT    = path.join(ROOT, 'qr');
fs.mkdirSync(OUT, { recursive: true });

const SITE = 'https://bigbenstowingandrecovery.co.uk';
const TEL  = 'tel:+447754984147';

async function makePng(file, text, opts) {
  await QRCode.toFile(file, text, {
    errorCorrectionLevel: 'H',
    type: 'png',
    margin: 2,
    ...opts
  });
  console.log('  ' + path.relative(ROOT, file) + '  →  ' + text);
}

async function makeSvg(file, text, opts) {
  const svg = await QRCode.toString(text, {
    errorCorrectionLevel: 'H',
    type: 'svg',
    margin: 2,
    ...opts
  });
  fs.writeFileSync(file, svg);
  console.log('  ' + path.relative(ROOT, file) + '  →  ' + text);
}

(async () => {
  console.log('Generating QR codes…');

  // Business card — small, plain. 600x600 = 2 inch @ 300 DPI.
  await makePng(path.join(OUT, 'qr-business-card.png'), SITE, {
    width: 600,
    color: { dark: '#000000', light: '#ffffff' }
  });
  await makeSvg(path.join(OUT, 'qr-business-card.svg'), SITE);

  // Van side — large, brand colour for the dark squares.
  // (Black still scans best, so we use that. If Big Ben wants brand orange,
  // I've left a commented-out alternative below.)
  await makePng(path.join(OUT, 'qr-van-large.png'), SITE, {
    width: 2400,
    color: { dark: '#000000', light: '#ffffff' }
  });
  await makeSvg(path.join(OUT, 'qr-van-large.svg'), SITE);

  // Optional brand-orange variant — readable but slightly lower contrast.
  // Print test before committing to a full wrap.
  await makePng(path.join(OUT, 'qr-van-orange.png'), SITE, {
    width: 2400,
    color: { dark: '#e85b14', light: '#ffffff' }
  });

  // Bonus: a "tap to call" QR that opens the phone dialler. Useful for
  // sticker on the dash, business card back, signage near forecourt.
  await makePng(path.join(OUT, 'qr-call-direct.png'), TEL, {
    width: 800,
    color: { dark: '#000000', light: '#ffffff' }
  });
  await makeSvg(path.join(OUT, 'qr-call-direct.svg'), TEL);

  console.log('\nDone. QR files are in qr/ — drop them straight into your design files.');
  console.log('Tip: print a test on plain paper at the final size and try scanning from 1–2 metres.');
})();
