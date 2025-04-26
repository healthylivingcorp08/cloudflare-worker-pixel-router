import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner" // Import the Toaster

 const geistSans = Geist({
   variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Admin Dashboard", // Updated Title
  description: "Admin panel for managing Pixel Router", // Updated Description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* AuthWrapper will be used in page.tsx */}
        {children}
        <Toaster richColors position="top-right" /> {/* Add the Toaster component */}
      </body>
    </html>
  );
}
