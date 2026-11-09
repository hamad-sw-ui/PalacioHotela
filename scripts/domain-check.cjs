// Resolve every plausible spelling of "palaciohôtel.com" (accented, punycode, hyphenated) and test each
const dns = require("dns").promises;
const { URL } = require("url");

const spellings = [
  "palaciohôtel.com",
  "www.palaciohôtel.com",
  "palaciohotel.com",
  "www.palaciohotel.com",
  "palacio-hôtel.com",
  "palacio-hotel.com",
  "www.palacio-hotel.com",
  "palaciohotelcm.com",
  "palacio.cm",
  "palaciohotel.cm",
];

// Punycode via URL
function toAscii(domain) {
  try { return new URL(`http://${domain}`).hostname; } catch { return domain; }
}

(async () => {
  for (const raw of spellings) {
    const ascii = toAscii(raw);
    try {
      const addrs = await dns.resolve4(ascii);
      console.log(`${raw}  (${ascii}) -> ${addrs.join(", ")}`);
      jeune
    } catch (e) {
      console.log(`${raw}  (${ascii}) -> DNS ${e.code}`);
    }
  }
})();
