import type { ChannelPlugin, OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { keybasePlugin } from "./src/channel.js";
import { stopAllKeybaseProviders } from "./src/monitor.js";
import { setKeybaseRuntime } from "./src/runtime.js";

const plugin = {
  id: "keybase",
  name: "Keybase",
  description: "Keybase channel plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setKeybaseRuntime(api.runtime);
    api.registerChannel({ plugin: keybasePlugin as ChannelPlugin });

    // Register gateway_stop hook to clean up Keybase bot processes on shutdown
    api.hooks.gateway_stop(() => {
      return stopAllKeybaseProviders();
    });
  },
};

export default plugin;
