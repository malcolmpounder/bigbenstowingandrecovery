/* Build CLIENT_FIRST_QUESTIONS.docx — the 10-question initial sheet to send Big Ben. */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel,
  LevelFormat, BorderStyle, PageOrientation
} = require('docx');

// Visual writing line — empty paragraph with a subtle bottom border
function ruledLine() {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    border: {
      bottom: { color: 'BFBFBF', space: 1, style: BorderStyle.SINGLE, size: 6 }
    },
    children: [new TextRun({ text: '' })]
  });
}

// One question block: label + body + 3 ruled reply lines
function questionBlock(num, label, body) {
  return [
    new Paragraph({
      numbering: { reference: 'questions', level: 0 },
      spacing: { before: 240, after: 80 },
      children: [
        new TextRun({ text: label + ' ', bold: true }),
        new TextRun({ text: body })
      ]
    }),
    ruledLine(),
    ruledLine(),
    ruledLine()
  ];
}

const QUESTIONS = [
  ['Phone & WhatsApp.', 'Is 07754 984 147 your 24/7 number? Is WhatsApp set up on the same number?'],
  ['Email forwarding.', 'info@bigbenstowingandrecovery.co.uk will be set up shortly. Where should it forward to? (Your existing Gmail or personal email — please supply the address.)'],
  ['Hours.', 'Is "24/7" genuinely round-the-clock, or are there windows you definitely won’t answer? It’s better to be honest on the site than to overpromise.'],
  ['Insurance.', 'Please send your goods-in-transit policy provider and cover amount per vehicle, and your public liability cover amount. We will match the website wording to your actual policy.'],
  ['Pricing.', 'Please confirm or correct (these figures are NOT shown on the public site — they\'re only used by the calculator and to confirm jobs by phone): £1.75 per mile (kept private at your request), £40 minimum on local jobs, +20% surcharge for urgent/priority dispatch, +15% surcharge for classics or low-clearance vehicles.'],
  ['Scrap pricing.', 'Please confirm or correct (the £60/tonne IS shown publicly; the per-mile collection rate is NOT): flat £60/tonne (DVLA-derived kerb weight), £60 bonus for original cat, £25 bonus for factory alloys, £20 deducted if no V5C, free collection within 15 miles of base then £1.75/mile beyond (kept private), £30 minimum payout.'],
  ['Card payments.', 'Do you have a Stripe account already set up? And do you carry a card reader (SumUp, Square or Stripe Reader) for on-the-spot payment? If not, we will need to set those up before launch.'],
  ['Photos.', 'The seven photos on the site (Jaguar, Mercedes, motorbike, van, branded truck, night shot, logo) — are they yours with permission to use? Any newer or better photos to add?'],
  ['Google Business Profile.', 'Do you have one already? Please send the link. If not, please set one up — it is free, takes ten minutes, and lets us pull live reviews onto the site.'],
  ['DVLA reg lookup.', 'The scrap calculator looks up any UK reg automatically (make, model, year) via the DVLA’s free API. We need you to apply for a free API key — it takes 5–10 working days. Are you OK to apply? I will send you the link.'],
  ['Daily summary email.', 'Would you find it useful to receive one email at 7am each day with: yesterday’s completed jobs, today’s booked jobs (deposit paid + pending), week-to-date income, and any flagged issues? It is no extra cost — just a switch we can flick on. If yes, what email address should it go to?']
];

const children = [];

children.push(new Paragraph({
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 0, after: 80 },
  children: [new TextRun({ text: 'Big Ben’s Towing & Recovery', bold: true })]
}));

children.push(new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 0, after: 240 },
  children: [new TextRun({ text: 'Initial Questions — Website Launch Checklist' })]
}));

children.push(new Paragraph({
  spacing: { after: 240 },
  children: [
    new TextRun({
      text: 'Hi Ben — site’s coming along well. Just 10 quick decisions to lock things down before launch. Detailed answers aren’t needed — confirms or corrections will do. Reply by phone, text, email or write straight on this sheet.'
    })
  ]
}));

QUESTIONS.forEach(([label, body], i) => {
  questionBlock(i + 1, label, body).forEach(p => children.push(p));
});

children.push(new Paragraph({
  spacing: { before: 360, after: 0 },
  children: [
    new TextRun({ text: 'Thanks Ben — once these are in we can finalise the launch.', italics: true })
  ]
}));

const doc = new Document({
  creator: "Big Ben's Towing & Recovery",
  title: 'Initial Questions',
  styles: {
    default: { document: { run: { font: 'Calibri', size: 22 } } }, // 11pt
    paragraphStyles: [
      {
        id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 36, bold: true, font: 'Calibri' },
        paragraph: { spacing: { before: 0, after: 80 }, outlineLevel: 0 }
      },
      {
        id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 24, bold: false, color: '666666', font: 'Calibri' },
        paragraph: { spacing: { before: 0, after: 240 }, outlineLevel: 1 }
      }
    ]
  },
  numbering: {
    config: [{
      reference: 'questions',
      levels: [{
        level: 0,
        format: LevelFormat.DECIMAL,
        text: '%1.',
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } }
      }]
    }]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT }, // A4
        margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } // ~2cm
      }
    },
    children
  }]
});

const outPath = path.resolve(__dirname, '..', 'CLIENT_FIRST_QUESTIONS.docx');
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(outPath, buf);
  console.log('Wrote ' + outPath + ' (' + buf.length + ' bytes)');
});
