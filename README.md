# DrivePDF — Google Drive View-Only PDF Finder

Modern professional web app that scans educational websites for Google Drive PDF links (including view-only / restricted files) and lists them for easy access.

Built with **Next.js**, **Tailwind CSS**, and deployed on **Vercel**.

## Features

- Paste any educational page URL (or multiple links / Drive IDs)
- Automatically detects unit / chapter / section sub-pages
- Extracts all Google Drive file IDs from page HTML & iframes
- Clean dark UI with copy & open actions
- Serverless API on Vercel (no external backend needed)

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Deploy to Vercel

1. Push this repo to GitHub
2. Import the project in vercel.com
3. Deploy — zero config required

## API

### POST /api/scan

Body: `{ "url": "https://example.com/class-10-notes" }`

Returns list of found Drive PDFs with view links.

## Note

Full headless capture of view-only Drive PDFs is kept in the original Python tool (Playwright) because it needs long-running processes. This web app finds the links; use the Python script locally for bulk automated capture.

## License

MIT
