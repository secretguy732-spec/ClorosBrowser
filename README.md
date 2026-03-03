# 🌐 Cloros Browser

A modern web browser built on the web — Chrome-inspired UI with real browsing capabilities.

## ✨ Features

- **Multi-tab browsing** — Open, close, switch tabs with animations
- **Proxy engine** — Fetches real websites via Node.js backend
- **Address bar** — Navigate to URLs or search automatically
- **Bookmarks** — Save & manage bookmarks with bookmark bar
- **History** — Full browsing history with search & clear
- **Dark/Light mode** — Toggle with 🌙/☀️ button
- **Incognito mode** — Private browsing (no history saved)
- **DevTools** — Console, network log, storage inspector
- **Settings** — Custom search engine, homepage, theme
- **PWA** — Installable as a desktop app
- **Keyboard shortcuts** — Ctrl+T, Ctrl+W, Ctrl+L, Alt+←/→, F5, F11
- **Session restore** — Remembers last visited URL
- **Responsive** — Works on desktop & mobile

## 🚀 Setup

### Prerequisites
- Node.js v16+ ([nodejs.org](https://nodejs.org))
- npm

### Install & Run

```bash
# 1. Clone / extract the project folder
cd cloros

# 2. Install dependencies
npm install

# 3. Start the server
npm run dev        # development (with auto-reload)
# OR
npm start          # production

# 4. Open in browser
# Navigate to: http://localhost:3000
```

## 📁 Project Structure

```
cloros/
├── server.js              # Express backend + proxy engine
├── package.json
├── public/
│   ├── index.html         # Main browser shell HTML
│   ├── manifest.json      # PWA manifest
│   ├── sw.js              # Service Worker
│   ├── css/
│   │   └── style.css      # All styles (Chrome-inspired)
│   ├── js/
│   │   └── app.js         # Browser engine (tabs, nav, UI)
│   └── icons/
│       └── logo.svg       # Cloros logo
└── README.md
```

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+T` | New tab |
| `Ctrl+W` | Close tab |
| `Ctrl+L` | Focus address bar |
| `Ctrl+R` / `F5` | Reload |
| `Ctrl+D` | Bookmark |
| `Ctrl+H` | History |
| `Ctrl+J` | Downloads |
| `Ctrl+I` | Incognito |
| `Alt+←` | Back |
| `Alt+→` | Forward |
| `F11` | Fullscreen |
| `Ctrl+1-9` | Switch tab |

## ⚠️ Notes

- Some websites block iframe embedding (X-Frame-Options / CSP). In those cases you'll see an error page.
- The proxy fetches HTML content — JavaScript-heavy SPAs may not render perfectly.
- For best results, use sites like Wikipedia, MDN, news sites, docs, etc.

## 🔒 Security

- Sandboxed iframes with `allow-same-origin allow-scripts allow-forms allow-popups`
- URL validation on both client and server
- Only HTTP/HTTPS protocols allowed
- No user data sent to third parties

## 📦 Dependencies

- `express` — Web server
- `cors` — Cross-origin headers
- `nodemon` — Dev hot-reload (dev only)
