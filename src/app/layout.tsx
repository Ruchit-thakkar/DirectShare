import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PwaHandler from "@/components/PwaHandler";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "DirectShare - High-Speed Offline Local File Sharing",
  description: "Fast, secure and private file sharing over Wi-Fi and Hotspot.",
  manifest: "/manifest.json",
  other: {
    "darkreader-lock": "meta",
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" }
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    title: "DirectShare - High-Speed P2P Local File Sharing",
    description: "Fast, secure and private file sharing over Wi-Fi and Hotspot.",
    siteName: "DirectShare",
    images: [
      {
        url: "https://ik.imagekit.io/devnext/ds.png",
        width: 512,
        height: 512,
        alt: "DirectShare Logo",
      }
    ],
  },
  twitter: {
    card: "summary",
    title: "DirectShare - High-Speed P2P Local File Sharing",
    description: "Fast, secure and private file sharing over Wi-Fi and Hotspot.",
    images: ["https://ik.imagekit.io/devnext/ds.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} h-full antialiased`}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
      <head>
        <link rel="icon" type="image/png" href="https://ik.imagekit.io/devnext/ds.png" />
        <link rel="icon" type="image/png" href="/ds.png" />
      </head>
      <body className="min-h-full flex flex-col bg-[#020617] text-[#f8fafc] relative overflow-x-hidden">
        <PwaHandler />
        <Navbar />
        <main className="relative z-10 flex-grow flex flex-col max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}

