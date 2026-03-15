import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PYQERA - Share Notes & PYQs',
  description: 'Help thousands of students by sharing your study materials',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
