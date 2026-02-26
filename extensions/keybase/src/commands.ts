/**
 * Keybase slash command advertisement and handler.
 *
 * Two categories:
 * 1. Core OpenClaw commands — advertised so Keybase shows autocomplete, but handled
 *    by the normal agent dispatch pipeline (they arrive as regular text).
 * 2. Keybase-specific config commands — intercepted here, update config via gateway
 *    patch, and reply with a confirmation without going to the agent.
 */

import type { Bot } from "@vrtx-labs/keybase-bot";

export type KeybaseCommandContext = {
  bot: Bot;
  accountId: string;
  target: string;
  rawChannel: { name: string; membersType?: string; topicName?: string };
};

// ---------------------------------------------------------------------------
// Command definitions
// ---------------------------------------------------------------------------

/** Commands handled natively by OpenClaw agent dispatch (just advertised here). */
const CORE_COMMANDS = [
  { name: "help", usage: "", description: "Show available commands." },
  { name: "status", usage: "", description: "Show current status (model, usage, session)." },
  { name: "model", usage: "[name]", description: "Switch model (e.g. sonnet, haiku)." },
  {
    name: "think",
    usage: "[level]",
    description: "Set thinking level: off, minimal, low, medium, high, xhigh.",
  },
  { name: "reasoning", usage: "[on|off|stream]", description: "Toggle reasoning visibility." },
  { name: "reset", usage: "", description: "Reset current session." },
  { name: "new", usage: "", description: "Start a new session." },
  { name: "stop", usage: "", description: "Stop the current run." },
  { name: "compact", usage: "[instructions]", description: "Compact session context." },
  { name: "skill", usage: "<name> [input]", description: "Run a skill by name." },
  { name: "usage", usage: "[mode]", description: "Show token/cost summary." },
  { name: "whoami", usage: "", description: "Show your sender id." },
  { name: "tts", usage: "[action]", description: "Control text-to-speech." },
  { name: "send", usage: "[on|off]", description: "Toggle send policy." },
  { name: "activation", usage: "[mention|always]", description: "Set group activation mode." },
];

/** Keybase-specific config commands — intercepted and handled by this module. */
export const KEYBASE_COMMANDS = [
  {
    name: "ack-react",
    usage: "[on|off|emoji]",
    description: "Set ack reaction on message receive (default: on / 👀).",
  },
  {
    name: "done-react",
    usage: "[on|off|emoji]",
    description: "Set done reaction on completion (default: on / ✅).",
  },
  {
    name: "error-react",
    usage: "[on|off|emoji]",
    description: "Set error reaction on failure (default: on / ❌).",
  },
  {
    name: "chunk",
    usage: "[limit]",
    description: "Set message chunk limit in chars (default: 10000).",
  },
  { name: "history", usage: "[n]", description: "Set history context window size (default: 20)." },
  { name: "lang", usage: "[code]", description: "Set response language (e.g. en, de, fr)." },
  {
    name: "markdown",
    usage: "[on|off]",
    description: "Toggle Keybase markdown formatting (default: on).",
  },
];

const ALL_COMMANDS = [...CORE_COMMANDS, ...KEYBASE_COMMANDS];

// ---------------------------------------------------------------------------
// Advertisement
// ---------------------------------------------------------------------------

/**
 * Advertise all commands to Keybase so they appear in slash-command autocomplete.
 * Called once after the bot initializes.
 */
export async function advertiseKeybaseCommands(bot: Bot): Promise<void> {
  await bot.chat.advertiseCommands({
    advertisements: [
      {
        type: "public",
        commands: ALL_COMMANDS.map((c) => ({
          name: c.name,
          description: c.description,
          usage: c.usage,
        })),
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/** Returns true if the message looks like a Keybase-specific command we handle. */
export function isKeybaseCommand(text: string): boolean {
  const first = text.trim().split(/\s+/)[0] ?? "";
  if (!first.startsWith("/")) return false;
  const cmd = first.slice(1).toLowerCase();
  return KEYBASE_COMMANDS.some((c) => c.name === cmd);
}

export type KeybaseCommandResult =
  | { handled: true; reply: string; configPatch?: Record<string, unknown> }
  | { handled: false };

/**
 * Handle a Keybase-specific config command.
 * Returns the reply text and an optional config patch to apply.
 */
export function handleKeybaseCommand(text: string, accountId: string): KeybaseCommandResult {
  const parts = text.trim().split(/\s+/);
  const cmd = (parts[0] ?? "").slice(1).toLowerCase();
  const arg = parts[1]?.toLowerCase() ?? "";

  // Helper to build config patch path for this account.
  const accountPath = (key: string) => `channels.keybase.accounts.${accountId}.${key}`;

  switch (cmd) {
    case "ack-react": {
      if (!arg) return { handled: true, reply: "Usage: /ack-react [on|off|emoji]" };
      const value = arg === "off" ? false : arg === "on" ? "👀" : parts[1]!;
      return {
        handled: true,
        reply: value === false ? "Ack reaction disabled." : `Ack reaction set to ${value}.`,
        configPatch: { [accountPath("ackReaction")]: value },
      };
    }
    case "done-react": {
      if (!arg) return { handled: true, reply: "Usage: /done-react [on|off|emoji]" };
      const value = arg === "off" ? false : arg === "on" ? "✅" : parts[1]!;
      return {
        handled: true,
        reply: value === false ? "Done reaction disabled." : `Done reaction set to ${value}.`,
        configPatch: { [accountPath("doneReaction")]: value },
      };
    }
    case "error-react": {
      if (!arg) return { handled: true, reply: "Usage: /error-react [on|off|emoji]" };
      const value = arg === "off" ? false : arg === "on" ? "❌" : parts[1]!;
      return {
        handled: true,
        reply: value === false ? "Error reaction disabled." : `Error reaction set to ${value}.`,
        configPatch: { [accountPath("errorReaction")]: value },
      };
    }
    case "chunk": {
      if (!arg) return { handled: true, reply: "Usage: /chunk <limit> (chars, default 10000)" };
      const limit = parseInt(arg, 10);
      if (isNaN(limit) || limit < 100)
        return { handled: true, reply: "Invalid limit. Must be a number >= 100." };
      return {
        handled: true,
        reply: `Chunk limit set to ${limit} chars.`,
        configPatch: { [accountPath("textChunkLimit")]: limit },
      };
    }
    case "history": {
      if (!arg) return { handled: true, reply: "Usage: /history <n> (messages, default 20)" };
      const n = parseInt(arg, 10);
      if (isNaN(n) || n < 0)
        return { handled: true, reply: "Invalid value. Must be a number >= 0." };
      return {
        handled: true,
        reply: `History context window set to ${n} messages.`,
        configPatch: { [accountPath("historyLimit")]: n },
      };
    }
    case "lang": {
      if (!arg) return { handled: true, reply: "Usage: /lang <code> (e.g. en, de, fr)" };
      return {
        handled: true,
        reply: `Response language set to "${arg}". (Applies as a system prompt hint on next message.)`,
        configPatch: { [accountPath("lang")]: arg },
      };
    }
    case "markdown": {
      if (arg !== "on" && arg !== "off")
        return { handled: true, reply: "Usage: /markdown [on|off]" };
      const value = arg === "on";
      return {
        handled: true,
        reply: `Keybase markdown formatting ${value ? "enabled" : "disabled"}.`,
        configPatch: { [accountPath("markdownFormatting")]: value },
      };
    }
    default:
      return { handled: false };
  }
}
