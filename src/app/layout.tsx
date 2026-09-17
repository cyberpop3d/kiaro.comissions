import type { Metadata } from 'next';
import { CommissionNotificationBridge } from '@/components/CommissionNotificationBridge';
import { YontukBrandBridge } from '@/components/YontukBrandBridge';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://commissions.yontuk.com'),
  title: 'Yontuk Commissions',
  description: 'Private commission and file communication portal for Yontuk.',
  alternates: {
    canonical: '/'
  },
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true
    }
  },
  icons: {
    icon: '/icon.svg'
  },
  openGraph: {
    title: 'Yontuk Commissions',
    description: 'Private commission and file communication portal for Yontuk.',
    url: 'https://commissions.yontuk.com/',
    type: 'website'
  },
  twitter: {
    card: 'summary',
    title: 'Yontuk Commissions',
    description: 'Private commission and file communication portal for Yontuk.'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CommissionNotificationBridge />
        <YontukBrandBridge />
        {children}
      </body>
    </html>
  );
}
