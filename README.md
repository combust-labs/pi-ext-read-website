<!-- SPDX-License-Identifier: Apache-2.0 -->

# pi-mono extension: read-website

**Purpose**: Provides a pi-mono tool `read-website` that loads a web page, extracts the main article using Mozilla's *Readability* algorithm, converts it to Markdown with *Turndown*, and returns the result to the pi-mono agent runtime.

## How it works
1. **Validate URL** - ensures the `url` parameter is present.
2. **Launch head-less Chromium** via `puppeteer` (`--no-sandbox`).
3. **Navigate** to the page (`page.goto` with `networkidle2`).
4. **Grab HTML** (`page.content`).
5. **Parse article** using `jsdom` → `Readability`.
6. **Convert to Markdown** with `TurndownService`.
7. **Return** a pi-mono-compatible response containing the raw article JSON and the Markdown string.

## Tool registration
The extension registers the tool through the Pi `ExtensionAPI`:
```ts
pi.registerTool({
  name: "read-website",
  label: "ReadWebsite",
  description: "Read website using reader view approach...",
  parameters: ReadWebsiteParams,
  async execute(...) { /* implementation */ }
});
```

## Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | `string` (required) | The web page URL to read. |

## Dependencies
- `@mozilla/readability` - article extraction.
- `jsdom` - DOM emulation for Node.
- `puppeteer` - head-less Chrome.
- `turndown` - HTML → Markdown conversion.

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
      // HTTP URL that points to Chrome's `/json/version` endpoint.
      // Example: "http://127.0.0.1:9222/json/version"
      "endpoint": "http://127.0.0.1:9222/json/version"
    }
  },
  "turndown": {
    "headingStyle": "atx",          // "atx" (default) or "setext"
    "codeBlockStyle": "fenced"      // "fenced" (default) or "indented"
  }
}
```
* `puppeteer.mode` decides whether the extension launches a new Chromium instance (`launch`) or connects to an already-running browser (`connect`).
* When `mode` is `launch`, any values under `puppeteer.launch` override the built-in defaults (`headless:true`, `args:['--no-sandbox']`).
* When `mode` is `connect`, the extension expects an HTTP URL that points to Chrome's `/json/version` endpoint. It fetches that URL, extracts the `webSocketDebuggerUrl` from the JSON response, and uses it to attach to the remote browser.
* The `turndown` object is merged onto Turndown's constructor, allowing you to change heading or code-block styles.

If the file is missing or a section is omitted, the extension uses its internal defaults (launch mode with `/usr/bin/chromium`, ATX headings, fenced code blocks).

## Usage example
```json
{ "name": "read-website", "parameters": { "url": "https://example.com/article" } }
```
The tool will respond with a Pi-formatted message containing the article data and its Markdown rendering.

## Running inside pi-mono-docker container
The Docker image built using [pi-mono-docker](https://github.com/combust-labs/pi-mono-docker) is configured for Puppeteer but the Chrome browser isn't installed by default. You have the following options to get Chrome installed in the image:

1. **Install Chromium at runtime** - If using the default Docker image, the container runs as root and can install Chrome from the APT repository. Once you start your `ppi`, simply ask the agent on the first use:

```
execute `apt-get install -y chromium` via bash once
```

2. **Build a custom image** - For non-root images, build your own Docker image and install Chrome during the image build.

3. **Run a separate headless-Chrome container and connect to it** - Start a remote Chrome instance in its own container and have the extension connect via the `connect` mode. Example:

```bash
docker run --rm --shm-size=2g --name=headless-chrome -ti docker.io/chromedp/headless-shell:latest
```

Obtain the container's IP address:

```bash
CONTAINER_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' headless-chrome)
```

Configure the extension to connect to this remote Chrome:

```json
{
  "puppeteer": {
    "mode": "connect",
    "connect": {
      "endpoint": "http://$CONTAINER_IP:9222/json/version"
    }
  }
}
```

With this configuration the Pi‑mono agent will use the remote headless Chrome instance via Puppeteer's `connect` method.

### Hostname resolution in connect mode

When using the `connect` mode with a hostname endpoint (e.g., `http://headless-chrome:9222/json/version`), the extension automatically resolves the hostname to an IP address via DNS lookup before attempting to connect. This is necessary because Chrome's `/json/version` endpoint returns HTTP 500 when accessed via hostname rather than IP address.

This means you can use container names or hostnames in the endpoint configuration without manually resolving them:

```json
{
  "puppeteer": {
    "mode": "connect",
    "connect": {
      "endpoint": "http://headless-chrome:9222/json/version"
    }
  }
}
```

The extension will resolve `headless-chrome` to its IP address automatically.

## CAPTCHAs and CloudFlare Turnstile
This extension does not attempt solving CAPTCHAs, nor defeating CloudFlare Turnstile. This is not a general-purpose scraper, this extension is a good citizen who simply attempts to read what they can.

## License
This project is licensed under the Apache License, Version 2.0. See the `LICENSE` file for details.
