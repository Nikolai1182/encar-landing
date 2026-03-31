"use client";

import { useMemo, useState } from "react";

import type { Car } from "@/entities/car/model/types";
import { CarCard } from "@/features/car-card/ui/CarCard";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/shared/ui/select";

type CarListProps = {
  cars: Car[];
  isLoading: boolean;
};

const ALL = "all";

type PriceFilter = typeof ALL | "p1" | "p2" | "p3";

function brandFilterLabel(brand: string): string {
  if (brand === ALL) return "Все марки";
  return brand;
}

function priceFilterLabel(price: PriceFilter): string {
  if (price === ALL) return "Любая";
  if (price === "p1") return "до $20 000";
  if (price === "p2") return "$20 000 – $35 000";
  return "от $35 000";
}

function yearFilterLabel(year: string): string {
  if (year === ALL) return "Любой";
  return year;
}

function matchesPrice(car: Car, price: PriceFilter): boolean {
  if (price === ALL) return true;
  if (price === "p1") return car.price < 20_000;
  if (price === "p2") return car.price >= 20_000 && car.price < 35_000;
  return car.price >= 35_000;
}

export function CarList({ cars, isLoading }: CarListProps) {
  const [brand, setBrand] = useState<string>(ALL);
  const [price, setPrice] = useState<PriceFilter>(ALL);
  const [year, setYear] = useState<string>(ALL);

  const brands = useMemo(() => {
    const s = new Set(cars.map((c) => c.brand));
    return Array.from(s).sort((a, b) => a.localeCompare(b, "en"));
  }, [cars]);

  const years = useMemo(() => {
    const s = new Set(cars.map((c) => String(c.year)));
    return Array.from(s).sort((a, b) => Number(b) - Number(a));
  }, [cars]);

  const filtered = useMemo(() => {
    return cars.filter((c) => {
      if (brand !== ALL && c.brand !== brand) return false;
      if (!matchesPrice(c, price)) return false;
      if (year !== ALL && String(c.year) !== year) return false;
      return true;
    });
  }, [cars, brand, price, year]);

  if (isLoading) {
    return (
      <section className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="border-border/50 bg-muted/30 h-[420px] animate-pulse rounded-xl border"
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      <div className="border-border/40 bg-card/40 mb-10 grid gap-4 rounded-2xl border p-4 backdrop-blur-md sm:grid-cols-3 sm:p-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="filter-brand" className="text-muted-foreground text-xs uppercase">
            Марка
          </Label>
          <Select value={brand} onValueChange={(v) => setBrand(v ?? ALL)}>
            <SelectTrigger id="filter-brand" className="w-full min-w-0">
              <span className="line-clamp-1 flex-1 text-left text-sm">
                {brandFilterLabel(brand)}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Все марки</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="filter-price" className="text-muted-foreground text-xs uppercase">
            Цена (USD)
          </Label>
          <Select
            value={price}
            onValueChange={(v) => setPrice((v ?? ALL) as PriceFilter)}
          >
            <SelectTrigger id="filter-price" className="w-full min-w-0">
              <span className="line-clamp-1 flex-1 text-left text-sm">
                {priceFilterLabel(price)}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Любая</SelectItem>
              <SelectItem value="p1">до $20 000</SelectItem>
              <SelectItem value="p2">$20 000 – $35 000</SelectItem>
              <SelectItem value="p3">от $35 000</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="filter-year" className="text-muted-foreground text-xs uppercase">
            Год
          </Label>
          <Select value={year} onValueChange={(v) => setYear(v ?? ALL)}>
            <SelectTrigger id="filter-year" className="w-full min-w-0">
              <span className="line-clamp-1 flex-1 text-left text-sm">
                {yearFilterLabel(year)}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Любой</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-muted-foreground mb-6 text-sm">
        Найдено: <span className="text-foreground font-medium">{filtered.length}</span> из{" "}
        {cars.length}
      </p>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((car, index) => (
          <CarCard key={car.id} car={car} priority={index < 3} />
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center text-sm">
          Нет автомобилей по выбранным фильтрам. Измените условия поиска.
        </p>
      ) : null}
    </section>
  );
}
