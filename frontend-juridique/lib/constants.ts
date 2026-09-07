// app/lib/constants.ts

import { Langue } from "@/app/types";

export const SERVICE_GROUPS = [
  {
    label: "JalsatWaIjra2at",
    fr: "Service des audiences",
    ar: "مصلحة الجلسات والإجراءات",
    children: [
      { value: "Ijra2Baht", fr: "Recherche", ar: "إجراء بحث" },
      { value: "MofawidMalaki", fr: "Commissaire du roi", ar: "المفوض الملكي" },
      { value: "Khibra", fr: "Expertise", ar: "الخبرة" },
      { value: "MustacharMoqarir", fr: "Conseiller rapporteur", ar: "المستشار المقرر" }
    ]
  },
  {
    label: "TaslimNusakh",
    fr: "Délivrance des copies",
    ar: "مصلحة تسليم النسخ",
    children: [
      { value: "Tabligh", fr: "Notification", ar: "التبليغ" },
      { value: "TasfiyatSawa2ir", fr: "Règlement des dépens", ar: "تصفية الصوائر" },
      { value: "Archive", fr: "Archives", ar: "الأرشيف" }
    ]
  },
  {
    label: "Services indépendants",
    fr: "Services indépendants",
    ar: "مصالح مستقلة",
    children: [
      { value: "KitabaKhasa", fr: "Secrétariat particulier", ar: "الكتابة الخاصة" },
      { value: "BureauOrdre", fr: "Bureau d'Ordre", ar: "مكتب الضبط" },
      { value: "OuvertureDossier", fr: "Ouverture des dossiers", ar: "فتح الملفات" }
    ]
  },
  {
    label: "Autres",
    fr: "Autres services",
    ar: "مصالح أخرى",
    children: [
      { value: "BureauNotification", fr: "Bureau de notification", ar: "مكتب التبليغ" },
      { value: "BureauExpertise", fr: "Bureau d'expertise", ar: "مكتب الخبرة" },
      { value: "CelluleInformatique", fr: "Cellule informatique", ar: "الوحدة المعلوماتية" },
      { value: "GestionFinanciere", fr: "Gestion financière", ar: "التسيير المالي" },
      { value: "CaisseTribunal", fr: "Caisse du tribunal", ar: "صندوق المحكمة" },
      { value: "BureauRecouvrement", fr: "Recouvrement", ar: "التحصيل" },
      { value: "ProcduresCommissaireRoyal", fr: "Procédures commissaire royal", ar: "إجراءات المفوض الملكي" },
      { value: "GestionPourvoisCassation", fr: "Pourvois en cassation", ar: "الطعن بالنقص" },
      { value: "RemiseCopieJugement", fr: "Remise copie jugement", ar: "تسليم نسخ الأحكام" },
      { value: "EfficaciteJudiciaire", fr: "Efficacité judiciaire", ar: "الكفاءة القضائية" },
      { value: "Greffe", fr: "Greffe", ar: "القلم" },
      { value: "Direction", fr: "Direction", ar: "المديرية" }
    ]
  }
];

export const STATUS_MAP: Record<string, { fr: string; ar: string }> = {
  "Nouveau": { fr: "Nouveau", ar: "جديد" },
  "EnCours": { fr: "En cours", ar: "قيد المعالجة" },
  "EnInstance": { fr: "En instance", ar: "في طور التداول" },
  "Cloture": { fr: "Clôturé", ar: "مختوم" },
  "Archive": { fr: "Archivé", ar: "مؤرشف" },
  "Brouillon": { fr: "Brouillon", ar: "مسودة" },
  "EnAttente": { fr: "En attente d'envoi", ar: "في انتظار الإرسال" },
  "Envoye": { fr: "Envoyé", ar: "مرسل" },
  "Annule": { fr: "Annulé", ar: "ملغى" },
};

export function getServiceLabel(value: string, langue: Langue): string {
  for (const group of SERVICE_GROUPS) {
    for (const child of group.children) {
      if (child.value === value) {
        return langue === "fr" ? child.fr : child.ar;
      }
    }
  }
  return getRoleLabel(value, langue);
}

export function getRoleLabel(role: string, langue: Langue): string {
  const map: Record<string, { fr: string; ar: string }> = {
    "Admin": { fr: "Administrateur", ar: "مدير النظام" },
    "Greffier": { fr: "Greffier", ar: "الكاتب القضائي" },
    "Directeur": { fr: "Directeur", ar: "المدير العام" },
    "Consultant": { fr: "Consultant", ar: "مستشار" },
    "Enregistrement": { fr: "Enregistrement", ar: "التسجيل" },
    "BureauOrdre": { fr: "Agent Bureau d'Ordre", ar: "مكتب الضبط" },
    "OuvertureDossier": { fr: "Ouverture des dossiers", ar: "فتح الملفات" },
    "KitabaKhasa": { fr: "Secrétariat particulier", ar: "الكتابة الخاصة" },
    "Jalsat": { fr: "Service des audiences", ar: "مصلحة الجلسات والإجراءات" },
    "Taslim": { fr: "Délivrance des copies", ar: "مصلحة تسليم النسخ" },
    "Notification": { fr: "Bureau de notification", ar: "مكتب التبليغ" },
    "Archive": { fr: "Archives", ar: "الأرشيف" },
    "Ijra2Baht": { fr: "Recherche", ar: "إجراء بحث" },
    "MofawidMalaki": { fr: "Commissaire du roi", ar: "المفوض الملكي" },
    "Khibra": { fr: "Expertise", ar: "الخبرة" },
    "MustacharMoqarir": { fr: "Conseiller rapporteur", ar: "المستشار المقرر" },
    "Tabligh": { fr: "Notification", ar: "التبليغ" },
    "TasfiyatSawa2ir": { fr: "Règlement des dépens", ar: "تصفية الصوائر" },
    "CelluleInformatique": { fr: "Cellule informatique", ar: "الوحدة المعلوماتية" },
    "BureauNotification": { fr: "Bureau de notification", ar: "مكتب التبليغ" },
    "BureauExpertise": { fr: "Bureau d'expertise", ar: "مكتب الخبرة" },
    "GestionFinanciere": { fr: "Gestion financière", ar: "التسيير المالي" },
    "CaisseTribunal": { fr: "Caisse du tribunal", ar: "صندوق المحكمة" },
    "BureauRecouvrement": { fr: "Recouvrement", ar: "التحصيل" },
    "ProcduresCommissaireRoyal": { fr: "Procédures commissaire royal", ar: "إجراءات المفوض الملكي" },
    "GestionPourvoisCassation": { fr: "Pourvois en cassation", ar: "الطعن بالنقص" },
    "RemiseCopieJugement": { fr: "Remise copie jugement", ar: "تسليم نسخ الأحكام" },
    "EfficaciteJudiciaire": { fr: "Efficacité judiciaire", ar: "الكفاءة القضائية" },
    "JalsatWaIjra2at": { fr: "Service des audiences", ar: "مصلحة الجلسات والإجراءات" },
    "TaslimNusakh": { fr: "Délivrance des copies", ar: "مصلحة تسليم النسخ" },
    "Expertise": { fr: "Bureau d'expertise", ar: "مكتب الخبرة" },
    "Informatique": { fr: "Cellule informatique", ar: "الوحدة المعلوماتية" },
    "Finances": { fr: "Gestion financière", ar: "التسيير المالي" },
    "Caisse": { fr: "Caisse du tribunal", ar: "صندوق المحكمة" },
    "Recouvrement": { fr: "Recouvrement", ar: "التحصيل" },
    "Procedures": { fr: "Procédures commissaire royal", ar: "إجراءات المفوض الملكي" },
    "Pourvois": { fr: "Pourvois en cassation", ar: "الطعن بالنقص" },
    "RemiseCopie": { fr: "Remise copie jugement", ar: "تسليم نسخ الأحكام" },
    "Stats": { fr: "Efficacité judiciaire", ar: "الكفاءة القضائية" },
    "Greffe": { fr: "Greffe", ar: "القلم" },
  };
  const found = map[role];
  if (found) return langue === "fr" ? found.fr : found.ar;
  return role;
}

export function getStatusLabel(value: string, langue: Langue): string {
  const mapping = STATUS_MAP[value];
  if (!mapping) return value;
  return langue === "fr" ? mapping.fr : mapping.ar;
}

export const WORKFLOW_STEPS = [
  { labelFr: "Bureau d'Ordre", labelAr: "مكتب الضبط", service: "BureauOrdre" },
  { labelFr: "Ouverture des dossiers", labelAr: "فتح الملفات", service: "OuvertureDossier" },
  { labelFr: "Secrétariat particulier", labelAr: "الكتابة الخاصة", service: "KitabaKhasa" },
  { labelFr: "Service des audiences", labelAr: "مصلحة الجلسات والإجراءات", service: "JalsatWaIjra2at" },
  { labelFr: "Délivrance & Clôture", labelAr: "مصلحة تسليم النسخ", service: "TaslimNusakh" },
  { labelFr: "Archivage définitif", labelAr: "الإيداع بالأرشيف النهائي", service: "Archive" }
];

export function getWorkflowProgress(serviceActuel: string): { step: number; total: number; pct: number; label: string } {
  const total = WORKFLOW_STEPS.length;
  const idx = WORKFLOW_STEPS.findIndex((s) => s.service === serviceActuel);
  if (idx === -1) return { step: 0, total, pct: 0, label: serviceActuel };
  return { step: idx + 1, total, pct: Math.round(((idx + 1) / total) * 100), label: `${idx + 1}/${total}` };
}

export function getDelayDays(dateStr: string): number {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export const PARENT_CHILDREN: Record<string, string[]> = {
  JalsatWaIjra2at: ["Ijra2Baht", "MofawidMalaki", "Khibra", "MustacharMoqarir"],
  TaslimNusakh: ["Tabligh", "TasfiyatSawa2ir", "Archive"],
};

export function getChildrenOf(parent: string): string[] {
  return PARENT_CHILDREN[parent] || [];
}

export function isParentService(value: string): boolean {
  return value in PARENT_CHILDREN;
}

export function expandWithChildren(services: string[]): string[] {
  const expanded = new Set<string>();
  for (const s of services) {
    expanded.add(s);
    const children = getChildrenOf(s);
    for (const c of children) expanded.add(c);
  }
  return Array.from(expanded);
}

export const USER_SERVICE_TO_ENUM: Record<string, string> = {
  "Bureau d'ordre et bureau administratif": "BureauOrdre",
  "Bureau de Gestion des Dossiers Judiciaires": "OuvertureDossier",
  "JalsatWaIjra2at": "JalsatWaIjra2at",
  "TaslimNusakh": "TaslimNusakh",
  "Bureau de Notification": "BureauNotification",
  "Archive": "Archive",
  "Greffe": "Greffe",
  "Direction": "Direction",
};
