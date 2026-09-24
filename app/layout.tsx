import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { asset } from '@/lib/utils'
import './globals.css'

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://tool.khanamir.me/matrix'
const DESCRIPTION =
  'Free visual database schema designer. Draw tables and relationships, then export SQL for MySQL, PostgreSQL or SQLite, or a PNG/SVG ER diagram. Import existing SQL. Runs in your browser, no sign-up.'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL.endsWith('/') ? APP_URL : `${APP_URL}/`),
  title: 'MatrixForge — Database Schema Designer',
  description: DESCRIPTION,
  applicationName: 'MatrixForge',
  authors: [{ name: 'Mohd Amir Khan', url: 'https://khanamir.me' }],
  keywords: ['database schema designer', 'ER diagram', 'ERD tool', 'SQL generator', 'MySQL', 'PostgreSQL', 'SQLite', 'data modeling'],
  alternates: { canonical: './' },
  openGraph: {
    type: 'website',
    url: './',
    title: 'MatrixForge — Database Schema Designer',
    description: DESCRIPTION,
    images: [{ url: asset('/thumbnail.png'), width: 1200, height: 630, alt: 'MatrixForge schema designer' }],
  },
  twitter: { card: 'summary_large_image', images: [asset('/thumbnail.png')] },
  icons: {
    icon: [
      { url: asset('/icon.svg'), type: 'image/svg+xml' },
      { url: asset('/icon-dark-32x32.png'), sizes: '32x32', type: 'image/png' },
    ],
    apple: asset('/apple-icon.png'),
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // The canvas implements its own pinch-zoom; stop the browser from zooming the whole UI
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0d1311',
  colorScheme: 'dark',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>{children}</body>
    </html>
  )
}
