# P News 🇺🇸 (`@PolozNewss`)

Free Telegram news publisher for **P News** — US news in Russian via `@PolozNewsbot`.

## Format

- Photo + `⚡️` / `❗️` headline
- 3–4 sentences of context (who / what / why), or flash headline-only
- Source line: `— The Hill`
- `💬` comment + `🔥` reaction CTAs
- `👉 P News. Подписаться`
- No external article links

## Features

- Politics + economy + tech + weather feeds
- National-relevance filter (drops tiny local races)
- RU polish for names/calques
- Stronger dedupe (EN + RU titles)
- Morning digest (`digest:morning`, cron 11:00 UTC)
- Pin + description (`ensure:channel`)
- Cross-promo to `@pbrasilagora` every ~48h
- Discussion group should stay linked in channel settings

```bash
npm install
npm run seed:history
npm run ensure:channel
npm run publish:once
npm run digest:morning
```

GitHub Actions secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID=@PolozNewss`.
