import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "DirectShare - High-Speed Offline Local File Sharing",
  description: "Share files directly between nearby devices over Wi-Fi or Local Area Network (LAN) using WebRTC Data Channels. Completely secure, serverless, and fast.",
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
    >
      <body className="min-h-full flex flex-col bg-[#0f172a] text-[#f8fafc] relative overflow-x-hidden">
        {/* Animated background glow blobs */}
        <div className="absolute top-[-10%] left-[10%] w-[500px] h-[500px] bg-glow-blue pointer-events-none z-0 rounded-full animate-blob" />
        <div className="absolute bottom-[20%] right-[-5%] w-[600px] h-[600px] bg-glow-purple pointer-events-none z-0 rounded-full animate-blob-reverse" />
        <div className="absolute top-[40%] left-[-10%] w-[400px] h-[400px] bg-glow-blue pointer-events-none z-0 rounded-full animate-blob" style={{ animationDelay: '4s' }} />

        <Navbar />
        <main className="relative z-10 flex-grow flex flex-col max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
