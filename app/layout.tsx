import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Throughline",
  description: "Shipment visibility across sites, operators, road and sea.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
