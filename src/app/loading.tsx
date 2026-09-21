export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="panel h-32 animate-pulse bg-white/70" />
        <div className="panel h-32 animate-pulse bg-white/70" />
        <div className="panel h-32 animate-pulse bg-white/70" />
      </div>
      <div className="panel mt-6 h-[28rem] animate-pulse bg-white/70" />
    </main>
  );
}
