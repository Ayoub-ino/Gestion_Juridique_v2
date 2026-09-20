// app/lib/constants.ts

import { Langue } from "@/app/types";

export const SERVICE_GROUPS = [
  {
    label: "JalsatWaIjra2at",
    fr: "Séances & audiences",
    ar: "الجلسات والإجراءات",
    children: [
      { value: "Ijra2Baht", fr: "Enquête & recherche", ar: "البحث والتحقيق" },
      { value: "MofawidMalaki", fr: "Commissaire du roi", ar: "المفوض الملكي" },
      { value: "Khibra", fr: "Expertise judiciaire", ar: "الخبرة القضائية" },
      { value: "MustacharMoqarir", fr: "Conseiller rapporteur", ar: "المستشار المقرر" }
    ]
  },
  {
    label: "TaslimNusakh",
    fr: "Délivrance des copies",
    ar: "قسم تسليم النسخ",
    children: [
      { value: "Tabligh", fr: "Signification", ar: "التبليغ" },
      { value: "TasfiyatSawa2ir", fr: "Règlement des dépens", ar: "تسوية المصاريف" },
      { value: "Archive", fr: "Archives", ar: "الأرشيف" }
    ]
  },
  {
    label: "Services indépendants",
    fr: "Services indépendants",
    ar: "المصالح المستقلة",
    children: [
      { value: "KitabaKhasa", fr: "Secrétariat particulier", ar: "الكتابة الخاصة" },
      { value: "BureauOrdre", fr: "Bureau d'ordre", ar: "مكتب الضبط" },
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
      { value: "GestionPourvoisCassation", fr: "Pourvois en cassation", ar: "الطعن بالنقض" },
      { value: "RemiseCopieJugement", fr: "Remise copie jugement", ar: "تسليم نسخ الأحكام" },
      { value: "EfficaciteJudiciaire", fr: "Efficacité judiciaire", ar: "الكفاءة القضائية" },
      { value: "Greffe", fr: "Greffe", ar: "كتاب الضبط" },
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
    "Greffier": { fr: "Greffier", ar: "كاتب الضبط" },
    "Directeur": { fr: "Directeur", ar: "المدير العام" },
    "Consultant": { fr: "Consultant", ar: "مستشار" },
    "Enregistrement": { fr: "Enregistrement", ar: "التسجيل" },
    "BureauOrdre": { fr: "Agent Bureau d'ordre", ar: "مكتب الضبط" },
    "OuvertureDossier": { fr: "Ouverture des dossiers", ar: "فتح الملفات" },
    "KitabaKhasa": { fr: "Secrétariat particulier", ar: "الكتابة الخاصة" },
    "Jalsat": { fr: "Service des audiences", ar: "مصلحة الجلسات والإجراءات" },
    "Taslim": { fr: "Délivrance des copies", ar: "مصلحة تسليم النسخ" },
    "Notification": { fr: "Bureau de notification", ar: "مكتب التبليغ" },
    "Archive": { fr: "Archives", ar: "الأرشيف" },
    "Ijra2Baht": { fr: "Enquête & recherche", ar: "البحث والتحقيق" },
    "MofawidMalaki": { fr: "Commissaire du roi", ar: "المفوض الملكي" },
    "Khibra": { fr: "Expertise judiciaire", ar: "الخبرة القضائية" },
    "MustacharMoqarir": { fr: "Conseiller rapporteur", ar: "المستشار المقرر" },
    "Tabligh": { fr: "Signification", ar: "التبليغ" },
    "TasfiyatSawa2ir": { fr: "Règlement des dépens", ar: "تسوية المصاريف" },
    "CelluleInformatique": { fr: "Cellule informatique", ar: "الوحدة المعلوماتية" },
    "BureauNotification": { fr: "Bureau de notification", ar: "مكتب التبليغ" },
    "BureauExpertise": { fr: "Bureau d'expertise", ar: "مكتب الخبرة" },
    "GestionFinanciere": { fr: "Gestion financière", ar: "التسيير المالي" },
    "CaisseTribunal": { fr: "Caisse du tribunal", ar: "صندوق المحكمة" },
    "BureauRecouvrement": { fr: "Recouvrement", ar: "التحصيل" },
    "ProcduresCommissaireRoyal": { fr: "Procédures commissaire royal", ar: "إجراءات المفوض الملكي" },
    "GestionPourvoisCassation": { fr: "Pourvois en cassation", ar: "الطعن بالنقض" },
    "RemiseCopieJugement": { fr: "Remise copie jugement", ar: "تسليم نسخ الأحكام" },
    "EfficaciteJudiciaire": { fr: "Efficacité judiciaire", ar: "الكفاءة القضائية" },
    "JalsatWaIjra2at": { fr: "Séances & audiences", ar: "الجلسات والإجراءات" },
    "TaslimNusakh": { fr: "Délivrance des copies", ar: "قسم تسليم النسخ" },
    "Expertise": { fr: "Bureau d'expertise", ar: "مكتب الخبرة" },
    "Informatique": { fr: "Cellule informatique", ar: "الوحدة المعلوماتية" },
    "Finances": { fr: "Gestion financière", ar: "التسيير المالي" },
    "Caisse": { fr: "Caisse du tribunal", ar: "صندوق المحكمة" },
    "Recouvrement": { fr: "Recouvrement", ar: "التحصيل" },
    "Procedures": { fr: "Procédures commissaire royal", ar: "إجراءات المفوض الملكي" },
    "Pourvois": { fr: "Pourvois en cassation", ar: "الطعن بالنقض" },
    "RemiseCopie": { fr: "Remise copie jugement", ar: "تسليم نسخ الأحكام" },
    "Stats": { fr: "Efficacité judiciaire", ar: "الكفاءة القضائية" },
    "Greffe": { fr: "Greffe", ar: "كتاب الضبط" },
  };
  const found = map[role];
  if (found) return langue === "fr" ? found.fr : found.ar;
  return humanizeCode(role);
}

/**
 * Last-resort display for an identifier with no known label.
 * Turns `seancesProcedures`, `seances_procedures` or `seances-procedures`
 * into "Seances Procedures" so a raw service code is never shown to the user.
 * Values that are already words ("User", "Archive") are left untouched.
 */
function humanizeCode(value: string): string {
  if (!value) return value;
  const spaced = value
    .replace(/[_-]+/g, " ")
    .replace(/&/g, " & ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  return spaced
    .split(" ")
    .map((word) =>
      word.length > 1 ? word.charAt(0).toUpperCase() + word.slice(1) : word
    )
    .join(" ");
}

export function getStatusLabel(value: string, langue: Langue): string {
  const mapping = STATUS_MAP[value];
  if (!mapping) return value;
  return langue === "fr" ? mapping.fr : mapping.ar;
}

// ── Workflow pipeline ─────────────────────────────────────────────────────────
// The dashboard pipeline used to be a fixed six-step list, which meant a service
// added from the admin panel could never appear in it. The stages are now simply
// the services that exist in the RBAC catalog, so they follow it automatically.

export interface WorkflowStep {
  /** RBAC service code — the value documents carry. */
  code: string;
  /** Display name, as registered for that service. */
  label: string;
}

/** A service as returned by `/api/rbac/services`. */
export interface CatalogService {
  id: number;
  nom: string;
  code: string;
  parentId?: number | null;
  isActive: boolean;
}

/**
 * Orders the catalog into the pipeline.
 *
 * A parent service is followed by its own sub-services, and each group keeps the
 * catalog's creation order. Nothing about the stages is hardcoded: create a
 * service and it joins the pipeline, archive it and it leaves.
 */
export function buildWorkflowSteps(services: CatalogService[]): WorkflowStep[] {
  const active = services.filter((s) => s.isActive).sort((a, b) => a.id - b.id);
  const ids = new Set(active.map((s) => s.id));
  const ordered: CatalogService[] = [];

  for (const service of active) {
    // Children are emitted together with their parent.
    if (service.parentId != null && ids.has(service.parentId)) continue;
    ordered.push(service);
    ordered.push(...active.filter((s) => s.parentId === service.id));
  }

  return ordered.map((s) => ({ code: s.code, label: s.nom }));
}

/** Case/separator-insensitive service reference, for matching codes and enum names. */
function normalizeRef(value: string | number | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Index of a service inside the pipeline, or -1 when it is not one of the stages. */
export function workflowStepIndexOf(steps: WorkflowStep[], serviceRef: string | null | undefined): number {
  const target = normalizeRef(serviceRef);
  if (!target) return -1;
  return steps.findIndex((s) => normalizeRef(s.code) === target);
}

/**
 * Where a folder sits in the pipeline. The stages are passed in because they come
 * from the live catalog — there is no stage list to read them from here.
 */
export function getWorkflowProgress(
  steps: WorkflowStep[],
  serviceRef: string | null | undefined
): { step: number; total: number; pct: number; label: string } {
  const total = steps.length;
  if (total === 0) return { step: 0, total: 0, pct: 0, label: "—" };

  const idx = workflowStepIndexOf(steps, serviceRef);
  // A folder sitting somewhere that is not a pipeline stage has no progress:
  // showing it as step 0 is honest, showing it as the last step is not.
  if (idx === -1) return { step: 0, total, pct: 0, label: `0/${total}` };

  return {
    step: idx + 1,
    total,
    pct: Math.round(((idx + 1) / total) * 100),
    label: `${idx + 1}/${total}`,
  };
}

export function getDelayDays(dateStr: string): number {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
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
