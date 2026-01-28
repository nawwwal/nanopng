import type React from "react"
import type { Metadata } from "next"
import { Fraunces, Work_Sans } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "sonner"
import { Analytics } from "@vercel/analytics/react"
import Script from "next/script"
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
  metadataBase: new URL("https://nanopng.com"),
  title: "Free PNG & JPEG Compressor - No Upload Required | NanoPNG",
  description:
    "Compress PNG, JPEG, WebP, AVIF images up to 80% smaller. Runs entirely in your browser - no uploads, no signup, completely free. Your files never leave your device.",
  openGraph: {
    title: "Free PNG & JPEG Compressor - Privacy-First Image Optimization",
    description: "Compress images up to 80% smaller. Runs locally in your browser - no uploads, no limits, completely free.",
    type: "website",
    images: ["/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "NanoPNG - Free PNG & JPEG Compressor",
    description: "Compress images 80% smaller. Runs locally - no uploads, no limits.",
    images: ["/twitter-image.png"],
  },
  alternates: {
    canonical: "/",
  },
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
      <head>
        <Script
          id="schema-software"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "NanoPNG",
              "applicationCategory": "MultimediaApplication",
              "operatingSystem": "Web Browser",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              },
              "featureList": "PNG compression, JPEG compression, WebP conversion, AVIF conversion, SVG optimization, Client-side processing, Batch image optimization, Privacy-first compression",
              "description": "Free online image compression tool that runs entirely in your browser. Compress PNG, JPEG, WebP, AVIF, HEIC, and SVG images without uploading to servers."
            })
          }}
        />
        <Script
          id="schema-faq"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              "mainEntity": [
                {
                  "@type": "Question",
                  "name": "Is NanoPNG really free?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Yes, NanoPNG is 100% free with no limits. There's no premium tier, no signup required, and no file size restrictions. It runs entirely in your browser using WebAssembly."
                  }
                },
                {
                  "@type": "Question",
                  "name": "How does local compression work?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "NanoPNG uses WebAssembly to run compression algorithms directly in your browser. Your images never leave your device - all processing happens locally, which means faster speeds and complete privacy."
                  }
                },
                {
                  "@type": "Question",
                  "name": "How is NanoPNG different from other image compressors?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "NanoPNG processes images entirely in your browser using WebAssembly - your files never leave your device. This means no upload time, complete privacy, and no file limits. It supports PNG, JPEG, WebP, AVIF, HEIC, and SVG formats."
                  }
                },
                {
                  "@type": "Question",
                  "name": "What image formats are supported?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "NanoPNG supports PNG, JPEG, WebP, AVIF, HEIC/HEIF, and SVG files. You can also convert between formats during compression."
                  }
                },
                {
                  "@type": "Question",
                  "name": "What's the maximum file size?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "NanoPNG can handle files up to 50MB each, and you can process up to 100 images at once. Since processing happens locally, there are no server-side restrictions."
                  }
                }
              ]
            })
          }}
        />
      </head>
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
        <Analytics />
      </body>
    </html>
  )
}
