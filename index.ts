/* SPDX-License-Identifier: Apache-2.0 */
/**
 * Read website tool - read a website readable content and return the extracted the article text as markdown.
 */

import { promises as fs } from 'fs';
import { JSDOM } from 'jsdom';
import * as path from 'path';
import puppeteer, { Browser, ConnectOptions, LaunchOptions, Page } from 'puppeteer';
import TurndownService from 'turndown';

import { Type } from '@mariozechner/pi-ai';
import { Readability } from '@mozilla/readability';

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

type HttpResponse = {
  statusCode: number;
  responseBody: string,
}

/**
 * Generate a random password.
 * @param length - Desired password length (default 24).
 * @returns A securely generated password string.
 */
// Helper to load optional JSON configuration for the extension.
interface PuppeteerLaunchConfig {
  executablePath?: string;
  args?: string[];
}

interface PuppeteerConnectConfig {
  // HTTP URL that returns the JSON endpoint list (e.g., http://localhost:9222/json)
  endpoint: string;
}

interface PuppeteerConfig {
  mode: 'launch' | 'connect';
  launch?: PuppeteerLaunchConfig;
  connect?: PuppeteerConnectConfig;
}

interface TurndownConfig {
  headingStyle?: 'atx' | 'setext';
  codeBlockStyle?: 'indented' | 'fenced';
}

interface ExtensionConfig {
  puppeteer?: PuppeteerConfig;
  turndown?: TurndownConfig;
}

async function loadConfig(): Promise<ExtensionConfig> {
  const possiblePaths = [
    path.join(process.env.HOME || '', '.pi', 'agent', 'extensions', 'read-website', 'config.json'),
    path.join(process.cwd(), '.pi', 'extensions', 'read-website', 'config.json'),
  ];

  // Check for environment variable after defining default paths.
  // If READ_WEBSITE_CONFIG is set and points to an existing file, prepend it.
  const envPath = process.env.READ_WEBSITE_CONFIG;
  if (envPath) {
    try {
      await fs.access(envPath);
      // Prepend so it has highest priority.
      possiblePaths.unshift(envPath);
    } catch (e) {
      // envPath does not exist or is not accessible – ignore.
    }
  }

  for (const p of possiblePaths) {
    try {
      const data = await fs.readFile(p, { encoding: 'utf-8' });
      return JSON.parse(data) as ExtensionConfig;
    } catch (e) {
      // ignore missing file errors, continue to next path
    }
  }
  // Return empty config if none found
  return {};
}

const ReadWebsiteParams = Type.Object({
	url: Type.Required(Type.String({ description: "Page URL to call and read as markdown" })),
});

export default function readWebsite(pi: ExtensionAPI) {                                                                                                                                                                             
  pi.registerTool({
    name: "read-website",
    label: "ReadWebsite",
    description: [
      "Read website using reader view approach.",
      "Extract article content as markdown.",
      "use this tool whenever a user asks to read a website, learn more, discover more, followed by a URL."
    ].join(" "),
    parameters: ReadWebsiteParams,
    
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      
      const url = (params.url ?? "").trim();

      if (url === "") {
        return {
          content: [{ type: "text", text: `Invalid parameters. Page URL cannot be empty.` }],
          details: {},
        };
      }

      // Prepare Puppeteer based on configuration
      const config = await loadConfig();
      const puppeteerCfg = config.puppeteer ?? { mode: 'launch' };
      let browser: Browser;
      if (puppeteerCfg.mode === 'connect' && puppeteerCfg.connect?.endpoint) {
        // Discover the actual WebSocket debugger URL via the provided HTTP endpoint.
        // The endpoint is expected to be Chrome’s `/json/version` endpoint, which returns a
        // single JSON object like:
        //   { "Browser": "...", "Protocol-Version": "...", "webSocketDebuggerUrl": "ws://...", … }
        // Hence we only need to read the `webSocketDebuggerUrl` property.
        let wsUrl: string | undefined;
        try {
          const response = await fetch(puppeteerCfg.connect.endpoint);
          if (!response.ok) {
            throw new Error(`Failed to fetch ${puppeteerCfg.connect.endpoint}: ${response.status}`);
          }
          const data = await response.json();
          // `data` is a plain object – pull the property directly.
          if (typeof data?.webSocketDebuggerUrl === 'string') {
            wsUrl = data.webSocketDebuggerUrl;
          }
          if (!wsUrl) {
            throw new Error('webSocketDebuggerUrl not found in response');
          }
        } catch (e) {
          return {
            content: [{ type: "text", text: `Failed to resolve browser WebSocket endpoint: ${e}` }],
            details: {},
          } as any;
        }
        const connectOpts: ConnectOptions = { browserWSEndpoint: wsUrl };
        browser = await puppeteer.connect(connectOpts);
      } else {
        // launch mode (default)
        const launchOpts: LaunchOptions = {
          args: ['--no-sandbox'],
          headless: true,
          // Use configured executablePath if provided, otherwise fallback to current default
          executablePath: puppeteerCfg.launch?.executablePath ?? "/usr/bin/chromium",
          ...(puppeteerCfg.launch?.args ? { args: puppeteerCfg.launch.args } : {}),
        };
        browser = await puppeteer.launch(launchOpts);
      }
      const page: Page = await browser.newPage();
      await page.goto(url, {
        waitUntil: 'networkidle2', // Waits for the challenge redirect to finish
      });

      const html = await page.content();

      const doc = new JSDOM(html, { url: url })
      const reader = new Readability(doc.window.document);
      const article = reader.parse();

      if (article === null) {
        return {
          content: [{ type: "text", text: `Invalid response. Could not read the article from the page.` }],
          details: {},
        };
      }

      const turndownDefaults = {
        headingStyle: 'atx' as const,
        codeBlockStyle: 'fenced' as const,
      };
      const turndownOpts = { ...turndownDefaults, ...(config.turndown ?? {}) };
      const turndownService = new TurndownService(turndownOpts);

      const markdownContent = turndownService.turndown(article.content ?? "")

      return {
        content: [{ type: "text", text: markdownContent }],
        details: { article: JSON.stringify(article) },
      };

    }

  });
}
