import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { LangueSwitcher } from '@/app/components/common/LangueSwitcher';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <LangueSwitcher />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
