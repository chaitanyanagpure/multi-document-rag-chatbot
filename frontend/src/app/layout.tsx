import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
})

export const metadata: Metadata = {
  title: {
    default: 'VerbaFlow AI — Enterprise Knowledge Intelligence Platform',
    template: '%s | VerbaFlow AI',
  },
  description:
    'Your Enterprise Knowledge Intelligence Platform. Multi-document RAG chatbot with advanced analytics, knowledge base management, and enterprise-grade security.',
  keywords: [
    'RAG',
    'AI chatbot',
    'knowledge base',
    'enterprise AI',
    'document intelligence',
    'VerbaFlow',
  ],
  authors: [{ name: 'VerbaFlow AI Team' }],
  creator: 'VerbaFlow AI',
  metadataBase: new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'VerbaFlow AI — Enterprise Knowledge Intelligence Platform',
    description:
      'Your Enterprise Knowledge Intelligence Platform. Multi-document RAG chatbot with advanced analytics.',
    siteName: 'VerbaFlow AI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VerbaFlow AI',
    description: 'Your Enterprise Knowledge Intelligence Platform',
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0F0F1A" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${inter.className} antialiased bg-dark-bg text-text-primary min-h-screen`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          themes={['light', 'dark']}
          disableTransitionOnChange={false}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
