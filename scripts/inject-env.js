const fs = require('fs');
const path = require('path');

const kvId = (process.env.BIAN_KV_ID || process.env.KV_ID || process.env.KV_NAMESPACE_ID || 'e6ff3eb3cbf44a49bd84c492bcdbfe99').trim();
const wranglerPath = path.join(__dirname, '..', 'wrangler.toml');

if (fs.existsSync(wranglerPath)) {
  let content = fs.readFileSync(wranglerPath, 'utf8');
  if (content.includes('BIAN_KV_ID_PLACEHOLDER')) {
    content = content.replace('BIAN_KV_ID_PLACEHOLDER', kvId);
    fs.writeFileSync(wranglerPath, content, 'utf8');
    console.log('[CI/CD] ✅ Successfully injected KV ID into wrangler.toml');
  }
}
