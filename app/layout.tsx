import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import LastSeenPing from "./components/LastSeenPing";
import TimezoneSync from "./components/TimezoneSync";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type ThemeMode = "light" | "dark";

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
  icons: {
    icon: "/logo.png",
    other: {
      rel: "apple-touch-icon",
      url: "/logo.png",
    },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const userId = (session?.user as unknown as { id?: string } | undefined)?.id;

  let initialTheme: ThemeMode | null = null;
  if (userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { theme: true },
      });
      if (user?.theme === "light" || user?.theme === "dark") {
        initialTheme = user.theme;
      }
    } catch (error) {
      if ((error as { code?: string })?.code !== "P2022") {
        throw error;
      }
    }
  }

  return (
    <html lang="en" data-theme={initialTheme ?? "dark"}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <LastSeenPing />
        <TimezoneSync />
        <div className="flex min-h-dvh w-full bg-[color:var(--app-bg)] text-[color:var(--app-text)]">
          <Sidebar />
          <div className="flex min-h-dvh flex-1 flex-col bg-[color:var(--app-bg)]">
            <Header initialTheme={initialTheme} />
            <div className="flex-1">{children}</div>
            <footer className="border-t border-[color:var(--app-border)] bg-[color:var(--app-bg)] px-6 py-6">
              <div className="mx-auto flex max-w-6xl items-center justify-between text-xs text-[color:var(--app-subtle)]">
                <div>© {new Date().getFullYear()} Syllab.ai</div>
                <div className="flex items-center gap-6">
                  <a href="#" className="transition hover:text-[color:var(--app-text)]">
                    Privacy
                  </a>
                  <a href="#" className="transition hover:text-[color:var(--app-text)]">
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
