import { defineBundledChannelEntry } from "openclaw/plugin-sdk/channel-entry-contract";
import { stopAllKeybaseProviders } from "./src/monitor.js";

export default defineBundledChannelEntry({
  id: "keybase",
  name: "Keybase",
  description: "Keybase channel plugin",
  importMetaUrl: import.meta.url,
  plugin: {
    specifier: "./api.js",
    exportName: "keybasePlugin",
  },
  runtime: {
    specifier: "./runtime-api.js",
    exportName: "setKeybaseRuntime",
  },
  registerFull(api) {
    api.registerHook(
      "gateway_stop",
      async () => {
        await stopAllKeybaseProviders();
      },
      { name: "keybase-gateway-stop", description: "Stop all Keybase providers on gateway shutdown" },
    );
  },
});
