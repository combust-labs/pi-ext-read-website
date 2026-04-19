/* SPDX-License-Identifier: Apache-2.0 */
/**
 * Read website tool - read a website readable content and return the extracted the article text as markdown.
 */

import { JSDOM } from 'jsdom';
import puppeteer, { Browser, Page } from 'puppeteer';
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
async function getDocumentBody(url: string): Promise<HttpResponse> {
  const response = await fetch(url);
  return { statusCode: response.status, responseBody: await response.text() }
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

      // Launch the browser in headless mode
      const browser: Browser = await puppeteer.launch({
        args: ['--no-sandbox'],
        executablePath: "/usr/bin/chromium",
        headless: true
      });
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
          content: [{ type: "text", text: `Invalid response. Could not read the article from the HTTP response (status: ${response.statusCode})` }],
          details: {},
        };
      }

      const turndownService = new TurndownService({
        headingStyle: 'atx', // Use # for headings
        codeBlockStyle: 'fenced' // Use ``` for code blocks
      });

      const markdownContent = turndownService.turndown(article.content ?? "")

      return {
        content: [{ type: "text", text: markdownContent }],
        details: { article: JSON.stringify(article) },
      };

    }

  });
}
