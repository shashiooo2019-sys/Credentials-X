import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'LHG Credentials Verification App',
  description: 'Bi-weekly credential validation and change request portal for LHG staff.',
  openGraph: {
    title: 'LHG Credentials Verification App',
    description: 'Bi-weekly credential validation and change request portal for LHG staff.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LHG Credentials Verification App',
    description: 'Bi-weekly credential validation and change request portal for LHG staff.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
