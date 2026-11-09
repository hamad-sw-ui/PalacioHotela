const zlib = require("zlib");
function crc32(buf) {
  let table = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c; }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(60, 0); ihdr.writeUInt32BE(60, 4); ihdr[8] = 8; ihdr[9] = 2;
const raw = Buffer.alloc(60 * (1 + 60 * 3));
for (let y = 0; y < 60; y++) { raw[y * 181] = 0; for (let x = 0; x < 60; x++) { const o = y * 181 + 1 + x * 3; raw[o] = 30; raw[o + 1] = 120; raw[o + 2] = 200; } }
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
require("fs").writeFileSync("/tmp/test-image2.png", png);
console.log("PNG généré:", png.length, "octets");
