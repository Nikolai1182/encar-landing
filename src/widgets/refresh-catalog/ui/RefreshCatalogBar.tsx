"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@/shared/ui/button";

type RefreshCatalogBarProps = {
  isUpdating: boolean;
  /** Сообщение после последнего запроса «Обновить данные» (успех или ошибка). */
  banner: { variant: "success" | "error"; text: string } | null;
  onReload: () => void;
};

export function RefreshCatalogBar({ isUpdating, banner, onReload }: RefreshCatalogBarProps) {
  return (
    <div className="mx-auto mb-6 flex max-w-7xl flex-col items-end gap-2 px-4 pt-2 sm:px-6 lg:px-8">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isUpdating}
        onClick={onReload}
        className="border-foreground/15 gap-2"
        aria-busy={isUpdating}
      >
        <RefreshCw
          className={`size-4 ${isUpdating ? "animate-spin" : ""}`}
          aria-hidden
        />
        Обновить данные
      </Button>
      {banner ? (
        <p
          role="status"
          className={
            banner.variant === "success"
              ? "text-sm text-emerald-700 dark:text-emerald-400"
              : "text-sm text-destructive"
          }
        >
          {banner.text}
        </p>
      ) : null}
    </div>
  );
}
