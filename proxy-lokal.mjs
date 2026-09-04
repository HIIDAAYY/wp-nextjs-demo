// Hanya alat bantu sandbox: meneruskan permintaan browser ke situs asli,
// karena Chromium di container ini tidak punya akses keluar langsung.
import http from 'node:http';
const TARGET = 'https://headless-wp-nextjs-demo.vercel.app';
http.createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const r = await fetch(TARGET + req.url, {
      method: req.method,
      headers: { 'user-agent': req.headers['user-agent'] ?? 'pw', 'content-type': req.headers['content-type'] ?? '' },
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
      redirect: 'manual',
    });
    const buf = Buffer.from(await r.arrayBuffer());
    const h = {};
    r.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    res.writeHead(r.status, h);
    res.end(buf);
  } catch (e) { res.writeHead(502); res.end(String(e)); }
}).listen(8099, () => console.log('proxy siap di 8099'));
