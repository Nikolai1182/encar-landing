"use server";

import { updateCars } from "./parser";

export type RefreshCatalogActionResult =
  | {
      ok: true;
      source: "playwright" | "mock";
      count: number;
      message: string;
      logs: string[];
      scrapeError?: string | null;
    }
  | { ok: false; error: string; logs?: string[] };

/**
 * Обновляет каталог через `updateCars()` (тот же пайплайн, что и у `/api/update-cars`).
 * Секрет **не** нужен: действие выполняется только на сервере Next.js.
 *
 * Защищённый HTTP-маршрут `POST/GET /api/update-cars` с `CRON_SECRET` — для Vercel Cron и ручного `curl`.
 */
export async function refreshCatalogAction(): Promise<RefreshCatalogActionResult> {
  if (process.env.ENABLE_PUBLIC_CATALOG_REFRESH === "false") {
    return {
      ok: false,
      error:
        "Обновление каталога с сайта отключено (ENABLE_PUBLIC_CATALOG_REFRESH=false). Используйте cron или curl к POST /api/update-cars с CRON_SECRET.",
    };
  }

  const result = await updateCars();
  if (!result.ok) {
    return { ok: false, error: result.error, logs: result.logs };
  }

  return {
    ok: true,
    source: result.source,
    count: result.count,
    message:
      result.source === "playwright"
        ? `Записано ${result.count} автомобилей (данные с Encar).`
        : `Парсер не вернул объявления; записаны ${result.count} демо-записей.`,
    logs: result.logs,
    scrapeError: result.scrapeError ?? null,
  };
}
