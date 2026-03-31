"use client";

import Image from "next/image";
import { useMemo } from "react";

import type { Car } from "@/entities/car/model/types";
import { carTitleEnglish } from "@/features/car-parser/scraper/encar-ko-en";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/shared/ui/card";

type CarCardProps = {
  car: Car;
  priority?: boolean;
};

export function CarCard({ car, priority = false }: CarCardProps) {
  const titleEn = useMemo(
    () => carTitleEnglish(car.brand, car.model),
    [car.brand, car.model],
  );

  const fmtUsd = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  const fmtKm = new Intl.NumberFormat("ru-RU");

  return (
    <Card className="group border-border/60 bg-card/80 ring-foreground/5 hover:ring-foreground/10 flex h-full flex-col shadow-sm backdrop-blur-sm transition-shadow duration-300 hover:shadow-lg">
      <div className="relative aspect-[16/10] shrink-0 overflow-hidden">
        <Image
          src={car.photo}
          alt={titleEn}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-[transform,filter] duration-500 ease-out group-hover:scale-[1.04] group-hover:brightness-[1.02]"
          priority={priority}
          unoptimized
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-100" />
        {car.location ? (
          <Badge
            variant="secondary"
            className="absolute top-3 left-3 border-white/10 bg-black/40 text-[10px] font-medium tracking-wide text-white uppercase backdrop-blur-md"
          >
            {car.location}
          </Badge>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <CardHeader className="gap-2 pb-2">
          <h3 className="font-heading text-foreground text-lg leading-snug font-semibold tracking-tight md:text-xl">
            {titleEn}
          </h3>
          <p className="text-muted-foreground text-sm">
            {car.year}
            <span className="text-border mx-2">•</span>
            {fmtKm.format(car.mileage)} km
          </p>
        </CardHeader>
        <CardContent className="pb-3">
          <p className="text-foreground text-2xl font-semibold tracking-tight md:text-3xl">
            {fmtUsd.format(car.price)}
          </p>
        </CardContent>
        <CardFooter className="border-border/60 bg-muted/30 mt-auto border-t pt-4">
          <Button
            variant="outline"
            className="border-foreground/15 hover:bg-foreground/5 w-full bg-transparent"
            type="button"
          >
            Подробнее
          </Button>
        </CardFooter>
      </div>
    </Card>
  );
}
