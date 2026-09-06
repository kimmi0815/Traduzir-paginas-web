// Local UI acceptance harness. Serves production HTML/CSS/JS with a fake extension API.
// It does not load or change the user's installed extension or contact translation providers.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
const source = resolve('src');
const qa = resolve('qa/ui-design');
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml' };
const motionFiles = new Set(['/motion-preview.html','/motion-preview.css','/motion-preview.js',
  '/motion-sample.html','/motion-sample.css','/motion-sample.js','/motion-sample-bootstrap.js']);
export function createPreviewServer() { return http.createServer(async (req,res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname === '/' ? '/popup/old-popup.html' : decodeURIComponent(url.pathname);
    const motion = motionFiles.has(path);
    const fixture = motion || ['/fixture.js','/preview.html','/preview.js','/rounded-popup.html','/rounded-popup.js'].includes(path);
    const root = fixture ? qa : source;
    const file = resolve(root, '.' + path);
    if (!file.startsWith(root + '/')) { res.writeHead(403).end(); return; }
    let data = await readFile(file);
    if (!motion && extname(file) === '.html') data = data.toString().replace('<head>', '<head><script src="/fixture.js"></script>');
    res.writeHead(200, {'Content-Type':mime[extname(file)] || 'application/octet-stream','Cache-Control':'no-store'}).end(data);
  } catch { res.writeHead(404).end('Not found'); }
}); }
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.TWP_UI_PORT || 4190);
  createPreviewServer().listen(port, '127.0.0.1', () => console.log(`Native UI QA: http://127.0.0.1:${port}/`));
}
