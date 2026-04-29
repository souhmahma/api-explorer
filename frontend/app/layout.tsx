import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "APIX — Visual API Explorer",
  description: "A lightweight Postman alternative built in the browser",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Syne:wght@400;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
