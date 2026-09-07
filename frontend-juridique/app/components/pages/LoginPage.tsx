"use client";

import { useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { translations } from '@/lib/translations';
import type { Langue } from '@/app/types';

export default function LoginPage({ langue = "ar" }: { langue?: Langue }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login: loginUser } = useAuth();
  const [lang, setLang] = useState<Langue>(langue);
  const cur = translations[lang];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await loginUser(login, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la connexion");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md" dir={lang === "ar" ? "rtl" : "ltr"}>
        <div className="flex justify-end mb-2">
          <button
            type="button"
            onClick={() => setLang(lang === "fr" ? "ar" : "fr")}
            className="px-3 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 text-[11px] font-bold hover:bg-slate-100"
          >
            {lang === "fr" ? "عربي" : "Français"}
          </button>
        </div>
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image src="https://upload.wikimedia.org/wikipedia/commons/d/d5/Coat_of_arms_of_Morocco.svg" alt="Blason" width={64} height={64} className="w-16 h-16" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">{cur.courAppel}</h2>
          <p className="text-sm text-slate-500">{cur.loginSubtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700">{cur.login}</label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="mt-1 w-full border border-slate-300 p-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">{cur.motDePasse}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full border border-slate-300 p-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition"
          >
            {cur.seConnecter}
          </button>
        </form>
      </div>
    </div>
  );
}