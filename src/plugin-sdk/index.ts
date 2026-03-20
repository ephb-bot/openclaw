// Shared root plugin-sdk surface.
// Keep this entry intentionally tiny. Channel/provider helpers belong on
// dedicated subpaths or, for legacy consumers, the compat surface.

export type {
  ChannelAccountSnapshot,
  ChannelAgentTool,
  ChannelAgentToolFactory,
  ChannelCapabilities,
  ChannelGatewayContext,
  ChannelId,
  ChannelMessageActionAdapter,
  ChannelMessageActionContext,
  ChannelMessageActionName,
  ChannelStatusIssue,
} from "../channels/plugins/types.js";
export type {
  ChannelConfiguredBindingConversationRef,
  ChannelConfiguredBindingMatch,
  ChannelConfiguredBindingProvider,
} from "../channels/plugins/types.adapters.js";
export type { ChannelConfigSchema, ChannelPlugin } from "../channels/plugins/types.plugin.js";
export type { ChannelSetupAdapter, ChannelSetupInput } from "../channels/plugins/types.js";
export type {
  ConfiguredBindingConversation,
  ConfiguredBindingResolution,
  CompiledConfiguredBinding,
  StatefulBindingTargetDescriptor,
} from "../channels/plugins/binding-types.js";
export type {
  StatefulBindingTargetDriver,
  StatefulBindingTargetReadyResult,
  StatefulBindingTargetResetResult,
  StatefulBindingTargetSessionResult,
} from "../channels/plugins/stateful-target-drivers.js";
export type {
  ChannelSetupWizard,
  ChannelSetupWizardAllowFromEntry,
} from "../channels/plugins/setup-wizard.js";
export type {
  AnyAgentTool,
  MediaUnderstandingProviderPlugin,
  OpenClawPluginApi,
  OpenClawPluginConfigSchema,
  PluginLogger,
  ProviderAuthContext,
  ProviderAuthResult,
  ProviderRuntimeModel,
  SpeechProviderPlugin,
} from "../plugins/types.js";
export type {
  PluginRuntime,
  RuntimeLogger,
  SubagentRunParams,
  SubagentRunResult,
} from "../plugins/runtime/types.js";
export type { OpenClawConfig } from "../config/config.js";
/** @deprecated Use OpenClawConfig instead */
export type { OpenClawConfig as ClawdbotConfig } from "../config/config.js";
export * from "./image-generation.js";
export type { SecretInput, SecretRef } from "../config/types.secrets.js";
export type { RuntimeEnv } from "../runtime.js";
export type { HookEntry } from "../hooks/types.js";
export type { ReplyPayload } from "../auto-reply/types.js";
export type { WizardPrompter } from "../wizard/prompts.js";
export type { ContextEngineFactory } from "../context-engine/registry.js";

export { emptyPluginConfigSchema } from "../plugins/config-schema.js";
export { registerContextEngine } from "../context-engine/registry.js";
export { delegateCompactionToRuntime } from "../context-engine/delegate.js";

// From plugin-sdk/setup (re-exported for channel plugin convenience)
export {
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
} from "./setup.js";
export {
  formatPairingApproveHint,
  resolveChannelDefaultAccountId,
} from "../channels/plugins/helpers.js";
export { PAIRING_APPROVED_MESSAGE } from "../channels/plugins/pairing-message.js";
export {
  applyAccountNameToChannelSection,
  
  
  
} from "../channels/plugins/setup-helpers.js";
export {
  setAccountEnabledInConfigSection,
  deleteAccountFromConfigSection,
} from "../channels/plugins/config-helpers.js";
export {
  buildChannelConfigSchema,
} from "../channels/plugins/config-schema.js";
export {
  DmPolicySchema,
  GroupPolicySchema,
  requireOpenAllowFrom,
} from "../config/zod-schema.core.js";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "../config/runtime-group-policy.js";
export {
  logInboundDrop,
} from "../channels/logging.js";
export {
  resolveControlCommandGate,
} from "../channels/command-gating.js";
export {
  createReplyPrefixOptions,
} from "../channels/reply-prefix.js";
export {
  chunkTextForOutbound,
} from "./text-chunking.js";

// From config/runtime-group-policy (re-exported for channel plugin convenience)
export {
  resolveDefaultGroupPolicy,
  resolveAllowlistProviderRuntimeGroupPolicy,
} from "../config/runtime-group-policy.js";
