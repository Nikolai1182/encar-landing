import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { Car } from "@/entities/car/model/types";
import { mockCars } from "@/entities/car/model/mock";

import { scrapeEncarCars } from "../scraper/scraper";

export type UpdateCarsResult = {
  ok: true;
  source: "playwright" | "mock";
  count: number;
  path: string;
  logs: string[];
  scrapeError?: string;
};

export type UpdateCarsError = {
  ok: false;
  error: string;
  logs?: string[];
};

function outputPath(): string {
  return path.join(process.cwd(), "public", "data", "cars.json");
}

export async function updateCars(): Promise<UpdateCarsResult | UpdateCarsError> {
  /**
   * На Vercel serverless у процесса только read-only ФС (нет постоянной записи в `public/`).
   * Иначе `mkdir('/var/task/public')` падает с ENOENT / запретом записи.
   * Каталог обновляют локально: `npm run update-cars` → коммит `public/data/cars.json` → push.
   */
  if (process.env.VERCEL === "1") {
    return {
      ok: false,
      error:
        "На Vercel нельзя записать public/data/cars.json во время запроса (файловая система serverless только для чтения). Обновите данные локально: npm run update-cars, затем закоммитьте и запушьте public/data/cars.json.",
      logs: ["[Vercel] запись в public/ недоступна, используйте локальный update-cars + git"],
    };
  }

  const outPath = outputPath();
  const logs: string[] = [];
  let cars: Car[] = [];
  let source: "playwright" | "mock" = "mock";
  let scrapeError: string | undefined;

  logs.push(`→ ${outPath}`);

  try {
    const debug =
      process.env.ENCAR_SCRAPER_DEBUG === "1" ||
      process.env.ENCAR_SCRAPER_DEBUG === "true";
    const scrape = await scrapeEncarCars({ debug });
    logs.push(...scrape.logs);

    if (scrape.cars.length > 0) {
      cars = scrape.cars;
      source = "playwright";
    } else {
      logs.push("scraper returned 0 cars; using mock dataset");
      cars = mockCars.map((c) => ({ ...c }));
      source = "mock";
    }
  } catch (e) {
    scrapeError = String(e);
    logs.push(`scrape error: ${scrapeError}`);
    cars = mockCars.map((c) => ({ ...c }));
    source = "mock";
  }

  try {
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, JSON.stringify(cars, null, 2), "utf8");
    logs.push(`wrote ${cars.length} rows (${source})`);
    return {
      ok: true,
      source,
      count: cars.length,
      path: outPath,
      logs,
      scrapeError,
    };
  } catch (e) {
    const err = String(e);
    logs.push(`write failed: ${err}`);
    return { ok: false, error: err, logs };
  }
}

const isCli =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isCli) {
  void updateCars()
    .then((r) => {
      if (r.ok) {
        console.log(`[update-cars] ${r.count} cars → ${r.path} (${r.source})`);
        if (r.scrapeError) console.warn("[update-cars] scrapeError:", r.scrapeError);
      } else {
        console.error("[update-cars]", r.error);
        process.exitCode = 1;
      }
    })
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    });
}
