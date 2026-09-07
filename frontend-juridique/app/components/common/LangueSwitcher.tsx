"use client";

import { useEffect } from "react";

/**
 * Client component that watches localStorage for language changes
 * and updates the <html lang> attribute accordingly.
 * This ensures the lang attribute on the <html> element always
 * reflects the current language, even on first render.
 */
export function LangueSwitcher() {
  useEffect(() => {
    const updateLang = () => {
      try {
        const savedLang = localStorage.getItem("langue");
        if (savedLang === "fr" || savedLang === "ar") {
          document.documentElement.lang = savedLang;
        }
      } catch {}
    };

    // Run on mount
    updateLang();

    // Listen for storage events (when language changes in another tab)
    window.addEventListener("storage", updateLang);

    // Poll for language changes within the same tab (since Sidebar updates localStorage)
    const interval = setInterval(updateLang, 500);

    return () => {
      window.removeEventListener("storage", updateLang);
      clearInterval(interval);
    };
  }, []);

  return null;
}
