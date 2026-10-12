import "./globals.css";

export const metadata = {
  title: "YouTube Trend Radar",
  description: "Weekly content strategy brief for Ishaan",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
