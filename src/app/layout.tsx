import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Pwa } from '@/components/pwa';
export const metadata: Metadata = {
  title: 'Auctus · Training, recorded.',
  description: 'Your private training journal.',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Auctus' },
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0c0e10',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Pwa />
      </body>
    </html>
  );
}
