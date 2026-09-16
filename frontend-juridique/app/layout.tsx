import type { Metadata } from 'next';

import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { LangueSwitcher } from '@/app/components/common/LangueSwitcher';
import { FeedbackHost } from '@/app/components/common/FeedbackHost';
import './globals.css';

export const metadata: Metadata = {
  title: "Gestion Juridique — Cour d'Appel Administrative de Fès",
  description:
    "Plateforme de gestion des dossiers juridiques, courriers entrants et sortants de la Cour d'Appel Administrative de Fès.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <LangueSwitcher />
            <FeedbackHost />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
