import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

function readArgument(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

const extensionArgument = readArgument("extension");
if (!extensionArgument) {
  throw new Error("Missing required --extension <absolute-or-relative-path>");
}

const extensionPath = resolve(extensionArgument);
const profilePath = resolve(
  readArgument("profile", "/private/tmp/twp-playwright-profile")
);
const outputPath = resolve(
  readArgument("output", "/private/tmp/twp-playwright-config.json")
);

const config = {
  browser: {
    browserName: "chromium",
    isolated: false,
    userDataDir: profilePath,
    launchOptions: {
      channel: "chromium",
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    },
    contextOptions: {
      viewport: {
        width: 1280,
        height: 720,
      },
    },
  },
};

await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
console.log(outputPath);
