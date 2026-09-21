import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <p className="pill">404</p>
      <h1 className="mt-4 text-3xl font-medium text-harbor-midnight">Page not found</h1>
      <p className="mt-3 text-harbor-midnight/70">
        This page is not part of the current shift hub.
      </p>
      <Link href="/" className="primary-button mt-6">
        Return home
      </Link>
    </main>
  );
}
