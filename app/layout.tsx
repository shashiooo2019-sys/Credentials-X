import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Staff Credential Verification Portal',
  description: 'Bi-weekly credential validation and change request portal for staff with administrative fortnight audit and master database management.',
  openGraph: {
    title: 'Staff Credential Verification Portal',
    description: 'Bi-weekly credential validation and change request portal for staff with administrative fortnight audit and master database management.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Staff Credential Verification Portal',
    description: 'Bi-weekly credential validation and change request portal for staff with administrative fortnight audit and master database management.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className="h-full w-full">
      <body className="h-full min-h-screen w-full m-0 p-0 flex flex-col bg-[#060e20] text-slate-100 antialiased overflow-x-hidden" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
