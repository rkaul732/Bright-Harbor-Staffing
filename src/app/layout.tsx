import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { APP_NAME } from "@/shared/lib/constants";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description:
    "Mobile-first staffing hub for Bright Harbor employees and admins."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#eef5fb"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <header className="sticky top-0 z-40 border-b border-harbor-ocean/10 bg-harbor-mist/80 backdrop-blur-xl">
            <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
              <Link
                href="/"
                className="focus-ring rounded-md text-sm font-medium text-harbor-midnight"
              >
                {APP_NAME}
              </Link>
              <div className="flex items-center gap-1">
                <Link href="/auth?role=employee" className="secondary-button px-3 py-2">
                  Employee Login
                </Link>
                <Link href="/auth?role=admin" className="secondary-button px-3 py-2">
                  Admin Login
                </Link>
              </div>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
