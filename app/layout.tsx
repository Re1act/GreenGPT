import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SiteNav from "@/components/SiteNav";
import "./globals.css";
import "./sizing.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "GreenGPT — a civic tool for the data center buildout",
    template: "%s — GreenGPT",
  },
  description:
    "Model why data center siting decisions have the consequences they do, see what's being built where, and find out what you can do about it.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full overflow-clip antialiased`}
    >
      {/* Fixed-height shell: the map page fills the space under the nav, while
          longer pages (simulator, brief) scroll inside the content area. */}
      <body className="fixed inset-0 flex flex-col overflow-clip">
        <SiteNav />
        <div className="min-h-0 flex-1 overflow-y-auto scroll-smooth motion-reduce:scroll-auto">{children}</div>
      </body>
    </html>
  );
}
