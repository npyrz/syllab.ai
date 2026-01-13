import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Syllab.ai",
  description: "Your AI class management assistant.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="flex min-h-dvh w-full">
          <Sidebar />
          <div className="flex min-h-dvh flex-1 flex-col bg-black">
            <Header />
            <div className="flex-1">{children}</div>
            <footer className="border-t border-white/10 bg-black px-6 py-6">
              <div className="mx-auto flex max-w-6xl items-center justify-between text-xs text-zinc-400">
                <div>© {new Date().getFullYear()} Syllab.ai</div>
                <div className="flex items-center gap-6">
                  <a href="#" className="hover:text-zinc-50">
                    Privacy
                  </a>
                  <a href="#" className="hover:text-zinc-50">
                    Terms
                  </a>
                </div>
              </div>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
