/**
 * Cloros Browser - Backend Server
 * Node.js + Express proxy server for web browsing
 */

const express = require('express');
const cors = require('cors');
const https = require('https');
const http = require('http');
const path = require('path');
const url = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Serve main HTML ───────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Proxy Route: fetches external pages ──────────────────────────
app.get('/proxy', (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: 'No URL provided' });
  }

  // Validate URL
  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  // Only allow http/https
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return res.status(400).json({ error: 'Only http/https allowed' });
  }

  const client = parsedUrl.protocol === 'https:' ? https : http;

  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'identity',
      'Connection': 'close',
    },
    timeout: 15000,
    rejectUnauthorized: false
  };

  const request = client.request(options, (response) => {
    // Handle redirects
    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      const location = response.headers.location;
      if (location) {
        const redirectUrl = location.startsWith('http') ? location : `${parsedUrl.protocol}//${parsedUrl.host}${location}`;
        return res.json({ redirect: redirectUrl });
      }
    }

    let data = '';
    response.setEncoding('utf8');

    response.on('data', (chunk) => { data += chunk; });

    response.on('end', () => {
      // Inject base tag and rewrite links for proxy
      const baseTag = `<base href="${targetUrl}">`;
      const injectedScript = `
        <script>
          // Intercept link clicks inside iframe
          document.addEventListener('click', function(e) {
            const a = e.target.closest('a');
            if (a && a.href && !a.href.startsWith('javascript:')) {
              e.preventDefault();
              e.stopPropagation();
              window.parent.postMessage({ type: 'navigate', url: a.href }, '*');
            }
          }, true);
          // Intercept form submits
          document.addEventListener('submit', function(e) {
            e.preventDefault();
            const form = e.target;
            const action = form.action || window.location.href;
            const method = (form.method || 'get').toLowerCase();
            if (method === 'get') {
              const params = new URLSearchParams(new FormData(form)).toString();
              window.parent.postMessage({ type: 'navigate', url: action + (params ? '?' + params : '') }, '*');
            }
          }, true);
        </script>
      `;

      // Inject base tag and scripts into HTML
      let modified = data
        .replace(/<head>/i, `<head>${baseTag}`)
        .replace(/<\/head>/i, `${injectedScript}</head>`);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(modified);
    });
  });

  request.on('timeout', () => {
    request.destroy();
    res.status(504).json({ error: 'Request timed out' });
  });

  request.on('error', (err) => {
    res.status(502).json({ error: `Failed to fetch: ${err.message}` });
  });

  request.end();
});

// ─── Screenshot / Metadata endpoint ───────────────────────────────
app.get('/favicon', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).end();

  try {
    const parsed = new URL(targetUrl);
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=32`;
    res.redirect(faviconUrl);
  } catch (e) {
    res.status(400).end();
  }
});

// ─── Start server ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌐 Cloros Browser running at http://localhost:${PORT}\n`);
});
