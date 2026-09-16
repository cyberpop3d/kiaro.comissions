import type { Metadata } from 'next';
import { CommissionNotificationBridge } from '@/components/CommissionNotificationBridge';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://commissions.yontuk.com'),
  title: 'Yontuk Commissions',
  description: 'Private commission and file communication portal for Yontuk.',
  alternates: {
    canonical: '/'
  },
  openGraph: {
    title: 'Yontuk Commissions',
    description: 'Private commission and file communication portal for Yontuk.',
    url: 'https://commissions.yontuk.com/',
    type: 'website'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CommissionNotificationBridge />
        {children}
      </body>
    </html>
  );
}
