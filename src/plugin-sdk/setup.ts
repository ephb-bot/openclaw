// Shared setup wizard/types/helpers for extension setup surfaces and adapters.

export type { OpenClawConfig } from "../config/config.js";
export type { DmPolicy, GroupPolicy } from "../config/types.js";
export type { SecretInput } from "../config/types.secrets.js";
export type { WizardPrompter } from "../wizard/prompts.js";
export type { ChannelSetupAdapter } from "../channels/plugins/types.adapters.js";
export type { ChannelSetupInput } from "../channels/plugins/types.core.js";
export type {
  ChannelSetupDmPolicy,
  ChannelSetupWizardAdapter,
} from "../channels/plugins/setup-wizard-types.js";
export type {
  ChannelSetupWizard,
  ChannelSetupWizardAllowFromEntry,
  ChannelSetupWizardTextInput,
} from "../channels/plugins/setup-wizard.js";

export { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "../routing/session-key.js";
export { formatCliCommand } from "../cli/command-format.js";
export { detectBinary } from "../plugins/setup-binary.js";
export { installSignalCli } from "../plugins/signal-cli-install.js";
export { formatDocsLink } from "../terminal/links.js";
export { hasConfiguredSecretInput, normalizeSecretInputString } from "../config/types.secrets.js";
export { normalizeE164, pathExists } from "../utils.js";

export {
  applyAccountNameToChannelSection,
  applySetupAccountConfigPatch,
  createEnvPatchedAccountSetupAdapter,
  createPatchedAccountSetupAdapter,
  migrateBaseNameToDefaultAccount,
  patchScopedAccountConfig,
  prepareScopedSetupConfig,
} from "../channels/plugins/setup-helpers.js";
export {
  addWildcardAllowFrom,
  buildSingleChannelSecretPromptState,
  createAccountScopedAllowFromSection,
  createAccountScopedGroupAccessSection,
  createAllowFromSection,
  createLegacyCompatChannelDmPolicy,
  createNestedChannelAllowFromSetter,
  createNestedChannelDmPolicy,
  createNestedChannelDmPolicySetter,
  createTopLevelChannelAllowFromSetter,
  createTopLevelChannelDmPolicy,
  createTopLevelChannelDmPolicySetter,
  createTopLevelChannelGroupPolicySetter,
  mergeAllowFromEntries,
  normalizeAllowFromEntries,
  noteChannelLookupFailure,
  noteChannelLookupSummary,
  parseMentionOrPrefixedId,
  parseSetupEntriesAllowingWildcard,
  parseSetupEntriesWithParser,
  patchNestedChannelConfigSection,
  patchTopLevelChannelConfigSection,
  patchChannelConfigForAccount,
  promptLegacyChannelAllowFrom,
  promptLegacyChannelAllowFromForAccount,
  promptParsedAllowFromForAccount,
  promptParsedAllowFromForScopedChannel,
  promptSingleChannelSecretInput,
  promptResolvedAllowFrom,
  resolveParsedAllowFromEntries,
  resolveEntriesWithOptionalToken,
  resolveSetupAccountId,
  resolveGroupAllowlistWithLookupNotes,
  runSingleChannelSecretStep,
  setAccountAllowFromForChannel,
  setAccountDmAllowFromForChannel,
  setAccountGroupPolicyForChannel,
  setChannelDmPolicyWithAllowFrom,
  setLegacyChannelDmPolicyWithAllowFrom,
  setNestedChannelAllowFrom,
  setNestedChannelDmPolicyWithAllowFrom,
  setSetupChannelEnabled,
  setTopLevelChannelAllowFrom,
  setTopLevelChannelDmPolicyWithAllowFrom,
  setTopLevelChannelGroupPolicy,
  splitSetupEntries,
} from "../channels/plugins/setup-wizard-helpers.js";
export { promptAccountId } from "../channels/plugins/setup-wizard-helpers.js";
export { createAllowlistSetupWizardProxy } from "../channels/plugins/setup-wizard-proxy.js";
export {
  createDelegatedFinalize,
  createDelegatedPrepare,
  createDelegatedResolveConfigured,
  createDelegatedSetupWizardProxy,
} from "../channels/plugins/setup-wizard-proxy.js";
export {
  createCliPathTextInput,
  createDelegatedSetupWizardStatusResolvers,
  createDelegatedTextInputShouldPrompt,
  createDetectedBinaryStatus,
} from "../channels/plugins/setup-wizard-binary.js";

export { formatResolvedUnresolvedNote } from "./resolution-notes.js";

// From channels/plugins/helpers
export { formatPairingApproveHint, resolveChannelDefaultAccountId } from "../channels/plugins/helpers.js";

// From channels/plugins/pairing-message
export { PAIRING_APPROVED_MESSAGE } from "../channels/plugins/pairing-message.js";

// From channels/plugins/config-helpers
export {
  setAccountEnabledInConfigSection,
  deleteAccountFromConfigSection,
} from "../channels/plugins/config-helpers.js";

// From config/zod-schema.core
export {
  DmPolicySchema,
  GroupPolicySchema,
  requireOpenAllowFrom,
} from "../config/zod-schema.core.js";

// From channels/logging and channels/command-gating and channels/reply-prefix
export { logInboundDrop } from "../channels/logging.js";
export { resolveControlCommandGate } from "../channels/command-gating.js";
export { createReplyPrefixOptions } from "../channels/reply-prefix.js";
export { GROUP_POLICY_BLOCKED_LABEL } from "../config/runtime-group-policy.js";
export { warnMissingProviderGroupPolicyFallbackOnce } from "../config/runtime-group-policy.js";

// From text-chunking
export { chunkTextForOutbound } from "./text-chunking.js";

// From config/runtime-group-policy
export {
  resolveDefaultGroupPolicy,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveOpenProviderRuntimeGroupPolicy,
} from "../config/runtime-group-policy.js";
