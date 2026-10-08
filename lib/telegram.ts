export type TelegramSendResult = {
  ok: true;
  messageId: number;
  chatId: string;
} | {
  ok: false;
  error: string;
};

type TelegramApiResponse = {
  ok?: boolean;
  description?: string;
  result?: { message_id?: number } | boolean | Record<string, unknown>;
};

async function telegramApi(
  token: string,
  method: string,
  body: Record<string, unknown>,
): Promise<TelegramApiResponse> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await response.json()) as TelegramApiResponse;
}

export async function sendTelegramMessage(input: {
  token: string;
  chatId: string;
  text: string;
  disableWebPagePreview?: boolean;
}): Promise<TelegramSendResult> {
  const body = await telegramApi(input.token, "sendMessage", {
    chat_id: input.chatId,
    text: input.text,
    disable_web_page_preview: input.disableWebPagePreview ?? true,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  });

  if (!body.ok) {
    return {
      ok: false,
      error: body.description ?? "Telegram sendMessage failed",
    };
  }

  const result = body.result as { message_id?: number };
  return {
    ok: true,
    messageId: result.message_id ?? 0,
    chatId: input.chatId,
  };
}

export async function sendTelegramPhoto(input: {
  token: string;
  chatId: string;
  photoUrl: string;
  caption: string;
}): Promise<TelegramSendResult> {
  const body = await telegramApi(input.token, "sendPhoto", {
    chat_id: input.chatId,
    photo: input.photoUrl,
    caption: input.caption,
    parse_mode: "HTML",
    show_caption_above_media: false,
  });

  if (!body.ok) {
    return {
      ok: false,
      error: body.description ?? "Telegram sendPhoto failed",
    };
  }

  const result = body.result as { message_id?: number };
  return {
    ok: true,
    messageId: result.message_id ?? 0,
    chatId: input.chatId,
  };
}

/** Seed a visible reaction pill on the post (Topor-style engagement). */
export async function seedMessageReaction(input: {
  token: string;
  chatId: string;
  messageId: number;
  emoji?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const body = await telegramApi(input.token, "setMessageReaction", {
    chat_id: input.chatId,
    message_id: input.messageId,
    reaction: [{ type: "emoji", emoji: input.emoji ?? "🔥" }],
  });
  if (!body.ok) {
    return { ok: false, error: body.description ?? "setMessageReaction failed" };
  }
  return { ok: true };
}

export async function getTelegramChat(input: {
  token: string;
  chatId: string;
}): Promise<{
  ok: boolean;
  error?: string;
  linkedChatId?: number;
  availableReactions?: unknown;
  title?: string;
}> {
  const body = await telegramApi(input.token, "getChat", {
    chat_id: input.chatId,
  });
  if (!body.ok) {
    return { ok: false, error: body.description ?? "getChat failed" };
  }
  const result = body.result as {
    linked_chat_id?: number;
    available_reactions?: unknown;
    title?: string;
  };
  return {
    ok: true,
    linkedChatId: result.linked_chat_id,
    availableReactions: result.available_reactions,
    title: result.title,
  };
}

/** Escape text for Telegram HTML parse_mode. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
