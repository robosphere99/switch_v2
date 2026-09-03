const fs = require('fs');
const path = require('path');

const docs = [
    ['api', '1-API-DOCUMENTATION.md'],
    ['hardware', '2-HARDWARE-DOCUMENTATION.md'],
    ['mobile', '3-MOBILE-APP-DOCUMENTATION.md'],
    ['git', '4-GIT-LOG-HISTORY.md'],
    ['flasher', '5-FLASHER-GUI-DOCUMENTATION.md'],
    ['admin', '6-ADMIN-FEATURES-DOCUMENTATION.md'],
    ['user', '7-USER-FEATURES-DOCUMENTATION.md'],
    ['promo', '8-FEATURES-PROMOTION.md'],
    ['report', '9-PROJECT-STATUS-REPORT.md'],
    ['portfolio', 'Portfolio-Summary.md'],
];

let js = '// Auto-generated\nwindow.DOCS = {\n';
for (const [key, fname] of docs) {
    const text = fs.readFileSync(path.join(__dirname, fname), 'utf-8');
    js += `  "${key}": ` + JSON.stringify(text) + ',\n';
}
js += '};\n';

fs.writeFileSync(path.join(__dirname, 'docs-data.js'), js, 'utf-8');
console.log('done node, size:', fs.statSync(path.join(__dirname, 'docs-data.js')).size);
