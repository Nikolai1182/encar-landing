import type { Car } from "@/entities/car/model/types";

import {
  cleanModelName,
  stripHangul,
  translateBrandKoToEn,
  translateModelKoToEn,
} from "./encar-ko-en";

const KRW_PER_USD = Number(process.env.ENCAR_KRW_PER_USD ?? "1350");

export function krwToUsd(krw: number): number {
  if (!Number.isFinite(krw) || krw <= 0) return 0;
  return Math.round((krw / KRW_PER_USD) * 100) / 100;
}

/** KRW или 만원 (×10 000); малые числа трактуются как 만원. */
export function parsePriceToUsd(raw: unknown): number {
  if (raw == null) return 0;
  const n = Number(String(raw).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n < 5000) return krwToUsd(n * 10_000);
  return krwToUsd(n);
}

type EncarApiItem = Record<string, unknown>;

function pickString(obj: EncarApiItem, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return undefined;
}

function pickNumber(obj: EncarApiItem, keys: string[]): number {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(v.replace(/[^\d.]/g, ""));
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

function encarModelYear(item: EncarApiItem): number {
  const fy = pickString(item, ["FormYear", "formYear"]);
  if (fy) {
    const n = Number(fy.replace(/\D/g, "").slice(0, 4));
    if (n > 1990 && n < 2100) return n;
  }
  const y = pickNumber(item, ["Year", "year", "ModelYear", "modelYear"]);
  if (y > 100_000) return Math.floor(y / 100);
  if (y > 1990 && y < 2100) return y;
  return 0;
}

function pickEncarPhoto(item: EncarApiItem): string {
  const photos = item.Photos;
  if (Array.isArray(photos) && photos.length > 0) {
    const first = photos[0];
    if (first && typeof first === "object") {
      const loc = (first as Record<string, unknown>).location;
      if (typeof loc === "string" && loc.startsWith("/")) {
        return `https://ci.encar.com${loc}`;
      }
    }
  }
  const p = pickString(item, [
    "Photo",
    "photo",
    "ImageUrl",
    "imageUrl",
    "MainPhoto",
    "mainPhoto",
    "Thumbnail",
    "thumbnail",
  ]);
  if (!p) return "";
  if (p.startsWith("//")) return `https:${p}`;
  if (p.startsWith("http")) return p;
  if (p.startsWith("/")) {
    if (!/\.(jpe?g|png|webp)$/i.test(p)) {
      return `https://ci.encar.com${p}001.jpg`;
    }
    return `https://ci.encar.com${p}`;
  }
  return `https://ci.encar.com/${p}`;
}

export function normalizeCar(partial: Partial<Car> & { id?: string }): Car | null {
  const id = partial.id?.trim();
  const brand = partial.brand?.trim();
  const model = partial.model?.trim();
  if (!id || !brand || !model) return null;
  const year = Number(partial.year);
  const mileage = Number(partial.mileage);
  const price = Number(partial.price);
  const photo = partial.photo?.trim() ?? "";
  if (!photo) return null;
  return {
    id,
    brand,
    model,
    year: Number.isFinite(year) ? year : 0,
    mileage: Number.isFinite(mileage) ? mileage : 0,
    price: Number.isFinite(price) ? price : 0,
    photo,
    location: partial.location,
  };
}

export function mapEncarApiItemToCar(item: EncarApiItem): Car | null {
  const id =
    pickString(item, ["Id", "id", "VehicleId", "vehicleId", "carId", "CarId"]) ?? "";
  const brandRaw =
    pickString(item, [
      "Manufacturer",
      "manufacturer",
      "ManufacturerName",
      "manufacturerName",
      "Brand",
      "brand",
      "Make",
    ]) ?? "";
  const modelBase =
    pickString(item, [
      "ModelName",
      "modelName",
      "ModelGroupName",
      "modelGroupName",
      "Model",
      "model",
    ]) ?? "";
  const badge = pickString(item, ["Badge", "badge"]);
  const badgeDetail = pickString(item, ["BadgeDetail", "badgeDetail"]);
  const modelCombined = [modelBase, badge, badgeDetail].filter(Boolean).join(" ").trim();

  const brand =
    translateBrandKoToEn(brandRaw) || (brandRaw.trim() ? brandRaw : "Unknown");
  const modelMerged = modelCombined || modelBase;
  const modelRough =
    translateModelKoToEn(modelMerged) ||
    (modelMerged.trim() ? modelMerged : "");
  const cleaned = cleanModelName(modelRough).trim();
  const model =
    cleaned ||
    stripHangul(modelRough).trim() ||
    "Unknown";

  const year = encarModelYear(item);
  const mileage = pickNumber(item, ["Mileage", "mileage"]);
  const priceRaw = item.Price ?? item.price ?? item.AdvertisedPrice;
  const priceUsd = parsePriceToUsd(priceRaw);
  const photo = pickEncarPhoto(item);
  const location = pickString(item, ["OfficeCityState", "location", "region"]);

  if (!id) return null;

  return normalizeCar({
    id: `encar-${id}`,
    brand,
    model,
    year,
    mileage,
    price: priceUsd,
    photo,
    location,
  });
}

export function extractItemsFromEncarJson(data: unknown): EncarApiItem[] {
  if (!data || typeof data !== "object") return [];
  const root = data as Record<string, unknown>;

  const candidates = [
    root.SearchResults,
    root.Items,
    root.items,
    root.Result,
    root.result,
    root.Data,
    root.data,
    root.List,
    root.list,
    root.Search,
    root.search,
    root.VehicleList,
    root.vehicleList,
    root.General,
    root.general,
  ];

  for (const c of candidates) {
    if (Array.isArray(c)) {
      return c.filter((x) => x && typeof x === "object") as EncarApiItem[];
    }
    if (c && typeof c === "object") {
      const o = c as Record<string, unknown>;
      const inner = o.Items ?? o.items ?? o.General ?? o.general;
      if (Array.isArray(inner)) {
        return inner.filter((x) => x && typeof x === "object") as EncarApiItem[];
      }
    }
  }

  return [];
}

export function deepExtractCarItemsFromJson(data: unknown): EncarApiItem[] {
  const found: EncarApiItem[] = [];
  const seen = new Set<string>();

  function looksLikeVehicle(o: EncarApiItem): boolean {
    const id =
      pickString(o, [
        "Id",
        "id",
        "VehicleId",
        "vehicleId",
        "carId",
        "CarId",
      ]) ?? "";
    if (!/^\d{6,}$/.test(id)) return false;
    const brand = pickString(o, [
      "Manufacturer",
      "ManufacturerName",
      "manufacturerName",
      "Brand",
      "brand",
      "Make",
    ]);
    const model = pickString(o, [
      "Model",
      "ModelName",
      "modelName",
      "ModelGroupName",
      "model",
    ]);
    return Boolean(brand && model);
  }

  function walk(node: unknown, depth: number): void {
    if (depth > 28 || found.length >= 300) return;
    if (Array.isArray(node)) {
      for (const el of node) {
        if (el && typeof el === "object" && !Array.isArray(el)) {
          const o = el as EncarApiItem;
          if (looksLikeVehicle(o)) {
            const id =
              pickString(o, [
                "Id",
                "id",
                "VehicleId",
                "vehicleId",
                "carId",
                "CarId",
              ]) ?? "";
            const key = id || JSON.stringify(Object.keys(o).sort());
            if (!seen.has(key)) {
              seen.add(key);
              found.push(o);
            }
          } else walk(o, depth + 1);
        } else walk(el, depth + 1);
      }
      return;
    }
    if (node && typeof node === "object") {
      for (const v of Object.values(node)) walk(v, depth + 1);
    }
  }

  walk(data, 0);
  return found;
}

export function dedupeById(cars: Car[]): Car[] {
  const seen = new Set<string>();
  return cars.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}
