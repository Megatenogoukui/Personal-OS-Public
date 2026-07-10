import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal OS",
  description: "Private operating system for work and life.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="/app.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
