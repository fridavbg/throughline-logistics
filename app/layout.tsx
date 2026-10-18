import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { StoreHydrator } from "@/components/layout/StoreHydrator";
import "@/styles/globals.scss";

// next/font self-hosts the fonts at build time; no request to Google from the browser.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "Throughline",
  description: "Shipment visibility across sites, operators, road and sea.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <StoreHydrator />
        {children}
      </body>
    </html>
  );
}
