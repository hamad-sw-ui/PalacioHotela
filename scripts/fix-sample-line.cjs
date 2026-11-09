const fs = require("fs");
const src = fs.readFileSync("scripts/ai-chat.test.ts", "utf8");
// Rewrite the sample line correctly
const fixed = src.replace(
  /const sample = .*\];/,
  'const sample = [{ status: 200, body: { choices: [{ message: { content: "Bonjour ! Voici nos chambres." } }] } }];'
);
fs.writeFileSync("scripts/ai-chat.test.ts", fixed);
console.log("fixed", fixed.includes('const sample = [{ status: 200, body: { choices: [{ message: { content: "Bonjour ! Voici nos chambres." } }] } }];'));
