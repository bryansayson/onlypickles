import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { PickleballLogo } from "@/components/PickleballLogo";
import { AdminProvider } from "@/components/AdminProvider";
import { AdminToggle } from "@/components/AdminToggle";
import { ThemeToggle } from "@/components/ThemeToggle";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Only Pickles",
  description: "Pickleball round robin scheduler",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem('theme')==='light')document.documentElement.classList.add('light')}catch(e){}` }} />
      </head>
      <body className={`${nunito.variable} font-sans bg-background text-foreground min-h-screen`}>
        <AdminProvider>
          <nav className="bg-zinc-950 border-b border-zinc-800 sticky top-0 z-10">
            <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-0.5">
                <PickleballLogo size={26} />
                <span className="font-black text-xl text-white tracking-tight leading-none ml-0.5">
                  nly Pickles
                </span>
              </Link>
              <div className="flex items-center gap-4">
                <div className="flex gap-4 text-sm font-semibold">
                  <Link href="/" className="text-zinc-400 hover:text-white transition-colors">
                    Sessions
                  </Link>
                  <Link href="/roster" className="text-zinc-400 hover:text-white transition-colors">
                    Roster
                  </Link>
                </div>
                <ThemeToggle />
                <AdminToggle />
              </div>
            </div>
          </nav>
          <main className="max-w-2xl mx-auto px-4 py-6">{children}</main>
        </AdminProvider>
      </body>
    </html>
  );
}
