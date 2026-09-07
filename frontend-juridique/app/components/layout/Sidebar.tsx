// app/components/layout/Sidebar.tsx

"use client";

import type { TranslationKeys } from "@/lib/translations";
import Image from "next/image";

import { Langue, VueActive } from "@/app/types";
import { getRoleLabel } from "@/lib/constants";
import { useTheme } from "@/context/ThemeContext";
import type { User } from "@/context/AuthContext";
interface SidebarProps {
  langue: Langue;
  setLangue: (l: Langue) => void;
  vueActive: VueActive;
  setVueActive: (v: VueActive) => void;
  user: User;
  logout: () => void;
  cur: TranslationKeys;
  canSeeEntrantAdmin: boolean;
  canSeeEntrantJuridique: boolean;
  canSeeSortantNormal: boolean;
  canSeeSortantDemande: boolean;
  canManageUsers: boolean;
  canSeeAdminSection: boolean;
  canSeeServicesAdmin: boolean;
  canSeePermissionsAdmin: boolean;
  canSeeEquipementsAdmin: boolean;
  canSeeHistoriquesAdmin: boolean;
  canSeeListesAdmin: boolean;
  canOpenDossiers: boolean;
  canTransfer: boolean;
  canViewArchives: boolean;
  canViewTransactions: boolean;
  canSearchDossiers: boolean;
  pendingNotifications?: number;
}

export function Sidebar({
  langue,
  setLangue,
  vueActive,
  setVueActive,
  user,
  logout,
  cur,
  canSeeEntrantAdmin,
  canSeeEntrantJuridique,
  canSeeSortantNormal,
  canSeeSortantDemande,
  canManageUsers,
  canSeeAdminSection,
  canSeeServicesAdmin,
  canSeePermissionsAdmin,
  canSeeEquipementsAdmin,
  canSeeHistoriquesAdmin,
  canSeeListesAdmin,
  canViewArchives,
  canViewTransactions,
  canSearchDossiers,
  pendingNotifications = 0
}: SidebarProps) {
  const { theme, toggle: toggleTheme } = useTheme();
  const navButtonClass = (active: boolean) =>
    `w-full text-xs font-semibold p-3 rounded-lg flex items-center gap-3 transition ${
      active ? "bg-blue-600 text-white shadow-md" : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
    }`;
  const sectionTitleClass = "text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-2 px-2";

  return (
    <aside className="w-80 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex flex-col border-e border-slate-200 dark:border-slate-700 shadow-sm z-10 sticky top-0 h-screen">
      <div className="p-6 border-b border-slate-100 flex items-center gap-4">
        <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl p-1 overflow-hidden flex items-center justify-center shadow-sm">
          <Image src="https://upload.wikimedia.org/wikipedia/commons/d/d5/Coat_of_arms_of_Morocco.svg" alt="Blason" width={36} height={36} className="w-full h-full object-contain" />
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-xs text-slate-900 uppercase truncate">{cur.courAppel}</h3>
          <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            {user?.nom} • {getRoleLabel(user?.role || "", langue)}
          </span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
        <div>
          <span className={sectionTitleClass}>{cur.tbd}</span>
          <button onClick={() => setVueActive("dashboard")} className={navButtonClass(vueActive === "dashboard")}>
            {cur.tbd}
          </button>
        </div>

        <div>
          <span className={sectionTitleClass}>{cur.gestion}</span>
          <div className="space-y-1">
            <button onClick={() => setVueActive("mes-entites")} className={navButtonClass(vueActive === "mes-entites")}>
              {cur.mesDocuments}
            </button>
            {canSeeEntrantAdmin && (
              <button onClick={() => setVueActive("entrant-admin")} className={navButtonClass(vueActive === "entrant-admin")}>
                {cur.admin}
              </button>
            )}
            {canSeeEntrantJuridique && (
              <button onClick={() => setVueActive("entrant-juridique")} className={navButtonClass(vueActive === "entrant-juridique")}>
                {cur.juridique}
              </button>
            )}
            {canSeeSortantNormal && (
              <button onClick={() => setVueActive("sortant-normal")} className={navButtonClass(vueActive === "sortant-normal")}>
                {cur.normalMenu}
              </button>
            )}
            {canSeeSortantDemande && (
              <button onClick={() => setVueActive("sortant-demande")} className={navButtonClass(vueActive === "sortant-demande")}>
                {cur.demandeMenu}
              </button>
            )}
            {canSearchDossiers && (
              <button onClick={() => setVueActive("recherche-dossiers")} className={navButtonClass(vueActive === "recherche-dossiers")}>
                {cur.rechercheDossiers}
              </button>
            )}
          </div>
        </div>

        <div>
          <span className={sectionTitleClass}>{cur.transactionsMenu}</span>
          <div className="space-y-1">
            {/* Admins do not participate in transfers — hide notifications */}
            {!(user.role === "Admin" || user.role === "Greffier" || user.role === "Directeur" || user.role === "Consultant") && (
              <button onClick={() => setVueActive("notifications")} className={navButtonClass(vueActive === "notifications")}>
                {cur.notifications}
                {pendingNotifications > 0 && (
                  <span className="ms-auto bg-red-500 text-white text-[9px] font-bold rounded-full h-5 min-w-5 flex items-center justify-center px-1">
                    {pendingNotifications}
                  </span>
                )}
              </button>
            )}
            {/* Admins do not participate in transfers — hide transaction register */}
            {canViewTransactions && !(user.role === "Admin" || user.role === "Greffier" || user.role === "Directeur" || user.role === "Consultant") && (
              <button onClick={() => setVueActive("transactions")} className={navButtonClass(vueActive === "transactions")}>
                {cur.registreTransactions}
              </button>
            )}
            {canViewArchives && (
              <button onClick={() => setVueActive("archives")} className={navButtonClass(vueActive === "archives")}>
                {cur.archivesJuridiques}
              </button>
            )}
          </div>
        </div>

        <div>
          <span className={sectionTitleClass}>{cur.monCompte}</span>
          <button onClick={() => setVueActive("profil")} className={navButtonClass(vueActive === "profil")}>
            {cur.monProfil}
          </button>
        </div>

        {canSeeAdminSection && (
          <div>
            <span className={sectionTitleClass}>{cur.administration}</span>
            {canManageUsers && (
              <button onClick={() => setVueActive("admin-utilisateurs")} className={navButtonClass(vueActive === "admin-utilisateurs")}>
                {cur.utilisateurs}
              </button>
            )}
            {canSeeServicesAdmin && (
              <button onClick={() => setVueActive("admin-services")} className={navButtonClass(vueActive === "admin-services")}>
                {cur.services}
              </button>
            )}
            {canSeePermissionsAdmin && (
              <button onClick={() => setVueActive("admin-permissions")} className={navButtonClass(vueActive === "admin-permissions")}>
                {cur.permissions}
              </button>
            )}
            {canSeeEquipementsAdmin && (
              <button onClick={() => setVueActive("admin-equipements")} className={navButtonClass(vueActive === "admin-equipements")}>
                {cur.equipements}
              </button>
            )}
            {canSeeHistoriquesAdmin && (
              <button onClick={() => setVueActive("admin-services-historiques")} className={navButtonClass(vueActive === "admin-services-historiques")}>
                {cur.servicesHistoriques}
              </button>
            )}
            {canSeeListesAdmin && (
              <button onClick={() => setVueActive("admin-listes")} className={navButtonClass(vueActive === "admin-listes")}>
                {cur.listesDynamiques}
              </button>
            )}
          </div>
        )}
      </nav>

      <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center gap-2">
        <div className="flex gap-1 bg-white dark:bg-slate-700 p-1 border border-slate-200 dark:border-slate-600 rounded-lg">
          <button
            type="button"
            onClick={() => setLangue("fr")}
            className={`px-3 py-1 text-[10px] font-bold rounded ${langue === "fr" ? "bg-blue-600 text-white" : "text-slate-600 dark:text-slate-300"}`}
          >
            FR
          </button>
          <button
            type="button"
            onClick={() => setLangue("ar")}
            className={`px-3 py-1 text-[10px] font-bold rounded ${langue === "ar" ? "bg-blue-600 text-white" : "text-slate-600 dark:text-slate-300"}`}
          >
            AR
          </button>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="px-2 py-1 text-[10px] font-bold rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 transition"
          title={theme === "light" ? "Mode sombre" : "Mode clair"}
        >
          {theme === "light" ? "🌙" : "☀️"}
        </button>
        <button onClick={logout} className="text-xs text-red-600 font-bold hover:underline">
          {cur.deconnexion}
        </button>
      </div>
    </aside>
  );
}