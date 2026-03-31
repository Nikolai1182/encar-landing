"use server";

import { headers } from "next/headers";

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

/** Базовый URL для server-side fetch к своему API (тот же хост, что у текущего запроса). */
async function resolveApiOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = (h.get("x-forwarded-proto") ?? "http").split(",")[0]?.trim() ?? "http";
  if (host) {
    const cleanHost = host.split(",")[0]?.trim() ?? host;
    return `${proto}://${cleanHost}`;
  }
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://127.0.0.1:3000";
}

type ApiSuccessJson = {
  ok: true;
  source?: string;
  count?: number;
  message?: string;
  logs?: string[];
  scrapeError?: string | null;
};

type ApiErrorJson = {
  ok?: boolean;
  error?: string;
  logs?: string[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * Вызывает `POST /api/update-cars` с `CRON_SECRET` только на сервере (секрет не попадает в браузер).
 * Та же логика, что и у Vercel Cron: парсер → `public/data/cars.json` или mock.
 */
export async function refreshCatalogAction(): Promise<RefreshCatalogActionResult> {
  if (process.env.ENABLE_PUBLIC_CATALOG_REFRESH === "false") {
    return {
      ok: false,
      error:
        "Обновление каталога с сайта отключено (ENABLE_PUBLIC_CATALOG_REFRESH=false). Используйте cron или curl к POST /api/update-cars с CRON_SECRET.",
    };
  }

  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) {
    return {
      ok: false,
      error:
        "CRON_SECRET не задан или слишком короткий. Добавьте длинный секрет в .env.local и на Vercel.",
    };
  }

  const origin = await resolveApiOrigin();
  const url = `${origin}/api/update-cars`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
      },
      cache: "no-store",
    });

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return {
        ok: false,
        error: `Ответ API не JSON (HTTP ${res.status}).`,
      };
    }

    if (!res.ok) {
      const errBody = isRecord(data) ? (data as ApiErrorJson) : {};
      return {
        ok: false,
        error:
          typeof errBody.error === "string"
            ? errBody.error
            : `Ошибка HTTP ${res.status}`,
        logs: Array.isArray(errBody.logs) ? errBody.logs : [],
      };
    }

    if (!isRecord(data) || data.ok !== true) {
      return { ok: false, error: "Неожиданный успешный ответ API." };
    }

    const body = data as ApiSuccessJson;
    const source =
      body.source === "playwright" || body.source === "mock" ? body.source : "mock";

    return {
      ok: true,
      source,
      count: typeof body.count === "number" ? body.count : 0,
      message:
        typeof body.message === "string"
          ? body.message
          : `Записано ${body.count ?? 0} записей.`,
      logs: Array.isArray(body.logs) ? body.logs : [],
      scrapeError: body.scrapeError ?? null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: `Не удалось вызвать API обновления: ${msg}`,
      logs: [],
    };
  }
}
