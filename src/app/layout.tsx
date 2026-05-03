import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const serif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "BioForge",
  description: "Turn a scientific hypothesis into an operational experiment plan.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body className="h-screen overflow-hidden flex flex-col">
        <header className="border-b border-ink-200/70 bg-ink-100/80 backdrop-blur supports-[backdrop-filter]:bg-ink-100/60 flex-shrink-0">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <div className="font-serif text-[17px] leading-tight tracking-tightish text-ink-900">
                  BioForge
                </div>
                <div className="text-xs text-ink-500 leading-tight mt-0.5">
                  Hypothesis → operational experiment plan
                </div>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-hidden">{children}</main>
      </body>
    </html>
  );
}
