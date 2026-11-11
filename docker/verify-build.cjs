// Fail packaging if a swallowed Gulp error leaves an incomplete build.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const root = path.resolve(process.argv[2]);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const match = html.match(/(v-\d+)\/js\/app-loader\.js/);
assert(match, 'index.html must point to a versioned app-loader');
const version = match[1];
for (const file of ['app-loader.js', 'app.js', 'libs.js', 'elements.js', 'templates.js']) {
    const content = fs.readFileSync(path.join(root, version, 'js', file), 'utf8');
    assert(content.length > 100, file + ' is empty');
    new vm.Script(content, {filename: file});
}
for (const file of ['styles/theme-taiga.css', 'locales/taiga/locale-en.json', 'emojis/emojis-data.json']) {
    assert(fs.statSync(path.join(root, version, file)).size > 100, file + ' is empty');
}
// Test-only e2e classes are stripped from release templates. Styling hooks must survive.
const templates = fs.readFileSync(path.join(root, version, 'js/templates.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, version, 'styles/theme-taiga.css'), 'utf8');
for (const selector of ['.pika-single.is-hidden', '.pika-single.is-bound', '.pika-table', '.pika-prev', '.pika-next']) {
    assert(styles.includes(selector), `Calendar base stylesheet missing: ${selector}`);
}
assert(templates.includes('tag-input-trigger'), 'Add tag must retain its styling hook in production templates');
assert(styles.includes('.tag-input-trigger'), 'Add tag styles must use the permanent styling hook');
for (const action of ['save', 'cancel']) {
    const hook = `editor-${action}-button`;
    assert(templates.includes(hook), `Editor ${action} must retain its styling hook in release templates`);
    assert(styles.includes('.' + hook), `Editor ${action} styles must use the permanent styling hook`);
    assert(!styles.includes('.e2e-' + action + '-editor'), `Editor ${action} styles must not depend on test classes`);
}
console.log('Verified frontend build: ' + version);
