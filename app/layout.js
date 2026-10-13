import { Urbanist } from "next/font/google";
import "./globals.css";

// Urbanist is the design's font (loaded by Next itself, no extra library).
const urbanist = Urbanist({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });

export const metadata = {
  title: "YouTube Trend Radar",
  description: "Weekly content strategy brief for Ishaan",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={urbanist.className}>{children}</body>
    </html>
  );
}
