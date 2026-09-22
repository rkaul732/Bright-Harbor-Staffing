import type { Metadata, Viewport } from "next";
import { APP_NAME } from "@/shared/lib/constants";
import { TopNavigation } from "@/shared/components/TopNavigation";
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
          <TopNavigation />
          {children}
        </div>
      </body>
    </html>
  );
}
