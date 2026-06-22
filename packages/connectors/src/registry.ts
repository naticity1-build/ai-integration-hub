import type { ConnectorPlugin } from "./types.js";
import type { ConnectorType } from "@hub/core";

export class ConnectorRegistry {
  private plugins = new Map<ConnectorType, ConnectorPlugin>();

  register(plugin: ConnectorPlugin): void {
    this.plugins.set(plugin.type, plugin);
  }

  get(type: ConnectorType): ConnectorPlugin | undefined {
    return this.plugins.get(type);
  }

  getAll(): ConnectorPlugin[] {
    return [...this.plugins.values()];
  }

  getAllCapabilities() {
    return this.getAll().flatMap((p) => p.getCapabilities());
  }
}

export const globalRegistry = new ConnectorRegistry();
