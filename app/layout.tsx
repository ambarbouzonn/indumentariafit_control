import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    title: "Indumentaria Fit · Control interno",
    description: "Ventas, stock, reservas y mercadería de Indumentaria Fit.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "Indumentaria Fit",
      description: "Control interno de ventas, stock y reservas.",
      images: [{ url: `${origin}/og.png`, width: 1536, height: 864, alt: "Indumentaria Fit · Control interno" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Indumentaria Fit",
      description: "Control interno de ventas, stock y reservas.",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={geist.variable}>{children}</body>
    </html>
  );
}
