import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Notifications } from '@/components/ui/notification';
import { Pwa } from '@/components/pwa';
export const metadata: Metadata = {
  title: 'Auctus · Training, recorded.',
  description: 'Plan your week, log every set, and see your strength grow. Auctus brings your programs, workouts, and progress into one focused training journal.',
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
        <Notifications>{children}</Notifications>
        <Pwa />
      </body>
    </html>
  );
}
