import type { Browser } from "playwright-core";
import { chromium } from "playwright-core";

export type LaunchChromiumOptions = {
  headless?: boolean;
};

function resolveLocalHeadless(options?: LaunchChromiumOptions): boolean {
  if (process.env.ENCAR_SCRAPER_HEADLESS === "false") return false;
  if (process.env.ENCAR_SCRAPER_HEADLESS === "true") return true;
  if (options?.headless === false) return false;
  if (options?.headless === true) return true;
  return true;
}

export async function launchChromium(
  options?: LaunchChromiumOptions
): Promise<Browser> {
  const onVercel =
    process.env.VERCEL === "1" ||
    process.env.VERCEL === "true" ||
    Boolean(process.env.VERCEL_ENV);

  if (onVercel) {
    const chromiumPack = (await import("@sparticuz/chromium")).default;
    return chromium.launch({
      args: chromiumPack.args,
      executablePath: await chromiumPack.executablePath(),
      headless: true,
    });
  }

  const { chromium: bundled } = await import("playwright");
  return bundled.launch({
    headless: resolveLocalHeadless(options),
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });
}
