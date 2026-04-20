<!-- SPDX-License-Identifier: Apache-2.0 -->

# pi-mono extension: read-website

**Purpose**: Provides a pi-mono tool `read-website` that loads a web page, extracts the main article using Mozilla’s *Readability* algorithm, converts it to Markdown with *Turndown*, and returns the result to the pi-mono agent runtime.

## How it works
1. **Validate URL** – ensures the `url` parameter is present.
2. **Launch head‑less Chromium** via `puppeteer` (`--no-sandbox`).
3. **Navigate** to the page (`page.goto` with `networkidle2`).
4. **Grab HTML** (`page.content`).
5. **Parse article** using `jsdom` → `Readability`.
6. **Convert to Markdown** with `TurndownService`.
7. **Return** a pi-mono‑compatible response containing the raw article JSON and the Markdown string.

## Tool registration
The extension registers the tool through the Pi `ExtensionAPI`:
```ts
pi.registerTool({
  name: "read-website",
  label: "ReadWebsite",
  description: "Read website using reader view approach…",
  parameters: ReadWebsiteParams,
  async execute(...) { /* implementation */ }
});
```

## Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | `string` (required) | The web page URL to read. |

## Dependencies
- `@mozilla/readability` – article extraction.
- `jsdom` – DOM emulation for Node.
- `puppeteer` – head‑less Chrome.
- `turndown` – HTML → Markdown conversion.

## Configuration
The extension can be customized via a JSON configuration file. The file is optional; if it does not exist the extension falls back to sensible defaults.

**Supported locations** (the first existing file is used):
```
$HOME/.pi/agent/extensions/read-website/config.json
$HOME/.pi/extensions/read-website/config.json
```

### Configuration schema
```json
{
  "puppeteer": {
    "mode": "launch",               // "launch" (default) or "connect"
    "launch": {
      "executablePath": "/usr/bin/chromium", // optional, defaults to this path
      "args": ["--no-sandbox"]            // optional extra args
    },
    "connect": {
      "browserWSEndpoint": "ws://127.0.0.1:9222/devtools/browser/abcd"
    }
  },
  "turndown": {
    "headingStyle": "atx",          // "atx" (default) or "setext"
    "codeBlockStyle": "fenced"      // "fenced" (default) or "indented"
  }
}
```
* `puppeteer.mode` decides whether the extension launches a new Chromium instance (`launch`) or connects to an already‑running browser (`connect`).
* When `mode` is `launch`, any values under `puppeteer.launch` override the built‑in defaults (`headless:true`, `args:['--no-sandbox']`).
* When `mode` is `connect`, the extension uses the provided `browserWSEndpoint` to attach to the remote browser.
* The `turndown` object is merged onto Turndown’s constructor, allowing you to change heading or code‑block styles.

If the file is missing or a section is omitted, the extension uses its internal defaults (launch mode with `/usr/bin/chromium`, ATX headings, fenced code blocks).

## Usage example
```json
{ "name": "read-website", "parameters": { "url": "https://example.com/article" } }
```
The tool will respond with a Pi‑formatted message containing the article data and its Markdown rendering.

## Running inside pi-mono-docker container
The Docker image built using [pi-mono-docker](https://github.com/combust-labs/pi-mono-docker) is configured for Puppeteer but the Chrome browser isn't installed by default. You have the following options to get Chrome installed in the image:

1. If using the default Docker image, the container runs as root and will be able to install Chrome from the APT repository, once you start your `ppi`, simply ask the agent on the first use:

```
execute `apt-get install -y chromium` via bash once
```

2. To use a non-root image, build your own image and install Chrome during the image build.

## CAPTCHAs and CloudFlare Turnstile
This extension does not attempt solving CAPTCHAs, nor defeating CloudFlare Turnstile. This is not a general-purpose scraper, this extension is a good citizen who simply attempts to read what they can.

## License
This project is licensed under the Apache License, Version 2.0. See the `LICENSE` file for details.
