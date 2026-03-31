import { type NextRequest, NextResponse } from "next/server";

import { updateCars } from "@/features/car-parser/api/parser";

export const runtime = "nodejs";

/** Лимит времени выполнения serverless-функции (сек.). Увеличьте на Pro при долгом скрейпе. */
export const maxDuration = 60;

/**
 * Ожидаемый заголовок: `Authorization: Bearer <CRON_SECRET>`.
 * На Vercel при заданном `CRON_SECRET` cron сам подставляет этот Bearer (см. README).
 */
function getBearerToken(request: NextRequest): string | null {
  const h = request.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice(7).trim();
}

/**
 * POST — основной метод для ручных вызовов и кнопки «Обновить данные» (через server action).
 * GET — то же поведение: Vercel Cron вызывает маршрут именно GET-запросом.
 *
 * Цепочка: `updateCars()` → внутри `scrapeEncarCars()`; при пустом результате или ошибке —
 * запись mock-данных в `public/data/cars.json` (см. `parser.ts`).
 */
export async function GET(request: NextRequest) {
  return handleUpdateCars(request);
}

export async function POST(request: NextRequest) {
  return handleUpdateCars(request);
}

async function handleUpdateCars(request: NextRequest) {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected || expected.length < 16) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "CRON_SECRET не задан или слишком короткий. Задайте длинный секрет в переменных окружения.",
      },
      { status: 500 },
    );
  }

  const token = getBearerToken(request);
  if (token !== expected) {
    return NextResponse.json(
      {
        ok: false,
        error: "Доступ запрещён: неверный или отсутствующий Bearer-токен в Authorization.",
      },
      { status: 401 },
    );
  }

  try {
    const result = await updateCars();

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          error: result.error,
          logs: result.logs ?? [],
        },
        { status: 500 },
      );
    }

    const message =
      result.source === "playwright"
        ? `Обновлено автомобилей: ${result.count} (данные с Encar).`
        : `Парсер не вернул объявления; записано ${result.count} демо-записей (mock).`;

    return NextResponse.json({
      ok: true,
      success: true,
      source: result.source,
      count: result.count,
      path: result.path,
      logs: result.logs,
      scrapeError: result.scrapeError ?? null,
      message,
    });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        ok: false,
        success: false,
        error: `Внутренняя ошибка при обновлении: ${err}`,
      },
      { status: 500 },
    );
  }
}
