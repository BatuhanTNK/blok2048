const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace('<link rel="stylesheet" href="src/styles.css">', () => '<style>' + fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8') + '</style>');
for (const name of ['core', 'game']) {
  html = html.replace('<script src="src/' + name + '.js"></script>', () => '<script>' + fs.readFileSync(path.join(root, 'src', name + '.js'), 'utf8') + '</script>');
}
fs.writeFileSync(path.join(root, 'Blok 2048 - tek dosya.html'), html);
console.log('Tek dosyalık HTML önizlemesi hazır. Android dosyaları değiştirilmedi.');
