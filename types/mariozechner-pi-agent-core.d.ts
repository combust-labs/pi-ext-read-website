// pi-mono version until v0.73.1 inclusive uses this type
declare module '@mariozechner/pi-agent-core' {
  export interface ExtensionAPI {
    registerTool(options: unknown): void;
  }
}
