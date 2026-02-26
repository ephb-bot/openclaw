import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  GROUP_POLICY_BLOCKED_LABEL,
  createReplyPrefixOptions,
  logInboundDrop,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveControlCommandGate,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
  type OpenClawConfig,
  type RuntimeEnv,
  chunkTextForOutbound,
  type ChunkMode,
} from "openclaw/plugin-sdk";
import { getLiveBot } from "./bot-client.js";
import { handleKeybaseCommand, isKeybaseCommand } from "./commands.js";
import { markdownToKeybase } from "./format.js";
import { fetchKeybaseHistory } from "./history.js";
import { normalizeKeybaseAllowEntry } from "./normalize.js";
import { getKeybaseRuntime } from "./runtime.js";
import { sendMessageKeybase } from "./send.js";
import type { CoreConfig, KeybaseInboundMessage, ResolvedKeybaseAccount } from "./types.js";
import { startTypingKeepAlive } from "./typing.js";

const BRAINDUMP_DIR = join(process.env["HOME"] ?? "/root", ".openclaw", "workspace", "braindump");
const BRAINDUMP_INDEX = join(BRAINDUMP_DIR, ".index.json");
const BRAINDUMP_TEAM = "coexistence";
const BRAINDUMP_CHANNEL = "braindump";
const BRAINDUMP_SENDER = "bontemps";

/**
 * Read the braindump index file, returning a parsed object.
 * Returns an empty object if the file doesn't exist or is malformed.
 */
async function readBraindumpIndex(): Promise<Record<string, string>> {
  try {
    const raw = await readFile(BRAINDUMP_INDEX, "utf8");
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

/**
 * Write the braindump index file atomically (best-effort).
 */
async function writeBraindumpIndex(index: Record<string, string>): Promise<void> {
  await writeFile(BRAINDUMP_INDEX, JSON.stringify(index, null, 2), "utf8");
}

/**
 * Immediately write a braindump message to a file in the workspace braindump directory.
 * Also records a messageId → filename entry in the index for later deletion.
 * This runs before any agent processing to ensure reliable capture.
 */
async function captureBraindump(
  message: KeybaseInboundMessage,
  log?: (msg: string) => void,
): Promise<void> {
  try {
    const now = new Date(message.timestamp);
    // Format in Europe/Berlin timezone.
    const tzFormatter = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Berlin",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = tzFormatter.formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const year = get("year");
    const month = get("month");
    const day = get("day");
    const hour = get("hour");
    const minute = get("minute");

    const text = message.text?.trim() ?? "";

    // Build slug from first ~5 words.
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 5);
    const slug = words.join("-") || "note";

    const filename = `${year}-${month}-${day}-${hour}-${minute}-${slug}.md`;
    const title = words.join(" ");
    const dateStr = `${year}-${month}-${day} ${hour}:${minute}`;

    const content = `# ${title}\n\nDate: ${dateStr}\n\n${text}\n`;

    await mkdir(BRAINDUMP_DIR, { recursive: true });
    await writeFile(join(BRAINDUMP_DIR, filename), content, "utf8");
    log?.(`keybase: braindump captured → ${filename}`);

    // Update the index: messageId → filename (read-modify-write).
    try {
      const index = await readBraindumpIndex();
      index[message.messageId] = filename;
      await writeBraindumpIndex(index);
    } catch (indexErr) {
      log?.(`keybase: braindump index update failed: ${String(indexErr)}`);
    }
  } catch (err) {
    // Log but never throw — capture failure must not block agent processing.
    log?.(`keybase: braindump capture failed: ${String(err)}`);
  }
}

/**
 * Delete a braindump file by message ID, using the index to locate it.
 * Removes the index entry afterwards. Never throws.
 */
export async function deleteBraindump(
  messageId: number | string,
  log?: (msg: string) => void,
): Promise<void> {
  try {
    const key = String(messageId);
    const index = await readBraindumpIndex();
    const filename = index[key];
    if (!filename) {
      log?.(`keybase: braindump delete: no index entry for message ${key}`);
      return;
    }

    // Delete the file (ignore if already gone).
    try {
      await rm(join(BRAINDUMP_DIR, filename), { force: true });
      log?.(`keybase: braindump deleted → ${filename}`);
    } catch (rmErr) {
      log?.(`keybase: braindump file delete failed for ${filename}: ${String(rmErr)}`);
    }

    // Remove the index entry regardless of whether the file existed.
    try {
      delete index[key];
      await writeBraindumpIndex(index);
    } catch (indexErr) {
      log?.(`keybase: braindump index cleanup failed: ${String(indexErr)}`);
    }
  } catch (err) {
    // Never throw from deleteBraindump.
    log?.(`keybase: deleteBraindump error: ${String(err)}`);
  }
}

/**
 * Returns true when the message is a braindump from bontemps in team:coexistence#braindump.
 */
function isBraindumpMessage(message: KeybaseInboundMessage): boolean {
  if (message.senderUsername.toLowerCase() !== BRAINDUMP_SENDER) {
    return false;
  }
  // target is "team:coexistence#braindump"
  const target = message.target.toLowerCase();
  return target === `team:${BRAINDUMP_TEAM}#${BRAINDUMP_CHANNEL}`;
}

const CHANNEL_ID = "keybase" as const;

function normalizeKeybaseAllowlist(raw?: Array<string | number>): string[] {
  if (!raw?.length) {
    return [];
  }
  return raw.map((e) => normalizeKeybaseAllowEntry(String(e))).filter(Boolean);
}

function allowlistMatch(allowFrom: string[], sender: string): boolean {
  if (allowFrom.includes("*")) {
    return true;
  }
  const lower = sender.toLowerCase();
  return allowFrom.some((entry) => entry === lower || lower.endsWith(`@${entry}`));
}

const DEFAULT_CHUNK_LIMIT = 4000;

async function deliverKeybaseReply(params: {
  payload: { text?: string; mediaUrls?: string[]; mediaUrl?: string };
  target: string;
  accountId: string;
  /** When true (default), convert standard Markdown to Keybase formatting dialect. */
  markdownFormatting?: boolean;
  /** Maximum characters per message chunk (default: 4000). */
  textChunkLimit?: number;
  /** Chunking strategy: "length" splits at char limit, "newline" splits at paragraph boundaries. */
  chunkMode?: ChunkMode;
}): Promise<void> {
  const text = params.payload.text ?? "";
  const mediaList = params.payload.mediaUrls?.length
    ? params.payload.mediaUrls
    : params.payload.mediaUrl
      ? [params.payload.mediaUrl]
      : [];

  if (!text.trim() && mediaList.length === 0) {
    return;
  }

  const mediaBlock = mediaList.map((url) => `Attachment: ${url}`).join("\n");
  const combined = text.trim()
    ? mediaBlock
      ? `${text.trim()}\n\n${mediaBlock}`
      : text.trim()
    : mediaBlock;

  // Apply Keybase Markdown formatter unless explicitly disabled (default: enabled).
  const formattingEnabled = params.markdownFormatting !== false;
  const processedText = formattingEnabled ? markdownToKeybase(combined) : combined;

  // Split into chunks if the message exceeds the limit.
  const limit = params.textChunkLimit ?? DEFAULT_CHUNK_LIMIT;
  const chunks =
    processedText.length <= limit ? [processedText] : chunkTextForOutbound(processedText, limit);

  for (const chunk of chunks) {
    await sendMessageKeybase(params.target, chunk, { accountId: params.accountId });
  }
}

export async function handleKeybaseInbound(params: {
  message: KeybaseInboundMessage;
  account: ResolvedKeybaseAccount;
  config: CoreConfig;
  runtime: RuntimeEnv;
}): Promise<void> {
  const { message, account, config, runtime } = params;
  const core = getKeybaseRuntime();

  const rawBody = message.text?.trim() ?? "";
  const hasAttachments = (message.attachments?.length ?? 0) > 0;

  // Skip messages with neither text nor attachments.
  if (!rawBody && !hasAttachments) {
    return;
  }

  // Skip edited messages unless handleEdits is explicitly enabled (default: false).
  if (message.isEdit && !account.config.handleEdits) {
    return;
  }

  const dmPolicy = account.config.dmPolicy ?? "pairing";
  const defaultGroupPolicy = resolveDefaultGroupPolicy(config);
  const { groupPolicy, providerMissingFallbackApplied } =
    resolveAllowlistProviderRuntimeGroupPolicy({
      providerConfigPresent: config.channels?.keybase !== undefined,
      groupPolicy: account.config.groupPolicy,
      defaultGroupPolicy,
    });
  warnMissingProviderGroupPolicyFallbackOnce({
    providerMissingFallbackApplied,
    providerKey: "keybase",
    accountId: account.accountId,
    blockedLabel: GROUP_POLICY_BLOCKED_LABEL.channel,
    log: (msg) => runtime.log?.(msg),
  });

  const configAllowFrom = normalizeKeybaseAllowlist(account.config.allowFrom);
  const configGroupAllowFrom = normalizeKeybaseAllowlist(account.config.groupAllowFrom);
  const storeAllowFrom =
    dmPolicy === "allowlist"
      ? []
      : await core.channel.pairing.readAllowFromStore(CHANNEL_ID).catch(() => []);
  const storeAllowList = normalizeKeybaseAllowlist(storeAllowFrom as Array<string>);

  const effectiveAllowFrom = [...configAllowFrom, ...storeAllowList].filter(Boolean);
  const effectiveGroupAllowFrom = [...configGroupAllowFrom, ...storeAllowList].filter(Boolean);

  if (message.isGroup) {
    // Group policy gate.
    if (groupPolicy === "disabled") {
      runtime.log?.(`keybase: drop group ${message.target} (groupPolicy=disabled)`);
      return;
    }
    if (groupPolicy === "allowlist") {
      // Team channels: check the teams allowlist config.
      // Non-team group chats (multi-user DMs): skip the teams check — use sender gate only.
      if (message.isTeamChannel) {
        const teamKey = message.target.replace(/^team:/, "");
        const teams = account.config.teams ?? {};
        const hasEntry =
          Object.prototype.hasOwnProperty.call(teams, teamKey) ||
          Object.prototype.hasOwnProperty.call(teams, "*");
        if (!hasEntry) {
          runtime.log?.(`keybase: drop group ${message.target} (not in teams allowlist)`);
          return;
        }
      }
    }
    // Sender gate for groups.
    if (effectiveGroupAllowFrom.length > 0) {
      if (!allowlistMatch(effectiveGroupAllowFrom, message.senderUsername)) {
        runtime.log?.(
          `keybase: drop group sender ${message.senderUsername} (not in groupAllowFrom)`,
        );
        return;
      }
    }
  } else {
    if (dmPolicy === "disabled") {
      runtime.log?.(`keybase: drop DM from ${message.senderUsername} (dmPolicy=disabled)`);
      return;
    }
    if (dmPolicy !== "open") {
      const allowed = allowlistMatch(effectiveAllowFrom, message.senderUsername);
      if (!allowed) {
        if (dmPolicy === "pairing") {
          const { code, created } = await core.channel.pairing.upsertPairingRequest({
            channel: CHANNEL_ID,
            id: message.senderUsername.toLowerCase(),
            meta: { name: message.senderUsername },
          });
          if (created) {
            try {
              const reply = core.channel.pairing.buildPairingReply({
                channel: CHANNEL_ID,
                idLine: `Your Keybase username: ${message.senderUsername}`,
                code,
              });
              await deliverKeybaseReply({
                payload: { text: reply },
                target: message.senderUsername,
                accountId: account.accountId,
                markdownFormatting: account.config.markdownFormatting,
              });
            } catch (err) {
              runtime.error?.(
                `keybase: pairing reply failed for ${message.senderUsername}: ${String(err)}`,
              );
            }
          }
        }
        runtime.log?.(`keybase: drop DM from ${message.senderUsername} (dmPolicy=${dmPolicy})`);
        return;
      }
    }
  }

  const allowTextCommands = core.channel.commands.shouldHandleTextCommands({
    cfg: config as OpenClawConfig,
    surface: CHANNEL_ID,
  });
  const useAccessGroups = config.commands?.useAccessGroups !== false;
  const senderAllowedForCommands = allowlistMatch(
    message.isGroup ? effectiveGroupAllowFrom : effectiveAllowFrom,
    message.senderUsername,
  );
  const hasControlCommand = core.channel.text.hasControlCommand(rawBody, config as OpenClawConfig);
  const commandGate = resolveControlCommandGate({
    useAccessGroups,
    authorizers: [
      {
        configured: (message.isGroup ? effectiveGroupAllowFrom : effectiveAllowFrom).length > 0,
        allowed: senderAllowedForCommands,
      },
    ],
    allowTextCommands,
    hasControlCommand,
  });

  if (message.isGroup && commandGate.shouldBlock) {
    logInboundDrop({
      log: (line) => runtime.log?.(line),
      channel: CHANNEL_ID,
      reason: "control command (unauthorized)",
      target: message.senderUsername,
    });
    return;
  }

  // Resolve team channel config for requireMention (only applies to actual team channels).
  const teamKey = message.isTeamChannel ? message.target.replace(/^team:/, "") : null;
  const teams = account.config.teams ?? {};
  const teamConfig = teamKey ? (teams[teamKey] ?? teams["*"] ?? null) : null;
  // Group chats (non-team) don't require a mention — respond to all messages from allowed senders.
  const requireMention = message.isTeamChannel ? (teamConfig?.requireMention ?? true) : false;

  if (message.isGroup && requireMention && !commandGate.commandAuthorized) {
    const mentionRegexes = core.channel.mentions.buildMentionRegexes(config as OpenClawConfig);
    const wasMentioned = core.channel.mentions.matchesMentionPatterns(rawBody, mentionRegexes);
    if (!wasMentioned) {
      runtime.log?.(`keybase: drop group ${message.target} (no mention)`);
      return;
    }
  }

  // Braindump capture: write to file before any agent processing.
  if (isBraindumpMessage(message)) {
    await captureBraindump(message, runtime.log);
  }

  const peerId = message.isGroup ? message.target : message.senderUsername;
  const route = core.channel.routing.resolveAgentRoute({
    cfg: config as OpenClawConfig,
    channel: CHANNEL_ID,
    accountId: account.accountId,
    peer: {
      kind: message.isGroup ? "group" : "direct",
      id: peerId,
    },
  });

  const fromLabel = message.isGroup ? message.target : message.senderUsername;
  const storePath = core.channel.session.resolveStorePath(config.session?.store, {
    agentId: route.agentId,
  });
  const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(config as OpenClawConfig);
  const previousTimestamp = core.channel.session.readSessionUpdatedAt({
    storePath,
    sessionKey: route.sessionKey,
  });

  // For attachment-only messages, use a placeholder based on MIME type.
  const firstAttachmentMime = message.attachments?.[0]?.mimeType ?? "";
  const mediaPlaceholder =
    firstAttachmentMime.startsWith("audio/") || firstAttachmentMime.startsWith("video/")
      ? "<media:audio>"
      : "<media:image>";
  const effectiveBodyText = rawBody || (hasAttachments ? mediaPlaceholder : "");

  // Fetch channel history and prepend it to provide context to the agent.
  const historyLimit = message.isGroup
    ? (account.config.historyLimit ?? 20)
    : (account.config.dmHistoryLimit ?? account.config.historyLimit ?? 0);

  let historyPrefix = "";
  if (historyLimit > 0) {
    const liveBot = getLiveBot(account.accountId);
    if (liveBot) {
      const history = await fetchKeybaseHistory({
        bot: liveBot,
        channel: message.rawChannel,
        limit: historyLimit,
      });
      // Exclude the current message (it'll be the last entry in the fetched history).
      const priorHistory = history.filter((h) => h.messageId !== message.messageId);
      if (priorHistory.length > 0) {
        historyPrefix =
          priorHistory
            .map((h) =>
              core.channel.reply.formatAgentEnvelope({
                channel: "Keybase",
                from: message.isGroup ? `${message.target}/${h.senderUsername}` : h.senderUsername,
                timestamp: h.timestamp,
                envelope: envelopeOptions,
                body: h.text,
              }),
            )
            .join("\n") + "\n";
      }
    }
  }

  // Annotate edit messages with a prefix so the agent knows the original was corrected.
  const editPrefix = message.isEdit
    ? `[Edit of message #${message.editedMsgId ?? "unknown"}]: `
    : "";

  // Fetch reply context if this message is a reply to another message.
  let replyContextPrefix = "";
  const injectReplyContext = account.config.injectReplyContext !== false; // default: true
  if (injectReplyContext && message.replyToMsgId) {
    const liveBot = getLiveBot(account.accountId);
    if (liveBot) {
      try {
        const readResult = await liveBot.chat.read(message.rawChannel, {
          pagination: { num: 50 },
        });
        const quotedMsg = readResult.messages.find((m) => Number(m.id) === message.replyToMsgId);
        if (quotedMsg?.content?.type === "text" && quotedMsg.content.text?.body) {
          const quotedSender = quotedMsg.sender?.username ?? "unknown";
          const quotedText = quotedMsg.content.text.body.trim();
          replyContextPrefix = `[Replying to ${quotedSender}]: "${quotedText}"\n\n`;
        }
      } catch {
        // Non-fatal — continue without reply context if fetch fails.
      }
    }
  }

  const body =
    historyPrefix +
    core.channel.reply.formatAgentEnvelope({
      channel: "Keybase",
      from: fromLabel,
      timestamp: message.timestamp,
      previousTimestamp,
      envelope: envelopeOptions,
      body: editPrefix + replyContextPrefix + effectiveBodyText,
    });

  const groupSystemPrompt = teamConfig?.systemPrompt?.trim() || undefined;

  // Build media payload from downloaded attachments.
  const attachments = message.attachments ?? [];
  const mediaPaths = attachments.map((a) => a.localPath);
  const mediaTypes = attachments.map((a) => a.mimeType);

  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: body,
    RawBody: rawBody || effectiveBodyText,
    CommandBody: rawBody,
    From: message.isGroup ? `keybase:team:${message.target}` : `keybase:${message.senderUsername}`,
    To: `keybase:${peerId}`,
    SessionKey: route.sessionKey,
    AccountId: route.accountId,
    ChatType: message.isGroup ? "group" : "direct",
    ConversationLabel: fromLabel,
    SenderName: message.senderUsername || undefined,
    SenderId: message.senderUsername,
    GroupSubject: message.isGroup ? message.target : undefined,
    GroupSystemPrompt: message.isGroup ? groupSystemPrompt : undefined,
    Provider: CHANNEL_ID,
    Surface: CHANNEL_ID,
    MessageSid: message.messageId,
    Timestamp: message.timestamp,
    OriginatingChannel: CHANNEL_ID,
    OriginatingTo: `keybase:${peerId}`,
    CommandAuthorized: commandGate.commandAuthorized,
    // Media attachments.
    ...(mediaPaths.length > 0 && {
      MediaPath: mediaPaths[0],
      MediaUrl: mediaPaths[0],
      MediaPaths: mediaPaths,
      MediaUrls: mediaPaths,
      MediaType: mediaTypes[0],
      MediaTypes: mediaTypes,
    }),
  });

  await core.channel.session.recordInboundSession({
    storePath,
    sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
    ctx: ctxPayload,
    onRecordError: (err) => {
      runtime.error?.(`keybase: failed updating session meta: ${String(err)}`);
    },
  });

  const { onModelSelected, ...prefixOptions } = createReplyPrefixOptions({
    cfg: config as OpenClawConfig,
    agentId: route.agentId,
    channel: CHANNEL_ID,
    accountId: account.accountId,
  });

  // Resolve reaction emojis: per-team > per-account > defaults.
  const ackEmoji: string | false =
    teamConfig?.ackReaction !== undefined
      ? teamConfig.ackReaction
      : (account.config.ackReaction ?? "👀");
  const doneEmoji: string | false =
    teamConfig?.doneReaction !== undefined
      ? teamConfig.doneReaction
      : (account.config.doneReaction ?? "✅");
  const errorEmoji: string | false =
    teamConfig?.errorReaction !== undefined
      ? teamConfig.errorReaction
      : (account.config.errorReaction ?? "❌");

  const liveBot = getLiveBot(account.accountId);
  const msgId = Number(message.messageId);

  // Intercept Keybase-specific config commands before agent dispatch.
  if (isKeybaseCommand(rawBody)) {
    const result = handleKeybaseCommand(rawBody, account.accountId);
    if (result.handled) {
      if (result.configPatch) {
        try {
          const port = process.env["OPENCLAW_GATEWAY_PORT"];
          const token = process.env["OPENCLAW_GATEWAY_TOKEN"];
          if (!port || !token) throw new Error("Gateway env vars not available");
          const resp = await fetch(`http://127.0.0.1:${port}/api`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ method: "config.patch", params: { raw: result.configPatch } }),
          });
          if (!resp.ok) throw new Error(`Gateway returned ${resp.status}`);
        } catch (err) {
          await deliverKeybaseReply({
            payload: {
              text: `⚠️ Config update failed — setting may not persist after restart.\n\n${result.reply}\n\nError: ${err instanceof Error ? err.message : String(err)}`,
            },
            target: peerId,
            accountId: account.accountId,
            markdownFormatting: account.config.markdownFormatting,
          });
          return;
        }
      }
      await deliverKeybaseReply({
        payload: { text: result.reply },
        target: peerId,
        accountId: account.accountId,
        markdownFormatting: account.config.markdownFormatting,
      });
      return;
    }
  }

  // Send ack reaction immediately after all policy gates pass.
  if (liveBot && ackEmoji && msgId) {
    liveBot.chat.react(message.rawChannel, msgId, ackEmoji).catch(() => {});
  }

  // Typing indicator: show while the agent is working, renew every 4 s.
  const typingEnabled = account.config.typingIndicator ?? true;
  const teamTypingEnabled = teamConfig?.typingIndicator ?? typingEnabled;
  let typingHandle: { stop: () => void } | null = null;
  if (teamTypingEnabled && liveBot) {
    typingHandle = startTypingKeepAlive(liveBot, message.rawChannel);
  }

  let dispatchError = false;
  try {
    await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
      ctx: ctxPayload,
      cfg: config as OpenClawConfig,
      dispatcherOptions: {
        ...prefixOptions,
        deliver: async (payload) => {
          await deliverKeybaseReply({
            payload: payload as { text?: string; mediaUrls?: string[]; mediaUrl?: string },
            target: peerId,
            accountId: account.accountId,
            markdownFormatting: account.config.markdownFormatting,
            textChunkLimit: account.config.textChunkLimit,
            chunkMode: account.config.chunkMode,
          });
        },
        onError: (err, info) => {
          runtime.error?.(`keybase ${info.kind} reply failed: ${String(err)}`);
        },
      },
      replyOptions: {
        skillFilter: teamConfig?.systemPrompt ? undefined : undefined,
        onModelSelected,
      },
    });
  } catch (err) {
    dispatchError = true;
    throw err;
  } finally {
    // Clear typing indicator (stop renewal + send typing=false).
    typingHandle?.stop();

    if (liveBot && msgId) {
      if (dispatchError) {
        if (errorEmoji) {
          // Toggle off ack, then apply error emoji.
          if (ackEmoji) liveBot.chat.react(message.rawChannel, msgId, ackEmoji).catch(() => {});
          liveBot.chat.react(message.rawChannel, msgId, errorEmoji).catch(() => {});
        } else if (ackEmoji) {
          // No error emoji configured — just remove the ack.
          liveBot.chat.react(message.rawChannel, msgId, ackEmoji).catch(() => {});
        }
      } else {
        if (doneEmoji) {
          // Toggle off ack, then apply done emoji.
          if (ackEmoji) liveBot.chat.react(message.rawChannel, msgId, ackEmoji).catch(() => {});
          liveBot.chat.react(message.rawChannel, msgId, doneEmoji).catch(() => {});
        } else if (ackEmoji) {
          // No done emoji — remove ack by toggling it off.
          liveBot.chat.react(message.rawChannel, msgId, ackEmoji).catch(() => {});
        }
      }
    }
  }
}
