export function LandingHero() {
  return (
    <section className="relative overflow-hidden border-b border-white/5">
      <div className="from-primary/15 via-background to-background absolute inset-0 bg-gradient-to-br" />
      <div className="pointer-events-none absolute -top-24 right-0 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-64 w-64 rounded-full bg-slate-500/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
        <p className="text-muted-foreground mb-4 text-xs font-medium tracking-[0.25em] uppercase">
          Premium import
        </p>
        <h1 className="font-heading text-foreground mb-6 max-w-3xl text-4xl leading-[1.1] font-semibold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
          Автомобили из Кореи
        </h1>
        <p className="text-muted-foreground max-w-2xl text-base leading-relaxed sm:text-lg">
          Подбор проверенных автомобилей с прозрачной историей и доставкой. Фильтруйте по марке,
          году и бюджету — как на премиальном автосалоне.
        </p>
      </div>
    </section>
  );
}
