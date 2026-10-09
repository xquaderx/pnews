# P News 🇺🇸 (`@PolozNewss`)

Free Telegram news publisher for **P News** — US news in Russian via `@PolozNewsbot`.

## Format

- Photo + `⚡️` / `❗️` headline
- Detailed context for readers new to US news
- `💬` comment + `🔥` reaction CTAs
- `👉 P News. Подписаться`
- No external article links, no outlet name in the caption

## Features

- Politics + economy + tech + weather feeds
- National-relevance filter (drops tiny local races)
- RU polish for names/calques
- Stronger dedupe (EN + RU titles)
- Paced publishing: **10 regular posts/day**, **≥90 min apart**
  - Urgent/breaking (`important`) go **outside** that cap (up to 5/day, ≥20 min apart)
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
