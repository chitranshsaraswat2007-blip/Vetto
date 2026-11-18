import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "VETTO — Brand content intelligence",
    template: "%s · VETTO",
  },
  description:
    "VETTO checks brand content against brand identity, visual direction, and governance rules before it ships.",
  applicationName: "VETTO",
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f5f2ec",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
