import type React from "react"
import type { Metadata } from "next"
import { Fraunces, Work_Sans } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "sonner"
import "./globals.css"

const fontSans = Work_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
})

const fontSerif = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  axes: ["SOFT", "WONK", "opsz"]
})

export const metadata: Metadata = {
  title: "Smart Image Compression - Compress PNG & JPEG Images",
  description:
    "Compress PNG and JPEG images with intelligent optimization. Reduce file sizes by up to 80% while maintaining visual quality.",
  generator: "v0.app",
  icons: {
    icon: "/favicon.svg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${fontSans.variable} ${fontSerif.variable} font-sans antialiased`} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="bottom-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  )
}
