import type { Bot } from "@vrtx-labs/keybase-bot";

/**
 * Send a typing indicator for a Keybase channel.
 *
 * The keybase-bot SDK does not expose a public `setTyping` method, so we
 * invoke `_runApiCommand` via a type cast — same pattern the SDK uses internally.
 *
 * @param bot    - Live Bot instance
 * @param channel - Raw Keybase channel (name, membersType, topicName)
 * @param typing  - true to show typing, false to clear
 */
export async function setKeybaseTyping(
  bot: Bot,
  channel: { name: string; membersType?: string; topicName?: string },
  typing: boolean,
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (bot.chat as any)._runApiCommand({
      apiName: "chat",
      method: "typing",
      options: { channel, typing },
    });
  } catch {
    // Typing indicator errors are non-fatal; swallow silently.
  }
}

/**
 * Start a typing indicator and keep it alive until `stop()` is called.
 *
 * Keybase typing indicators auto-expire (≈5 s). This helper renews every 4 s.
 *
 * @returns  An object with a `stop()` method to clear the indicator.
 */
export function startTypingKeepAlive(
  bot: Bot,
  channel: { name: string; membersType?: string; topicName?: string },
): { stop: () => void } {
  let stopped = false;

  // Start immediately.
  void setKeybaseTyping(bot, channel, true);

  const interval = setInterval(() => {
    if (stopped) return;
    void setKeybaseTyping(bot, channel, true);
  }, 4000);

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(interval);
      // Best-effort clear.
      void setKeybaseTyping(bot, channel, false);
    },
  };
}
