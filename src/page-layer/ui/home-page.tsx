"use client";

import { useCars } from "@/features/car-list/model/useCars";
import { LandingHeader } from "@/page-layer/ui/landing-header";
import { LandingHero } from "@/page-layer/ui/landing-hero";
import { RefreshCatalogBar } from "@/widgets/refresh-catalog";
import { CarList } from "@/widgets/car-list/ui/CarList";

export function HomePage() {
  const { cars, isLoading, isUpdating, refreshBanner, refreshCatalog } = useCars();

  return (
    <div className="bg-background text-foreground min-h-screen">
      <LandingHeader />
      <LandingHero />
      <RefreshCatalogBar
        isUpdating={isUpdating}
        banner={refreshBanner}
        onReload={() => void refreshCatalog()}
      />
      <CarList cars={cars} isLoading={isLoading} />
    </div>
  );
}
