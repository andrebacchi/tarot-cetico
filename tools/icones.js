// Gera os ícones do app a partir de tools/icone.svg:  NODE_PATH=... node tools/icones.js
const sharp = require('sharp'), fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..'), svg = fs.readFileSync(path.join(__dirname, 'icone.svg'));
const arredondado = n => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${n}" height="${n}"><rect width="${n}" height="${n}" rx="${n * 0.225}" fill="#fff"/></svg>`);
(async () => {
  const base = n => sharp(svg, { density: 300 }).resize(n, n);
  for (const n of [192, 512]) await base(n).composite([{ input: arredondado(n), blend: 'dest-in' }]).png().toFile(path.join(raiz, `icons/icon-${n}.png`));
  await base(64).composite([{ input: arredondado(64), blend: 'dest-in' }]).png().toFile(path.join(raiz, 'icons/favicon-64.png'));
  await base(180).flatten({ background: '#231636' }).png().toFile(path.join(raiz, 'icons/apple-touch-icon.png'));
  // Maskable: mesmo fundo até a borda, com o desenho menor para caber na área segura.
  const menor = Buffer.from(String(svg).replace('scale(1.12)', 'scale(.84)'));
  await sharp(menor, { density: 300 }).resize(512, 512).png().toFile(path.join(raiz, 'icons/icon-maskable-512.png'));
  console.log(fs.readdirSync(path.join(raiz, 'icons')).join(' '));
})();
