"use client";

import { create } from "zustand";

import type { Car } from "@/entities/car/model/types";
import { mockCars } from "@/entities/car/model/mock";
import { refreshCatalogAction } from "@/features/car-parser/api/refresh-catalog-action";

const MOCK_DELAY_MS = 400;

export type LoadCarsResult = {
  source: "json" | "mock" | "cached";
  count: number;
  httpStatus?: number;
  detail?: string;
};

export type CarListState = {
  cars: Car[];
  isLoading: boolean;
  isUpdating: boolean;
  refreshError: string | null;
  /** Краткое сообщение для пользователя после последнего обновления (успех или ошибка). */
  refreshBanner: { variant: "success" | "error"; text: string } | null;
  refreshLogs: string[];
  loadCars: (force?: boolean) => Promise<LoadCarsResult>;
  refreshCatalog: () => Promise<void>;
};

export const useCarListStore = create<CarListState>((set, get) => ({
  cars: [],
  isLoading: false,
  isUpdating: false,
  refreshError: null,
  refreshBanner: null,
  refreshLogs: [],
  loadCars: async (force = false) => {
    const { cars, isLoading } = get();
    if (isLoading) {
      return { source: "cached", count: cars.length, detail: "skipped (already loading)" };
    }
    if (!force && cars.length > 0) {
      return { source: "cached", count: cars.length };
    }

    set({ isLoading: true });
    try {
      const res = await fetch("/data/cars.json", { cache: "no-store" });
      const httpStatus = res.status;
      if (res.ok) {
        const data = (await res.json()) as Car[];
        if (Array.isArray(data) && data.length > 0) {
          set({ cars: data, isLoading: false });
          return { source: "json", count: data.length, httpStatus };
        }
        await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));
        set({ cars: mockCars.map((c) => ({ ...c })), isLoading: false });
        return {
          source: "mock",
          count: mockCars.length,
          httpStatus,
          detail: "cars.json пустой или не массив — показан мок",
        };
      }
    } catch {
      /* fall through to mock */
    }
    await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));
    set({ cars: mockCars.map((c) => ({ ...c })), isLoading: false });
    return {
      source: "mock",
      count: mockCars.length,
      detail: "не удалось загрузить /data/cars.json — показан мок",
    };
  },
  refreshCatalog: async () => {
    set({ isUpdating: true, refreshError: null, refreshBanner: null });
    const serverLogs: string[] = [];
    let err: string | null = null;
    let banner: CarListState["refreshBanner"] = null;
    try {
      const result = await refreshCatalogAction();
      if (result.ok) {
        serverLogs.push(...result.logs);
        if (result.scrapeError) {
          serverLogs.push(`[scrapeError] ${result.scrapeError}`);
        }
        banner = { variant: "success", text: result.message };
      } else {
        err = result.error;
        banner = { variant: "error", text: result.error };
        serverLogs.push(result.error, ...(result.logs ?? []));
      }
    } catch (e) {
      const msg = String(e);
      serverLogs.push(`[client] ${msg}`);
      const isChunkFail =
        msg.includes("ChunkLoadError") || msg.includes("Loading chunk");
      if (!isChunkFail) {
        err = msg;
        banner = { variant: "error", text: msg };
      } else {
        serverLogs.push(
          "[hint] Ошибка загрузки модуля в dev — обновите страницу и повторите.",
        );
        banner = {
          variant: "error",
          text: "Ошибка загрузки модуля — обновите страницу и повторите.",
        };
      }
    } finally {
      const loadResult = await get().loadCars(true);
      const clientLine = `[client] loadCars: source=${loadResult.source}, count=${loadResult.count}${loadResult.httpStatus != null ? `, HTTP ${loadResult.httpStatus}` : ""}${loadResult.detail ? ` — ${loadResult.detail}` : ""}`;
      set({
        isUpdating: false,
        refreshError: err,
        refreshBanner: banner,
        refreshLogs: [...serverLogs, "", clientLine],
      });
    }
  },
}));
