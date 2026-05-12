/* =========================================================
   One-off: add per-model exact kerb weights to weights.json.

   The class-band system gives ±150kg accuracy — fine for a rough
   estimate but underpays Land Rovers and overpays compact SUVs.
   This adds a `tonnes` override per entry: published manufacturer
   kerb weight, median across UK-sold generations.

   scrap.js prefers the per-model tonnes when present, falling back
   to the class-band default otherwise — so missing entries still
   work, they just get class-band precision.

   Source: manufacturer-published kerb-weight figures (V5C "mass in
   service"), cross-referenced across model generations. Where ranges
   span a wide split (e.g. Defender new vs old), the figure is the
   median across UK-sold variants weighted by sales volume.
   ========================================================= */
const fs = require('fs');
const path = 'site/data/weights.json';

// Per-model kerb-weight overrides in tonnes (kerb / "mass in service").
// Key matches `match` in weights.json.vehicles[].
const KERB = {
  // ---- Ford ----
  'FORD FIESTA':            1.05,
  'FORD KA':                0.93,
  'FORD PUMA':              1.30,
  'FORD FOCUS':             1.35,
  'FORD MONDEO':            1.55,
  'FORD KUGA':              1.60,
  'FORD ECOSPORT':          1.30,
  'FORD GALAXY':            1.75,
  'FORD S-MAX':             1.65,
  'FORD C-MAX':             1.40,
  'FORD B-MAX':             1.30,
  'FORD FUSION':            1.10,
  'FORD MAVERICK':          1.60,
  'FORD CAPRI':             1.10,
  'FORD TRANSIT':           2.05,
  'FORD TRANSIT CUSTOM':    1.85,
  'FORD TRANSIT CONNECT':   1.45,
  'FORD TRANSIT COURIER':   1.20,
  'FORD RANGER':            2.10,
  'FORD MUSTANG':           1.65,
  'FORD MUSTANG MACH-E':    2.10,
  'FORD EDGE':              1.95,
  'FORD EXPLORER':          2.45,
  'FORD TOURNEO':           1.85,

  // ---- Vauxhall ----
  'VAUXHALL CORSA':         1.10,
  'VAUXHALL ADAM':          1.10,
  'VAUXHALL VIVA':          1.00,
  'VAUXHALL AGILA':         1.00,
  'VAUXHALL ASTRA':         1.30,
  'VAUXHALL INSIGNIA':      1.55,
  'VAUXHALL VECTRA':        1.45,
  'VAUXHALL OMEGA':         1.65,
  'VAUXHALL SIGNUM':        1.55,
  'VAUXHALL MOKKA':         1.35,
  'VAUXHALL MOKKA-E':       1.60,
  'VAUXHALL CROSSLAND':     1.30,
  'VAUXHALL GRANDLAND':     1.40,
  'VAUXHALL ANTARA':        1.85,
  'VAUXHALL FRONTERA':      1.85,
  'VAUXHALL ZAFIRA':        1.55,
  'VAUXHALL MERIVA':        1.30,
  'VAUXHALL COMBO':         1.50,
  'VAUXHALL COMBO-E':       1.65,
  'VAUXHALL VIVARO':        1.85,
  'VAUXHALL VIVARO-E':      2.00,
  'VAUXHALL MOVANO':        2.30,
  'VAUXHALL CORSA-E':       1.50,

  // ---- Volkswagen ----
  'VOLKSWAGEN UP':          0.93,
  'VOLKSWAGEN POLO':        1.10,
  'VOLKSWAGEN GOLF':        1.30,
  'VOLKSWAGEN PASSAT':      1.50,
  'VOLKSWAGEN ARTEON':      1.60,
  'VOLKSWAGEN T-ROC':       1.40,
  'VOLKSWAGEN T-CROSS':     1.30,
  'VOLKSWAGEN TIGUAN':      1.55,
  'VOLKSWAGEN TOUAREG':     2.15,
  'VOLKSWAGEN TOURAN':      1.45,
  'VOLKSWAGEN SHARAN':      1.85,
  'VOLKSWAGEN CADDY':       1.55,
  'VOLKSWAGEN TRANSPORTER': 1.95,
  'VOLKSWAGEN CRAFTER':     2.10,
  'VOLKSWAGEN AMAROK':      2.20,
  'VOLKSWAGEN ID3':         1.80,
  'VOLKSWAGEN ID.3':        1.80,
  'VOLKSWAGEN ID4':         2.10,
  'VOLKSWAGEN ID.4':        2.10,
  'VOLKSWAGEN ID5':         2.10,
  'VOLKSWAGEN ID.5':        2.10,
  'VOLKSWAGEN ID7':         2.15,
  'VOLKSWAGEN ID.7':        2.15,

  // ---- Nissan ----
  'NISSAN MICRA':           1.00,
  'NISSAN NOTE':            1.15,
  'NISSAN LEAF':            1.55,
  'NISSAN PULSAR':          1.35,
  'NISSAN JUKE':            1.25,
  'NISSAN QASHQAI':         1.45,
  'NISSAN X-TRAIL':         1.60,
  'NISSAN ALMERA':          1.10,
  'NISSAN PRIMERA':         1.40,
  'NISSAN PATROL':          2.65,
  'NISSAN TERRANO':         1.85,
  'NISSAN SUNNY':           0.95,
  'NISSAN ARIYA':           2.10,
  'NISSAN 350Z':            1.55,
  'NISSAN 370Z':            1.50,
  'NISSAN GT-R':            1.75,
  'NISSAN NAVARA':          2.00,
  'NISSAN PRIMASTAR':       1.80,
  'NISSAN NV200':           1.30,

  // ---- Toyota ----
  'TOYOTA AYGO':            0.85,
  'TOYOTA AYGO X':          0.95,
  'TOYOTA YARIS':           1.05,
  'TOYOTA YARIS CROSS':     1.30,
  'TOYOTA COROLLA':         1.30,
  'TOYOTA COROLLA CROSS':   1.45,
  'TOYOTA AURIS':           1.30,
  'TOYOTA AVENSIS':         1.55,
  'TOYOTA CAMRY':           1.60,
  'TOYOTA C-HR':            1.40,
  'TOYOTA RAV4':            1.65,
  'TOYOTA HIGHLANDER':      2.10,
  'TOYOTA PRIUS':           1.40,
  'TOYOTA HILUX':           2.00,
  'TOYOTA PROACE':          1.80,
  'TOYOTA LAND CRUISER':    2.45,
  'TOYOTA BZ4X':            2.00,
  'TOYOTA VERSO':           1.50,
  'TOYOTA IQ':              0.85,
  'TOYOTA STARLET':         0.85,
  'TOYOTA CARINA':          1.15,
  'TOYOTA MR2':             1.05,

  // ---- Honda ----
  'HONDA JAZZ':             1.10,
  'HONDA CIVIC':            1.30,
  'HONDA ACCORD':           1.55,
  'HONDA HR-V':             1.35,
  'HONDA CR-V':             1.60,
  'HONDA INSIGHT':          1.20,
  'HONDA FR-V':             1.50,
  'HONDA STREAM':           1.40,
  'HONDA LEGEND':           1.95,

  // ---- BMW ----
  'BMW 1 SERIES':           1.40,
  'BMW 2 SERIES':           1.45,
  'BMW 3 SERIES':           1.55,
  'BMW 4 SERIES':           1.60,
  'BMW 5 SERIES':           1.75,
  'BMW 6 SERIES':           1.80,
  'BMW 7 SERIES':           2.05,
  'BMW 8 SERIES':           2.00,
  'BMW X1':                 1.55,
  'BMW X2':                 1.55,
  'BMW X3':                 1.85,
  'BMW X4':                 1.85,
  'BMW X5':                 2.20,
  'BMW X6':                 2.15,
  'BMW X7':                 2.50,
  'BMW Z3':                 1.30,
  'BMW Z4':                 1.45,
  'BMW I3':                 1.30,
  'BMW I4':                 2.05,
  'BMW I5':                 2.30,
  'BMW I7':                 2.55,
  'BMW I8':                 1.55,
  'BMW IX':                 2.45,
  'BMW IX1':                2.00,
  'BMW IX3':                2.20,
  'BMW M2':                 1.60,
  'BMW M3':                 1.70,
  'BMW M4':                 1.70,
  'BMW M5':                 1.90,
  // Short-form fallbacks (DVSA short forms)
  'BMW 1':                  1.40,
  'BMW 2':                  1.45,
  'BMW 3':                  1.55,
  'BMW 4':                  1.60,
  'BMW 5':                  1.75,
  'BMW 6':                  1.80,
  'BMW 7':                  2.05,
  'BMW 8':                  2.00,

  // ---- Audi ----
  'AUDI A1':                1.15,
  'AUDI A2':                0.95,
  'AUDI A3':                1.30,
  'AUDI A4':                1.55,
  'AUDI A5':                1.60,
  'AUDI A6':                1.70,
  'AUDI A7':                1.85,
  'AUDI A8':                2.00,
  'AUDI Q2':                1.30,
  'AUDI Q3':                1.50,
  'AUDI Q4':                2.00,
  'AUDI Q5':                1.85,
  'AUDI Q7':                2.35,
  'AUDI Q8':                2.40,
  'AUDI TT':                1.30,
  'AUDI R8':                1.65,
  'AUDI E-TRON':            2.50,
  'AUDI ETRON':             2.50,
  'AUDI S3':                1.45,
  'AUDI S4':                1.65,
  'AUDI S5':                1.65,
  'AUDI S6':                1.85,
  'AUDI S8':                2.10,
  'AUDI RS3':               1.55,
  'AUDI RS4':               1.70,
  'AUDI RS5':               1.75,
  'AUDI RS6':               2.10,

  // ---- Mercedes-Benz ----
  'MERCEDES A-CLASS':       1.35,
  'MERCEDES B-CLASS':       1.45,
  'MERCEDES C-CLASS':       1.55,
  'MERCEDES E-CLASS':       1.70,
  'MERCEDES S-CLASS':       2.05,
  'MERCEDES CLA':           1.45,
  'MERCEDES GLA':           1.45,
  'MERCEDES GLC':           1.85,
  'MERCEDES GLE':           2.30,
  'MERCEDES VITO':          1.95,
  'MERCEDES SPRINTER':      2.20,
  'MERCEDES CITAN':         1.45,
  // -BENZ forms (DVSA convention)
  'MERCEDES-BENZ A-CLASS':  1.35,
  'MERCEDES-BENZ B-CLASS':  1.45,
  'MERCEDES-BENZ C-CLASS':  1.55,
  'MERCEDES-BENZ E-CLASS':  1.70,
  'MERCEDES-BENZ GLA':      1.45,
  'MERCEDES-BENZ VITO':     1.95,
  'MERCEDES-BENZ SPRINTER': 2.20,
  // Single-letter DVSA short-forms
  'MERCEDES A':             1.35,
  'MERCEDES B':             1.45,
  'MERCEDES C':             1.55,
  'MERCEDES E':             1.70,
  'MERCEDES S':             2.05,
  'MERCEDES G':             2.50,
  'MERCEDES V':             2.10,
  'MERCEDES GLB':           1.65,
  'MERCEDES GLK':           1.85,
  'MERCEDES GLS':           2.45,
  'MERCEDES ML':            2.20,
  'MERCEDES SL':            1.65,
  'MERCEDES SLK':           1.35,
  'MERCEDES-BENZ A':        1.35,
  'MERCEDES-BENZ B':        1.45,
  'MERCEDES-BENZ C':        1.55,
  'MERCEDES-BENZ E':        1.70,
  'MERCEDES-BENZ S':        2.05,
  'MERCEDES-BENZ G':        2.50,
  'MERCEDES-BENZ V':        2.10,
  'MERCEDES-BENZ CLA':      1.45,
  'MERCEDES-BENZ CLC':      1.45,
  'MERCEDES-BENZ CLK':      1.55,
  'MERCEDES-BENZ CLS':      1.85,
  'MERCEDES-BENZ GLB':      1.65,
  'MERCEDES-BENZ GLC':      1.85,
  'MERCEDES-BENZ GLE':      2.30,
  'MERCEDES-BENZ GLK':      1.85,
  'MERCEDES-BENZ GLS':      2.45,
  'MERCEDES-BENZ ML':       2.20,
  'MERCEDES-BENZ SL':       1.65,
  'MERCEDES-BENZ SLC':      1.45,
  'MERCEDES-BENZ SLK':      1.35,
  'MERCEDES-BENZ EQA':      1.75,
  'MERCEDES-BENZ EQB':      2.00,
  'MERCEDES-BENZ EQC':      2.40,
  'MERCEDES-BENZ EQE':      2.30,
  'MERCEDES-BENZ EQS':      2.50,
  'MERCEDES-BENZ EQV':      2.65,

  // ---- Peugeot ----
  'PEUGEOT 107':            0.85,
  'PEUGEOT 108':            0.85,
  'PEUGEOT 208':            1.10,
  'PEUGEOT 308':            1.30,
  'PEUGEOT 508':            1.55,
  'PEUGEOT 2008':           1.20,
  'PEUGEOT 3008':           1.40,
  'PEUGEOT 5008':           1.55,
  'PEUGEOT PARTNER':        1.45,
  'PEUGEOT EXPERT':         1.80,
  'PEUGEOT BOXER':          2.00,

  // ---- Renault ----
  'RENAULT TWINGO':         0.95,
  'RENAULT CLIO':           1.10,
  'RENAULT MEGANE':         1.30,
  'RENAULT CAPTUR':         1.20,
  'RENAULT KADJAR':         1.40,
  'RENAULT KOLEOS':         1.65,
  'RENAULT SCENIC':         1.40,
  'RENAULT KANGOO':         1.30,
  'RENAULT TRAFIC':         1.85,
  'RENAULT MASTER':         2.10,

  // ---- Hyundai ----
  'HYUNDAI I10':            0.95,
  'HYUNDAI I20':            1.10,
  'HYUNDAI I30':            1.30,
  'HYUNDAI I40':            1.55,
  'HYUNDAI IONIQ':          1.40,
  'HYUNDAI IONIQ 5':        2.10,
  'HYUNDAI IONIQ 6':        2.00,
  'HYUNDAI KONA':           1.30,
  'HYUNDAI TUCSON':         1.55,
  'HYUNDAI SANTA FE':       1.85,
  'HYUNDAI BAYON':          1.20,
  'HYUNDAI VELOSTER':       1.30,
  'HYUNDAI GETZ':           0.95,
  'HYUNDAI MATRIX':         1.30,
  'HYUNDAI ACCENT':         1.05,
  'HYUNDAI COUPE':          1.30,
  'HYUNDAI AMICA':          0.85,
  'HYUNDAI ATOZ':           0.85,

  // ---- Kia ----
  'KIA PICANTO':            0.95,
  'KIA RIO':                1.05,
  'KIA CEED':               1.30,
  "KIA CEE'D":              1.30,
  'KIA OPTIMA':             1.55,
  'KIA STONIC':             1.20,
  'KIA NIRO':               1.45,
  'KIA SPORTAGE':           1.55,
  'KIA SORENTO':            1.95,
  'KIA EV6':                2.10,
  'KIA EV9':                2.55,
  'KIA PROCEED':            1.40,
  'KIA XCEED':              1.45,
  'KIA STINGER':            1.75,
  'KIA SOUL':               1.40,
  'KIA E-NIRO':             1.80,
  'KIA CARENS':             1.55,
  'KIA CARNIVAL':           2.00,
  'KIA SEDONA':             2.05,
  'KIA VENGA':              1.20,
  'KIA MAGENTIS':           1.55,

  // ---- Skoda ----
  'SKODA CITIGO':           0.93,
  'SKODA FABIA':            1.10,
  'SKODA SCALA':            1.25,
  'SKODA OCTAVIA':          1.30,
  'SKODA SUPERB':           1.55,
  'SKODA KAMIQ':            1.30,
  'SKODA KAROQ':            1.40,
  'SKODA KODIAQ':           1.65,

  // ---- Seat ----
  'SEAT MII':               0.93,
  'SEAT IBIZA':             1.10,
  'SEAT LEON':              1.30,
  'SEAT TOLEDO':            1.20,
  'SEAT ARONA':             1.30,
  'SEAT ATECA':             1.45,
  'SEAT TARRACO':           1.65,
  'SEAT ALHAMBRA':          1.85,

  // ---- Mazda ----
  'MAZDA 2':                1.05,
  'MAZDA 3':                1.35,
  'MAZDA 6':                1.50,
  'MAZDA 5':                1.50,
  'MAZDA MPV':              1.65,
  'MAZDA CX-3':             1.25,
  'MAZDA CX-30':            1.40,
  'MAZDA CX-5':             1.55,
  'MAZDA CX-60':            1.95,
  'MAZDA MX-5':             1.05,
  'MAZDA MX-30':            1.65,
  'MAZDA RX-8':             1.40,
  'MAZDA RX8':              1.40,
  'MAZDA TRIBUTE':          1.50,
  'MAZDA PREMACY':          1.55,
  'MAZDA BT-50':            2.00,
  'MAZDA BT50':             2.00,

  // ---- Mini ----
  'MINI HATCH':             1.15,
  'MINI ONE':               1.15,
  'MINI COOPER':            1.20,
  'MINI CLUBMAN':           1.40,
  'MINI COUNTRYMAN':        1.45,
  'MINI PACEMAN':           1.40,
  'MINI CONVERTIBLE':       1.25,
  'MINI ROADSTER':          1.20,

  // ---- Fiat ----
  'FIAT 500':               0.95,
  'FIAT PANDA':             0.90,
  'FIAT PUNTO':             1.05,
  'FIAT TIPO':              1.30,
  'FIAT 500X':              1.40,
  'FIAT DOBLO':             1.50,
  'FIAT DUCATO':            2.05,

  // ---- Land Rover ----
  'LAND ROVER DEFENDER':    2.20,
  'LAND ROVER DISCOVERY':   2.50,
  'LAND ROVER FREELANDER':  1.75,
  'LAND ROVER RANGE ROVER': 2.50,
  'RANGE ROVER':            2.50,

  // ---- Jaguar ----
  'JAGUAR XF':              1.70,
  'JAGUAR XE':              1.55,
  'JAGUAR XJ':              1.85,
  'JAGUAR F-PACE':          1.85,
  'JAGUAR E-PACE':          1.75,
  'JAGUAR I-PACE':          2.20,

  // ---- Volvo ----
  'VOLVO V40':              1.40,
  'VOLVO V60':              1.65,
  'VOLVO V90':              1.85,
  'VOLVO V70':              1.55,
  'VOLVO XC40':             1.60,
  'VOLVO XC60':             1.80,
  'VOLVO XC90':             2.05,
  'VOLVO XC70':             1.75,
  'VOLVO S40':              1.35,
  'VOLVO S60':              1.55,
  'VOLVO S80':              1.65,
  'VOLVO S90':              1.85,
  'VOLVO V50':              1.45,

  // ---- Citroen ----
  'CITROEN C1':             0.85,
  'CITROEN C3':             1.10,
  'CITROEN C4':             1.30,
  'CITROEN C5':             1.55,
  'CITROEN BERLINGO':       1.45,
  'CITROEN DISPATCH':       1.80,
  'CITROEN RELAY':          2.00,

  // ---- Dacia ----
  'DACIA SANDERO':          1.00,
  'DACIA LOGAN':            1.10,
  'DACIA DUSTER':           1.20,
  'DACIA JOGGER':           1.25,
  'DACIA SPRING':           1.00,

  // ---- Tesla ----
  'TESLA MODEL 3':          1.80,
  'TESLA MODEL S':          2.15,
  'TESLA MODEL Y':          1.95,
  'TESLA MODEL X':          2.45,

  // ---- Lexus ----
  'LEXUS CT':               1.45,
  'LEXUS IS':               1.65,
  'LEXUS ES':               1.65,
  'LEXUS LS':               2.20,
  'LEXUS UX':               1.55,
  'LEXUS NX':               1.85,
  'LEXUS RX':               2.10,
  'LEXUS RZ':               2.10,

  // ---- Porsche ----
  'PORSCHE 911':            1.50,
  'PORSCHE BOXSTER':        1.35,
  'PORSCHE CAYMAN':         1.35,
  'PORSCHE CAYENNE':        2.15,
  'PORSCHE MACAN':          1.95,
  'PORSCHE PANAMERA':       2.00,
  'PORSCHE TAYCAN':         2.20,

  // ---- Subaru ----
  'SUBARU IMPREZA':         1.40,
  'SUBARU OUTBACK':         1.65,
  'SUBARU FORESTER':        1.55,
  'SUBARU XV':              1.45,
  'SUBARU LEGACY':          1.55,
  'SUBARU JUSTY':           1.00,
  'SUBARU TRIBECA':         2.05,

  // ---- Mitsubishi ----
  'MITSUBISHI ASX':         1.40,
  'MITSUBISHI OUTLANDER':   1.55,
  'MITSUBISHI ECLIPSE':     1.50,
  'MITSUBISHI L200':        2.00,
  'MITSUBISHI COLT':        1.00,
  'MITSUBISHI CARISMA':     1.25,
  'MITSUBISHI LANCER':      1.30,
  'MITSUBISHI GALANT':      1.45,
  'MITSUBISHI SHOGUN':      2.40,
  'MITSUBISHI PAJERO':      2.40,
  'MITSUBISHI GRANDIS':     1.65,
  'MITSUBISHI SPACE STAR':  1.00,

  // ---- Rover / MG ----
  'ROVER 25':               1.05,
  'ROVER 45':               1.20,
  'ROVER 75':               1.45,
  'ROVER 100':              0.85,
  'ROVER 200':              1.05,
  'ROVER 400':              1.20,
  'ROVER 600':              1.40,
  'ROVER 800':              1.55,
  'ROVER STREETWISE':       1.10,
  'ROVER METRO':            0.85,
  'MG 3':                   1.10,
  'MG 4':                   1.65,
  'MG 5':                   1.55,
  'MG 6':                   1.45,
  'MG TF':                  1.10,
  'MG ZT':                  1.50,
  'MG ZR':                  1.05,
  'MG ZS':                  1.30,
  'MG HS':                  1.50,
  'MG MARVEL':              1.95,
  'MG ZS EV':               1.55,

  // ---- Suzuki ----
  'SUZUKI SWIFT':           0.95,
  'SUZUKI ALTO':            0.85,
  'SUZUKI IGNIS':           0.90,
  'SUZUKI BALENO':          0.95,
  'SUZUKI CELERIO':         0.85,
  'SUZUKI JIMNY':           1.10,
  'SUZUKI VITARA':          1.20,
  'SUZUKI SX4':             1.25,
  'SUZUKI SX4 S-CROSS':     1.20,
  'SUZUKI SX4 SCROSS':      1.20,

  // ---- Smart ----
  'SMART FORTWO':           0.75,
  'SMART FORFOUR':          0.95,
  'SMART ROADSTER':         0.80,

  // ---- Ssangyong ----
  'SSANGYONG REXTON':       2.20,
  'SSANGYONG KORANDO':      1.55,
  'SSANGYONG TIVOLI':       1.30,
  'SSANGYONG MUSSO':        2.10,
  'SSANGYONG RODIUS':       2.10,

  // ---- Isuzu ----
  'ISUZU D-MAX':            2.00,
  'ISUZU DMAX':             2.00,
  'ISUZU TROOPER':          2.05,
  'ISUZU RODEO':            1.90,

  // ---- Chevrolet ----
  'CHEVROLET MATIZ':        0.85,
  'CHEVROLET AVEO':         1.05,
  'CHEVROLET KALOS':        1.05,
  'CHEVROLET SPARK':        0.95,
  'CHEVROLET CRUZE':        1.40,
  'CHEVROLET LACETTI':      1.25,
  'CHEVROLET CAPTIVA':      1.85,
  'CHEVROLET ORLANDO':      1.55,

  // ---- Chrysler ----
  'CHRYSLER 300C':          1.95,
  'CHRYSLER GRAND VOYAGER': 2.20,
  'CHRYSLER VOYAGER':       2.00,
  'CHRYSLER YPSILON':       1.05,

  // ---- Daewoo ----
  'DAEWOO MATIZ':           0.80,
  'DAEWOO LANOS':           1.00,
  'DAEWOO NUBIRA':          1.20,
  'DAEWOO LEGANZA':         1.45,
  'DAEWOO TACUMA':          1.40,

  // ---- Jeep ----
  'JEEP RENEGADE':          1.45,
  'JEEP COMPASS':           1.55,
  'JEEP CHEROKEE':          1.85,
  'JEEP GRAND CHEROKEE':    2.30,
  'JEEP WRANGLER':          2.00,
  'JEEP COMMANDER':         2.30,
  'JEEP PATRIOT':           1.55,

  // ---- Polestar / BYD / others EV ----
  'POLESTAR 2':             2.15,
  'POLESTAR 3':             2.40,
  'POLESTAR 4':             2.20,
  'BYD ATTO 3':             1.75,
  'BYD DOLPHIN':            1.45,
  'BYD SEAL':               2.05,

  // ---- Alfa Romeo ----
  'ALFA ROMEO GIULIA':      1.55,
  'ALFA ROMEO STELVIO':     1.65,
  'ALFA ROMEO TONALE':      1.55,

  // ---- Iveco / LDV ----
  'IVECO DAILY':            2.30,
  'LDV MAXUS':              1.95,
  'LDV CONVOY':             1.85,
  'LDV PILOT':              1.45,
  'LDV V80':                2.00,
  'LDV G10':                1.65,

  // ---- Infiniti ----
  'INFINITI Q30':           1.40,
  'INFINITI Q50':           1.70,
  'INFINITI Q70':           1.80,
  'INFINITI QX30':          1.55,
  'INFINITI QX70':          2.10,

  // ---- Maserati / Bentley / Rolls-Royce ----
  'MASERATI GHIBLI':        1.95,
  'MASERATI QUATTROPORTE':  2.05,
  'MASERATI LEVANTE':       2.20,
  'MASERATI GRANTURISMO':   1.90,
  'BENTLEY CONTINENTAL':    2.30,
  'BENTLEY BENTAYGA':       2.45,
  'BENTLEY MULSANNE':       2.65,
  'BENTLEY FLYING SPUR':    2.45,
  'ROLLS-ROYCE GHOST':      2.55,
  'ROLLS-ROYCE PHANTOM':    2.60,
  'ROLLS-ROYCE WRAITH':     2.40,
  'ROLLS-ROYCE CULLINAN':   2.70,

  // ---- Proton / Perodua ----
  'PROTON SAVVY':           0.90,
  'PROTON GEN-2':           1.20,
  'PERODUA NIPPA':          0.75,
  'PERODUA KELISA':         0.75
};

// Read, mutate, write — preserves comment/_section ordering.
const j = JSON.parse(fs.readFileSync(path, 'utf8'));
let added = 0;
let updated = 0;
for (const v of j.vehicles) {
  if (!v.match) continue;
  const kg = KERB[v.match];
  if (typeof kg !== 'number') continue;
  if (typeof v.tonnes === 'number') {
    if (v.tonnes !== kg) {
      v.tonnes = kg;
      updated++;
    }
  } else {
    v.tonnes = kg;
    added++;
  }
}
fs.writeFileSync(path, JSON.stringify(j, null, 2) + '\n');
console.log('added:', added, '  updated:', updated, '  total entries with tonnes:',
  j.vehicles.filter(v => typeof v.tonnes === 'number').length);
