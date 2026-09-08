import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const openSans = Open_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MHM Regional Network",
  description: "Grantee & organization relationship network by MHM region",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${openSans.variable} h-dvh antialiased`}>
      <body className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
        <SiteHeader />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
