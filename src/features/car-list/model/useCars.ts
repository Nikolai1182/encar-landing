"use client";

import { useEffect } from "react";

import { useCarListStore } from "./store";

export function useCars() {
  const cars = useCarListStore((s) => s.cars);
  const isLoading = useCarListStore((s) => s.isLoading);
  const isUpdating = useCarListStore((s) => s.isUpdating);
  const refreshBanner = useCarListStore((s) => s.refreshBanner);
  const loadCars = useCarListStore((s) => s.loadCars);
  const refreshCatalog = useCarListStore((s) => s.refreshCatalog);

  useEffect(() => {
    void loadCars();
  }, [loadCars]);

  return { cars, isLoading, isUpdating, refreshBanner, refreshCatalog };
}
