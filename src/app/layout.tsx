import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import { APP_NAME } from "@/shared/lib/constants";
import { TopNavigation } from "@/shared/components/TopNavigation";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm-sans"
});

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
    <html lang="en" className={dmSans.variable}>
      <body>
        <div className="min-h-screen">
          <TopNavigation />
          {children}
        </div>
      </body>
    </html>
  );
}
