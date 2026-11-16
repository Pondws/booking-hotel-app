import type { Metadata } from "next";
import { Anuphan, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Providers } from "./providers";

// One variable family for Thai and Latin (modern loopless Thai) so both scripts share metrics and weights
// (globals.css sets font-sans)
const anuphan = Anuphan({
  variable: "--font-anuphan",
  subsets: ["thai", "latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Booking Hotel — จองโรงแรมราคาจริง ยกเลิกได้ก่อนวันเข้าพัก",
  description: "ค้นหาโรงแรมตามเมืองและวันที่ เห็นห้องว่างและราคารวมจริงก่อนจอง",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${anuphan.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Providers>
          <SiteHeader />
          <div className="flex flex-1 flex-col">{children}</div>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
