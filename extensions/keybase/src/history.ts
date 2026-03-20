import type { Bot } from "@vrtx-labs/keybase-bot";

export type KeybaseHistoryEntry = {
  messageId: string;
  senderUsername: string;
  text: string;
  timestamp: number;
};

/**
 * Fetch the last `limit` non-deleted messages from a Keybase channel.
 * Fetches `limit * 3` raw messages to account for deleted tombstones, then filters.
 * Never throws — all errors return an empty array.
 */
export async function fetchKeybaseHistory(params: {
  bot: Bot;
  channel: { name: string; membersType?: string; topicName?: string };
  limit: number;
}): Promise<KeybaseHistoryEntry[]> {
  const { bot, channel, limit } = params;
  if (limit <= 0) return [];

  try {
    // Fetch more than needed to account for deleted messages and tombstones.
    const fetchCount = Math.min(limit * 3, 200);
    const result = await bot.chat.read(channel, {
      pagination: { num: fetchCount },
    });

    const messages = result?.messages ?? [];
    const real: KeybaseHistoryEntry[] = [];

    for (const msg of messages) {
      const content = msg?.content;
      if (!content) continue;

      // Only keep text and attachment messages — skip delete tombstones, reactions, edits, etc.
      if (content.type === "text" && content.text?.body?.trim()) {
        real.push({
          messageId: String(msg.id),
          senderUsername: msg.sender?.username ?? "unknown",
          text: content.text.body.trim(),
          timestamp: msg.sentAt ? msg.sentAt * 1000 : 0,
        });
      } else if (content.type === "attachment" && content.attachment?.object?.title) {
        real.push({
          messageId: String(msg.id),
          senderUsername: msg.sender?.username ?? "unknown",
          text: `[attachment: ${content.attachment.object.title}]`,
          timestamp: msg.sentAt ? msg.sentAt * 1000 : 0,
        });
      }
      // Skip: delete, reaction, edit, system, etc.

      if (real.length >= limit) break;
    }

    // Messages come newest-first from the API; reverse to chronological order.
    return real.reverse();
  } catch {
    return [];
  }
}
