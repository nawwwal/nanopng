export function SchemaMarkup() {
    const softwareAppSchema = {
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
    }

    const faqSchema = {
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
    }

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppSchema) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
            />
        </>
    )
}
