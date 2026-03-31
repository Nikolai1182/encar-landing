"use client";

import Link from "next/link";

export function LandingHeader() {
  return (
    <header className="border-border/40 bg-background/80 sticky top-0 z-50 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:h-[4.5rem] sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="bg-primary text-primary-foreground flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold tracking-tighter">
            E
          </span>
          <span className="font-heading text-lg font-semibold tracking-tight sm:text-xl">
            Encar Korea
          </span>
        </Link>
      </div>
    </header>
  );
}
