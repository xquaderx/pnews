/**
 * One-shot channel hygiene: description + pinned intro.
 * Idempotent via file kv. Does not delete or edit old news posts.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createFileKv } from "../lib/file-kv.js";
import { buildPinText } from "../lib/post-format.js";
import {
  getTelegramChat,
  pinTelegramMessage,
  sendTelegramMessage,
  setTelegramChatDescription,
} from "../lib/telegram.js";

function loadEnvFile(path: string): void {
  try {
    const text = readFileSync(path, "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1]!;
      let val = m[2]!;
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    // optional
  }
}

loadEnvFile(resolve(".env.local"));
loadEnvFile(resolve(".env"));

const PIN_KEY = "meta:pin-message";
const DESC =
  "P News 🇺🇸 — новости из США: политика, экономика, tech, ЧП. Коротко, с контекстом. Комментируйте под постами · t.me/PolozNewss";

async function main(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHANNEL_ID?.trim();
  if (!token || !chatId) {
    throw new Error("Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID");
  }

  const kv = createFileKv(resolve("data/posted-kv.json"));
  const desc = await setTelegramChatDescription({
    token,
    chatId,
    description: DESC,
  });
  const descOk =
    desc.ok ||
    /not modified/i.test(desc.error ?? "");
  console.log(JSON.stringify({ description: { ok: descOk, error: desc.error } }));

  const chat = await getTelegramChat({ token, chatId });
  console.log(
    JSON.stringify({
      discussion_linked: Boolean(chat.linkedChatId),
      linkedChatId: chat.linkedChatId ?? null,
      note: chat.linkedChatId
        ? "Discussion group already linked — add @PolozNewsbot as admin there so the bot can moderate comments."
        : "Enable Discussion in channel settings and add @PolozNewsbot to the group.",
    }),
  );

  // Prefer live pinned_message over kv (Actions cache may miss local pin).
  if (chat.pinnedMessageId) {
    await kv.put(PIN_KEY, {
      messageId: chat.pinnedMessageId,
      at: new Date().toISOString(),
    });
    console.log(
      JSON.stringify({ pin: "already_pinned", messageId: chat.pinnedMessageId }),
    );
    return;
  }

  const existing = (await kv.get(PIN_KEY)) as { messageId?: number } | undefined;
  if (existing?.messageId) {
    const pinned = await pinTelegramMessage({
      token,
      chatId,
      messageId: existing.messageId,
      disableNotification: true,
    });
    console.log(
      JSON.stringify({
        pin: pinned.ok ? "re-pinned" : "pin_missing",
        messageId: existing.messageId,
        error: pinned.error,
      }),
    );
    if (pinned.ok) return;
  }

  const sent = await sendTelegramMessage({
    token,
    chatId,
    text: buildPinText(),
  });
  if (!sent.ok) {
    console.error(JSON.stringify({ pin_failed: sent.error }));
    process.exit(1);
  }
  const pinned = await pinTelegramMessage({
    token,
    chatId,
    messageId: sent.messageId,
    disableNotification: true,
  });
  if (!pinned.ok) {
    console.error(JSON.stringify({ pin_failed: pinned.error, messageId: sent.messageId }));
    process.exit(1);
  }
  await kv.put(PIN_KEY, {
    messageId: sent.messageId,
    at: new Date().toISOString(),
  });
  console.log(JSON.stringify({ pin: "ok", messageId: sent.messageId }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
