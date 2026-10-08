# P News 🇺🇸 (`@PolozNewss`)

Free Telegram news publisher for **P News** — US news in Russian via `@PolozNewsbot`.

- Format: photo + `⚡️` headline + 1–2 sentences + `👉 P News. Подписаться`
- No external article links, no source line in the caption
- Dedupe by link / title / similar story
- History seed keeps existing posts untouched

```bash
npm install
npm run seed:history   # once — mark old channel headlines as posted
npm run publish:once
npm run publish:forever
```

GitHub Actions: cron every 5 minutes (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID` secrets).
