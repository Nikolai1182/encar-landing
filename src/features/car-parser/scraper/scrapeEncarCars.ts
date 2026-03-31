import fs from "node:fs/promises";
import path from "node:path";

import type { BrowserContext, Page } from "playwright-core";

import type { Car } from "@/entities/car/model/types";

import { launchChromium } from "./browser";
import {
  dedupeById,
  deepExtractCarItemsFromJson,
  extractItemsFromEncarJson,
  krwToUsd,
  mapEncarApiItemToCar,
  normalizeCar,
} from "./encar-mapping";
import {
  cleanModelName,
  stripHangul,
  translateBrandKoToEn,
  translateModelKoToEn,
} from "./encar-ko-en";

const KOREAN_CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const DEFAULT_LIST_URL =
  process.env.ENCAR_SCRAPER_URL ??
  "https://www.encar.com/dc/dc_carsearchlist.do?carType=kor";

const NAV_TIMEOUT_MS = Number(process.env.ENCAR_SCRAPER_NAV_TIMEOUT_MS ?? "90000");
const MAX_CARS = Number(process.env.ENCAR_SCRAPER_MAX_CARS ?? "40");
const NETWORKIDLE_MS = Number(process.env.ENCAR_SCRAPER_NETWORKIDLE_MS ?? "45000");
const EXTRA_WAIT_MIN_MS = Number(process.env.ENCAR_SCRAPER_EXTRA_WAIT_MS_MIN ?? "5000");
const EXTRA_WAIT_MAX_MS = Number(process.env.ENCAR_SCRAPER_EXTRA_WAIT_MS_MAX ?? "8000");
const SCROLL_STEPS = Number(process.env.ENCAR_SCRAPER_SCROLL_STEPS ?? "6");

export type ScrapeEncarOptions = {
  /** Сохранить артефакты в `debug/`, показать окно Chromium (локально). */
  debug?: boolean;
};

export type ScrapeResult = {
  cars: Car[];
  logs: string[];
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function extraWaitMs(): number {
  const lo = Math.min(EXTRA_WAIT_MIN_MS, EXTRA_WAIT_MAX_MS);
  const hi = Math.max(EXTRA_WAIT_MIN_MS, EXTRA_WAIT_MAX_MS);
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

const STEALTH_INIT = `
(() => {
  try {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, "languages", { get: () => ["ko-KR", "ko", "en-US", "en"] });
    if (!window.chrome) {
      window.chrome = { runtime: {}, loadTimes: function () {}, csi: function () {} };
    }
  } catch (e) {}
})();
`;

function parseEncarApiPayload(json: unknown): Record<string, unknown>[] {
  const flat = extractItemsFromEncarJson(json);
  if (flat.length) return flat;
  return deepExtractCarItemsFromJson(json);
}

function pushLog(logs: string[], msg: string) {
  logs.push(msg);
}

async function applyCdpStealth(context: BrowserContext, page: Page, logs: string[]) {
  try {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.setUserAgentOverride", {
      userAgent: KOREAN_CHROME_UA,
      acceptLanguage: "ko-KR,ko;q=0.9,en-US;q=0.8",
      platform: "Win32",
    });
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
      source: STEALTH_INIT,
    });
    logs.push("CDP: UserAgentOverride + stealth script injected");
  } catch (e) {
    logs.push(`CDP stealth partial fail: ${String(e)}`);
  }
}

async function saveDebugArtifacts(page: Page, logs: string[]) {
  const dir = path.join(process.cwd(), "debug");
  await fs.mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const png = path.join(dir, `encar-${stamp}.png`);
  const htmlPath = path.join(dir, `encar-${stamp}.html`);
  try {
    await page.screenshot({ path: png, fullPage: true });
    const html = await page.content();
    await fs.writeFile(htmlPath, html, "utf8");
    logs.push(`debug: screenshot → ${png}`);
    logs.push(`debug: HTML → ${htmlPath}`);
  } catch (e) {
    logs.push(`debug save failed: ${String(e)}`);
  }
}

async function scrollPage(page: Page, logs: string[], steps: number) {
  for (let i = 0; i < steps; i++) {
    await page.evaluate(() => {
      window.scrollBy(0, Math.max(400, window.innerHeight * 0.85));
    });
    await sleep(450 + Math.floor(Math.random() * 200));
  }
  logs.push(`scrolled ${steps} steps`);
}

async function scrapeFromDomAggressive(page: Page, logs: string[]): Promise<Car[]> {
  const out: Car[] = [];

  for (const frame of page.frames()) {
    try {
      const rows = await frame.evaluate(() => {
        const rows: { href: string; text: string; img: string }[] = [];
        const seenHref = new Set<string>();

        const pushAnchor = (a: HTMLAnchorElement) => {
          const href = a.getAttribute("href") ?? "";
          if (!href.includes("carid") && !href.includes("cardetail") && !href.includes("car_detail"))
            return;
          if (seenHref.has(href)) return;
          seenHref.add(href);
          const container =
            a.closest("tr, li, article, div[class], section") ?? a.parentElement;
          const text = (container?.textContent ?? a.textContent ?? "")
            .replace(/\s+/g, " ")
            .trim();
          const img =
            a.querySelector("img")?.getAttribute("src") ??
            container?.querySelector("img")?.getAttribute("src") ??
            "";
          rows.push({ href, text, img });
        };

        document
          .querySelectorAll<HTMLAnchorElement>(
            'a[href*="carid"], a[href*="cardetail"], a[href*="car_detail"], a[href*="CarDetail"]'
          )
          .forEach(pushAnchor);

        document.querySelectorAll("[data-carid]").forEach((el) => {
          const id = el.getAttribute("data-carid");
          if (!id) return;
          const a =
            el.querySelector<HTMLAnchorElement>('a[href*="carid"]') ??
            el.closest("a") ??
            null;
          if (a) pushAnchor(a);
        });

        document
          .querySelectorAll(
            'div[class*="list"], div[class*="List"], div[class*="car"], div[class*="Car"], div[class*="item"], div[class*="Item"]'
          )
          .forEach((div) => {
            const a = div.querySelector<HTMLAnchorElement>(
              'a[href*="carid"], a[href*="cardetail"]'
            );
            if (a) pushAnchor(a);
          });

        return rows.slice(0, 120);
      });

      for (const { href, text: clean, img: rawImg } of rows) {
        const idMatch = href.match(/carid=([^&]+)/i);
        const id = idMatch?.[1]?.trim();
        if (!id) continue;

        const yearMatch = clean.match(/(19|20)\d{2}/);
        const year = yearMatch ? Number(yearMatch[0]) : 0;
        const mileageMatch = clean.match(/([\d,]+)\s*(km|KM)/i);
        const mileage = mileageMatch
          ? Number(mileageMatch[1].replace(/,/g, ""))
          : 0;
        const pm = clean.match(/([\d,]+)\s*만/);
        const priceKrw = pm ? Number(pm[1].replace(/,/g, "")) * 10_000 : 0;
        const priceUsd = krwToUsd(priceKrw);

        let img = rawImg;
        if (img.startsWith("//")) img = `https:${img}`;
        if (img && !img.startsWith("http")) {
          img = `https://www.encar.com${img.startsWith("/") ? "" : "/"}${img}`;
        }

        const parts = clean.split(/\s+/).filter(Boolean);
        const brand = translateBrandKoToEn(parts[0] ?? "Unknown");
        const modelRaw =
          parts.length > 1 ? parts.slice(1).join(" ").trim() : "Unknown";
        const tr = translateModelKoToEn(modelRaw);
        const model =
          cleanModelName(tr).trim() ||
          stripHangul(modelRaw).trim() ||
          "Unknown";

        const car = normalizeCar({
          id: `encar-${id}`,
          brand,
          model,
          year,
          mileage,
          price: priceUsd,
          photo:
            img ||
            "https://www.encar.com/images/common/icon/brand_logo_400x400_v4.png",
          location: "Korea",
        });
        if (car) out.push(car);
      }
    } catch (e) {
      logs.push(`DOM frame scrape error: ${String(e)}`);
    }
  }

  return dedupeById(out);
}

async function waitForListingHints(page: Page, logs: string[]) {
  try {
    await page.waitForSelector(
      'a[href*="carid"], a[href*="cardetail"], [data-carid]',
      { timeout: 25_000 }
    );
    logs.push("DOM: listing hints detected");
  } catch {
    logs.push("DOM: no listing hints within 25s");
  }
}

export async function scrapeEncarCars(
  options: ScrapeEncarOptions = {}
): Promise<ScrapeResult> {
  const debug = Boolean(options.debug);
  const logs: string[] = [];
  const apiItems: Record<string, unknown>[] = [];

  pushLog(logs, `start url=${DEFAULT_LIST_URL} navTimeout=${NAV_TIMEOUT_MS}ms`);
  pushLog(
    logs,
    `debug=${debug} MAX_CARS=${MAX_CARS} NETWORKIDLE_MS=${NETWORKIDLE_MS}`,
  );

  let browser;
  try {
    browser = await launchChromium({ headless: debug ? false : undefined });
    pushLog(
      logs,
      `browser launched (headless=${debug ? "false (local)" : "true"})`,
    );
  } catch (e) {
    logs.push(`launch failed: ${String(e)}`);
    return { cars: [], logs };
  }

  let context: BrowserContext | undefined;
  let page: Page | undefined;

  try {
    context = await browser.newContext({
      userAgent: KOREAN_CHROME_UA,
      locale: "ko-KR",
      timezoneId: "Asia/Seoul",
      viewport: { width: 1366, height: 900 },
      deviceScaleFactor: 1,
      hasTouch: false,
      isMobile: false,
      colorScheme: "light",
      extraHTTPHeaders: {
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      },
    });
    await context.addInitScript(STEALTH_INIT);

    page = await context.newPage();
    await applyCdpStealth(context, page, logs);

    page.on("request", (request) => {
      try {
        const url = request.url();
        if (!url.includes("api.encar.com")) return;
        const method = request.method();
        if (method !== "POST") return;
        if (!/\/search|\/list|Search|Listing|vehicle/i.test(url)) return;
        const line = `[POST api.encar.com] ${url.slice(0, 180)}`;
        logs.push(line);
      } catch {
        /* ignore */
      }
    });

    page.on("response", async (response) => {
      const url = response.url();
      if (!url.includes("api.encar.com")) return;
      const status = response.status();
      const method = response.request().method();
      const line = `[api.encar.com] ${method} ${status} ${url.slice(0, 140)}`;
      logs.push(line);

      let text: string;
      try {
        text = await response.text();
      } catch (e) {
        logs.push(`  → body read failed: ${String(e)}`);
        return;
      }

      if (status !== 200) {
        logs.push(`  → non-200 body preview: ${text.slice(0, 220).replace(/\s+/g, " ")}`);
      }

      let json: unknown;
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        return;
      }

      const items = parseEncarApiPayload(json);
      if (items.length) {
        apiItems.push(...items);
        logs.push(`  → parsed ${items.length} vehicle-like objects (status ${status})`);
      }
    });

    pushLog(logs, "navigation: domcontentloaded…");
    await page.goto(DEFAULT_LIST_URL, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT_MS,
    });
    pushLog(logs, "navigation: domcontentloaded OK");

    try {
      await page.waitForLoadState("networkidle", { timeout: NETWORKIDLE_MS });
      pushLog(logs, "networkidle OK");
    } catch (e) {
      logs.push(`networkidle: ${String(e)} (continuing)`);
    }

    await scrollPage(page, logs, SCROLL_STEPS);

    const waitMs = extraWaitMs();
    pushLog(logs, `post-scroll wait ${waitMs}ms`);
    await sleep(waitMs);

    await waitForListingHints(page, logs);

    await sleep(2000);

    if (debug) {
      await saveDebugArtifacts(page, logs);
    }

    pushLog(logs, `API buffer: ${apiItems.length} items before map`);

    let cars: Car[] = [];
    if (apiItems.length) {
      cars = dedupeById(
        apiItems
          .map((item) => mapEncarApiItemToCar(item))
          .filter((c): c is Car => c !== null)
      );
      logs.push(`mapped ${cars.length} cars from API payloads`);
    }

    if (cars.length === 0) {
      pushLog(logs, "API empty → DOM fallback");
      const domCars = await scrapeFromDomAggressive(page, logs);
      cars = dedupeById(domCars);
      if (cars.length) logs.push(`DOM fallback: ${cars.length} cars`);
    }

    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});

    const sliced = cars.slice(0, MAX_CARS);
    pushLog(logs, `done: ${sliced.length} cars (max ${MAX_CARS})`);
    return { cars: sliced, logs };
  } catch (e) {
    const err = String(e);
    logs.push(`fatal: ${err}`);
    try {
      if (page && debug) await saveDebugArtifacts(page, logs);
    } catch {
      /* ignore */
    }
    await page?.close().catch(() => {});
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
    return { cars: [], logs };
  }
}
