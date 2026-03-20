// Re-exports from plugin-sdk submodules needed by the Keybase plugin
// These should eventually be part of plugin-sdk/index.ts or a shared keybase entry point

// From plugin-sdk/setup
export {
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
} from "openclaw/plugin-sdk/setup";
export {
  addWildcardAllowFrom,
  formatDocsLink,
  promptAccountId,
  createAllowFromSection,
  createNestedChannelAllowFromSetter,
  createTopLevelChannelAllowFromSetter,
  createNestedChannelDmPolicy,
  createTopLevelChannelDmPolicy,
  createTopLevelChannelDmPolicySetter,
  normalizeAllowFromEntries,
  parseSetupEntriesAllowingWildcard,
  patchNestedChannelConfigSection,
  patchTopLevelChannelConfigSection,
} from "openclaw/plugin-sdk/setup";

// From routing/session-key
export { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "openclaw/plugin-sdk/setup";

// From channels/plugins/helpers
export {
  formatPairingApproveHint,
  resolveChannelDefaultAccountId,
} from "openclaw/plugin-sdk/setup";

// From channels/plugins/config-schema
export { buildChannelConfigSchema } from "openclaw/plugin-sdk/setup";

// From channels/plugins/pairing-message
export { PAIRING_APPROVED_MESSAGE } from "openclaw/plugin-sdk/setup";

// From channels/plugins/setup-helpers
export {
  applyAccountNameToChannelSection,
  resolveDefaultGroupPolicy,
  resolveAllowlistProviderRuntimeGroupPolicy,
} from "openclaw/plugin-sdk/setup";

// From channels/plugins/config-helpers
export {
  setAccountEnabledInConfigSection,
  deleteAccountFromConfigSection,
} from "openclaw/plugin-sdk/setup";

// From config/zod-schema.core
export {
  DmPolicySchema,
  GroupPolicySchema,
  requireOpenAllowFrom,
} from "openclaw/plugin-sdk/setup";

// From inbound helpers
export {
  GROUP_POLICY_BLOCKED_LABEL,
  createReplyPrefixOptions,
  logInboundDrop,
  resolveControlCommandGate,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "openclaw/plugin-sdk/setup";
