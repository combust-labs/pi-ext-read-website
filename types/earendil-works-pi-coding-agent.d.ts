// pi-mono version from v0.74.0 uses this type
declare module '@earendil-works/pi-coding-agent' {
  export interface ExtensionAPI {
    registerTool(options: unknown): void;
  }
}
