"use client";

import { useState, useEffect, useRef, useCallback, Suspense, lazy } from "react";
import { useAuth } from "@/context/AuthContext";
import LoginPage from "@/app/components/pages/LoginPage";

// ── Eagerly loaded (shown on first render) ──
import { Sidebar } from "@/app/components/layout/Sidebar";
import { DashboardView } from "@/app/components/dashboard/DashboardView";

// ── Lazy-loaded (only shown on user interaction) ──
const AdminForm = lazy(() => import("@/app/components/forms/AdminForm").then(m => ({ default: m.AdminForm })));
const JuridiqueForm = lazy(() => import("@/app/components/forms/JuridiqueForm").then(m => ({ default: m.JuridiqueForm })));
const SortantForm = lazy(() => import("@/app/components/forms/SortantForm").then(m => ({ default: m.SortantForm })));
const TransferModal = lazy(() => import("@/app/components/modals/TransferModal").then(m => ({ default: m.TransferModal })));
const DetailModal = lazy(() => import("@/app/components/modals/DetailModal").then(m => ({ default: m.DetailModal })));
const GestionUtilisateurs = lazy(() => import("@/app/components/admin/GestionUtilisateurs").then(m => ({ default: m.GestionUtilisateurs })));
const GestionServices = lazy(() => import("@/app/components/admin/GestionServices").then(m => ({ default: m.GestionServices })));
const GestionPermissions = lazy(() => import("@/app/components/admin/GestionPermissions").then(m => ({ default: m.GestionPermissions })));
const GestionEquipements = lazy(() => import("@/app/components/admin/GestionEquipements").then(m => ({ default: m.GestionEquipements })));
const GestionListes = lazy(() => import("@/app/components/admin/GestionListes").then(m => ({ default: m.GestionListes })));
const NotificationsPage = lazy(() => import("@/app/components/pages/NotificationsPage").then(m => ({ default: m.NotificationsPage })));
const TransactionsPage = lazy(() => import("@/app/components/pages/TransactionsPage").then(m => ({ default: m.TransactionsPage })));
const ProfilPage = lazy(() => import("@/app/components/pages/ProfilPage").then(m => ({ default: m.ProfilPage })));
const WorkspaceModal = lazy(() => import("@/app/components/modals/WorkspaceModal").then(m => ({ default: m.WorkspaceModal })));
const ImportMappingModal = lazy(() => import("@/app/components/modals/ImportMappingModal").then(m => ({ default: m.ImportMappingModal })));
const ArchiveRetraitPage = lazy(() => import("@/app/components/pages/ArchiveRetraitPage").then(m => ({ default: m.ArchiveRetraitPage })));
const MesDossiersEnCoursView = lazy(() => import("@/app/components/pages/MesDossiersEnCoursView").then(m => ({ default: m.MesDossiersEnCoursView })));
const GestionServicesHistoriques = lazy(() => import("@/app/components/admin/GestionServicesHistoriques").then(m => ({ default: m.GestionServicesHistoriques })));
const MesEntitesView = lazy(() => import("@/app/components/pages/MesEntitesView").then(m => ({ default: m.MesEntitesView })));
const ArchivesView = lazy(() => import("@/app/components/pages/ArchivesView").then(m => ({ default: m.ArchivesView })));
const RechercheDossiersView = lazy(() => import("@/app/components/pages/RechercheDossiersView").then(m => ({ default: m.RechercheDossiersView })));
const SortantTable = lazy(() => import("@/app/components/tables/SortantTable").then(m => ({ default: m.SortantTable })));

import { translations } from "@/lib/translations";
import { normalizeStatus, getDocKey, getErrorMessage } from "@/lib/utils";
import { getServiceLabel, getStatusLabel, USER_SERVICE_TO_ENUM, WORKFLOW_STEPS } from "@/lib/constants";
import { useDocuments } from "@/app/hooks/useDocuments";
import { exportRows, importFromFile, downloadExcelTemplate, ExportFormat, ExportRow } from "@/lib/exportImport";
import { useListItems } from "@/app/hooks/useListItems";
import { api, ApiError } from "@/lib/api/client";
import { Langue, VueActive, CourrierSimule, LocalRetrait } from "@/app/types";

// API payload shapes for the shell's local lists (mirror backend projections).
interface TransactionHistoryEntry {
  id: number;
  serviceOrigine: string;
  serviceDestination: string;
  date: string;
  remarques?: string;
  statut: string;
  commentaire?: string;
  motifRefus?: string;
  doitRevenir?: boolean;
}

interface RetournerDoc {
  id: number;
  documentId: number;
  documentSujet: string;
  sourceServiceId: string;
  destinationServiceId: string;
  message?: string;
  statut: string;
  dateEnvoi: string;
  doitRevenir: boolean;
}

interface CorbeilleDoc {
  id: number;
  reference: string;
  objet: string;
  serviceActuel: string;
}

export default function Home() {
  const { user, token, isAuthenticated, logout, hasPermission } = useAuth();
  const [langue, setLangue] = useState<Langue>("ar");
  const [vueActive, setVueActive] = useState<VueActive>("dashboard");
  const cur = translations[langue];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [reference, setReference] = useState("");
  const [tiers, setTiers] = useState("");
  const [objet, setObjet] = useState("");
  const [, setDestinataireExterne] = useState("");
  const [dateEnvoi, setDateEnvoi] = useState("");

  const [source, setSource] = useState("");
  const [dateArrivee, setDateArrivee] = useState("");
  const [dateMessage, setDateMessage] = useState("");
  const [numeroInterne, setNumeroInterne] = useState("");
  const [anneeNumerotation, setAnneeNumerotation] = useState("");
  const [transmissible, setTransmissible] = useState("Oui");
  const [etat, setEtat] = useState("");
  const [notes, setNotes] = useState("");
  const [fichier, setFichier] = useState<File | null>(null);
  const [modeTraitement, setModeTraitement] = useState("");
  const [serviceDestinataire, setServiceDestinataire] = useState("");
  const [servicesDiffusion, setServicesDiffusion] = useState<string[]>([]);

  const [circuitJuridique, setCircuitJuridique] = useState("");
  const [etapeService, setEtapeService] = useState<number>(1);
  const [etapeJalsat, setEtapeJalsat] = useState("");
  const [etapeTaslim, setEtapeTaslim] = useState("");
  const [autoriteRetrait, setAutoriteRetrait] = useState("");
  const [typeException, setTypeException] = useState("");
  const [numeroDossierAppel, setNumeroDossierAppel] = useState("");
  const [typeProcedure, setTypeProcedure] = useState("ordinaire");
  const [numCourAppel, setNumCourAppel] = useState("");
  const [conseillerRapporteur, setConseillerRapporteur] = useState("");
  const [dateAudience, setDateAudience] = useState("");
  const [statutSousService, setStatutSousService] = useState("");
  const [commentaireSousService, setCommentaireSousService] = useState("");

  const [docLie, setDocLie] = useState("");
  const [dossierPrincipal, setDossierPrincipal] = useState("");
  const [sourceDocLie, setSourceDocLie] = useState("");
  const [parentDossier, setParentDossier] = useState("");
  const [juridiqueDate, setJuridiqueDate] = useState("");
  const [numeroBureauOrdre, setNumeroBureauOrdre] = useState("");
  const [autoYearSuffix, setAutoYearSuffix] = useState("");
  const [juridiqueEtat, setJuridiqueEtat] = useState("");
  const [juridiqueService, setJuridiqueService] = useState("");
  const [typeDossier, setTypeDossier] = useState("");
  const [numeroPremiereInstance, setNumeroPremiereInstance] = useState("");
  const [juridiqueNotes, setJuridiqueNotes] = useState("");
  const [juridiqueFichier, setJuridiqueFichier] = useState<File | null>(null);

  const [serviceSortant, setServiceSortant] = useState("");
  const [numeroBureauOrdreSortant, setNumeroBureauOrdreSortant] = useState("");
  const [notesSortant, setNotesSortant] = useState("");
  const [fichierSortant, setFichierSortant] = useState<File | null>(null);
  const [tribunalOrigineSortant, setTribunalOrigineSortant] = useState("");
  const [tribunalDestinationSortant, setTribunalDestinationSortant] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [searchFilterService, setSearchFilterService] = useState("");
  const [searchFilterType, setSearchFilterType] = useState("");
  const [searchFilterDateDebut, setSearchFilterDateDebut] = useState("");
  const [searchFilterDateFin, setSearchFilterDateFin] = useState("");
  const [selectedDocument, setSelectedDocument] = useState<CourrierSimule | null>(null);
  const [workflowDocId, setWorkflowDocId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [historiqueActions, setHistoriqueActions] = useState<TransactionHistoryEntry[]>([]);
  const [hiddenDocKeys] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [docOverrides, setDocOverrides] = useState<Record<number, Partial<CourrierSimule>>>({});
  const [transferModalDoc, setTransferModalDoc] = useState<CourrierSimule | null>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [transferMessage, setTransferMessage] = useState("");
  const [transferMustReturn, setTransferMustReturn] = useState(false);
  const [transferTargetUserId, setTransferTargetUserId] = useState<number | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [pendingNotifications, setPendingNotifications] = useState(0);
  const [notificationRefreshTrigger, setNotificationRefreshTrigger] = useState(0);
  const [selectedDocIds, setSelectedDocIds] = useState<number[]>([]);
  const [transactionStats, setTransactionStats] = useState({ total: 0, acceptes: 0, refuses: 0, enAttente: 0, pourcentage: 0 });
  const [localRetraits] = useState<LocalRetrait[]>([]);
  const [showRetournerModal, setShowRetournerModal] = useState(false);
  const [retournerDocs, setRetournerDocs] = useState<RetournerDoc[]>([]);
  const [filtreStatutSortant, setFiltreStatutSortant] = useState("tous");
  const [showCorbeille, setShowCorbeille] = useState(false);
  const [corbeilleDocs, setCorbeilleDocs] = useState<CorbeilleDoc[]>([]);
  const [localFiles, setLocalFiles] = useState<{ name: string; content: string; path: string }[]>([]);
  const [searchLocalFiles, setSearchLocalFiles] = useState(false);
  const [retraitDoc, setRetraitDoc] = useState<{ id: number; reference: string; objet: string } | null>(null);
  const [batchTransferDocs, setBatchTransferDocs] = useState<CourrierSimule[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, setErrorMessage] = useState("");
  const [workspaceDocId, setWorkspaceDocId] = useState<number | null>(null);

  const { listeCourriers, refetch } = useDocuments(token, langue, vueActive);

  const fetchPending = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.get<{ count: number }>("/api/Transactions/count-pending", token);
      setPendingNotifications(data.count || 0);
    } catch (err) {
      // 401 means token expired — silently ignore (will redirect on next interaction)
      if (err instanceof ApiError && err.status === 401) {
        setPendingNotifications(0);
        return;
      }
      console.error("Fetch pending error:", err);
    }
    try {
      const statsData = await api.get<typeof transactionStats>("/api/Transactions/stats", token);
      setTransactionStats(statsData);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setTransactionStats({ total: 0, acceptes: 0, refuses: 0, enAttente: 0, pourcentage: 0 });
        return;
      }
      console.error("Fetch stats error:", err);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchPending();
    const interval = setInterval(fetchPending, 30000);
    return () => clearInterval(interval);
  }, [fetchPending, token]);

  // Listes dynamiques depuis l'API
  const { getOptions: getListOptions } = useListItems(token);
  const sourceOptions = getListOptions("sources_courrier", langue);
  const etatOptions = getListOptions("etats_document", langue);

  const role = user?.role || "";
  const isAdmin = role === "Admin" || role === "admin";
  const isGreffier = role === "Greffier" || role === "greffier";
  // Admin section is permission-driven: each management view requires its own
  // gerer_* permission (admin keeps them all — they are not override-disabled).
  const canManageUsers = isAdmin || hasPermission("gerer_utilisateurs");
  const canSeeServicesAdmin = isAdmin || isGreffier || hasPermission("gerer_services");
  const canSeePermissionsAdmin = isAdmin || hasPermission("gerer_permissions");
  const canSeeEquipementsAdmin = isAdmin || isGreffier || hasPermission("gerer_equipements");
  const canSeeHistoriquesAdmin = isAdmin || hasPermission("gerer_services");
  const canSeeListesAdmin = isAdmin || isGreffier || hasPermission("gerer_listes");
  const canSeeAdminSection = canManageUsers || canSeeServicesAdmin || canSeePermissionsAdmin || canSeeEquipementsAdmin || canSeeListesAdmin;
  const userService = user?.service || "";

  // Enhanced permission-based gates with admin override support
  const canCreateEntrantAdmin = hasPermission("creer_courrier_admin");
  const canCreateEntrantJuridique = hasPermission("creer_courrier_juridique");
  const canCreateSortantNormal = hasPermission("creer_modifier");
  const canCreateSortantDemande = hasPermission("creer_modifier");
  const canOpenDossiers = hasPermission("ouvrir_dossier");
  const canTransfer = hasPermission("transferer");
  const canViewArchives = hasPermission("archives_view");
  const canViewTransactions = hasPermission("transactions");
  const canSearchDossiers = hasPermission("recherche_avancee");
  const canDelete = hasPermission("supprimer");
  const canArchive = hasPermission("archiver");
  const canRetrait = hasPermission("retrait_archive");

  const isJalsatService = userService === "JalsatWaIjra2at" || isAdmin;
  const isTaslimService = userService === "TaslimNusakh" || isAdmin;
  const canSeeEntrantAdmin = canCreateEntrantAdmin;
  const canSeeEntrantJuridique = canCreateEntrantJuridique;
  const canSeeSortantNormal = true; // tous les services voient les sortants
  const canSeeSortantDemande = true; // tous les services voient les sortants
  const isFormView = ["entrant-admin", "entrant-juridique", "sortant-normal", "sortant-demande"].includes(vueActive);
  // Only render the create-form when the user may create that type of courrier
  // (backend enforces the same via [RequirePermission]).
  const canUseForm =
    (vueActive === "entrant-admin" && canCreateEntrantAdmin) ||
    (vueActive === "entrant-juridique" && canCreateEntrantJuridique) ||
    (vueActive === "sortant-normal" && canCreateSortantNormal) ||
    (vueActive === "sortant-demande" && canCreateSortantDemande);

  // Route-level protection: redirect to dashboard if user navigates to a hidden view
  const isAdminLike = role === "Admin" || role === "Greffier" || role === "Directeur" || role === "Consultant";
  useEffect(() => {
    const viewPermissionMap: Record<string, boolean> = {
      "admin-utilisateurs": canManageUsers,
      "admin-services": canSeeServicesAdmin,
      "admin-permissions": canSeePermissionsAdmin,
      "admin-equipements": canSeeEquipementsAdmin,
      "admin-services-historiques": canSeeHistoriquesAdmin,
      "admin-listes": canSeeListesAdmin,
      "entrant-admin": canSeeEntrantAdmin,
      "entrant-juridique": canSeeEntrantJuridique,
      "recherche-dossiers": canSearchDossiers,
      "transactions": canViewTransactions && !isAdminLike,
      "archives": canViewArchives,
    };
    if (viewPermissionMap[vueActive] === false || vueActive === "mes-dossiers-en-cours") {
      setVueActive("dashboard");
    }
    // Admins do not receive transfer notifications — redirect to dashboard
    if (vueActive === "notifications" && isAdminLike) {
      setVueActive("dashboard");
    }
  }, [vueActive, isAdminLike, canManageUsers, canSeeServicesAdmin, canSeePermissionsAdmin, canSeeEquipementsAdmin, canSeeHistoriquesAdmin, canSeeListesAdmin, canSeeEntrantAdmin, canSeeEntrantJuridique, canSearchDossiers, canViewTransactions, canViewArchives]);

  // Trigger notification refresh when user navigates to notifications view
  useEffect(() => {
    if (vueActive === "notifications") {
      setNotificationRefreshTrigger(prev => prev + 1);
    }
  }, [vueActive]);

  const displayedCourriers = listeCourriers.map((doc) => ({ ...doc, ...(docOverrides[doc.id] || {}) }));
  const visibleCourriers = displayedCourriers.filter((doc) => !hiddenDocKeys.includes(getDocKey(doc)) && !hiddenDocKeys.includes(String(doc.id)));

  const generalDocs = visibleCourriers.filter((doc) => doc.type !== "sortant-normal" && doc.type !== "sortant-demande");
  const sortantDocs = visibleCourriers.filter((doc) => doc.type === "sortant-normal" || doc.type === "sortant-demande");

  const filteredGeneral = generalDocs.filter((doc: CourrierSimule) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      doc.objet.toLowerCase().includes(s) ||
      doc.reference.toLowerCase().includes(s) ||
      doc.source.toLowerCase().includes(s) ||
      doc.serviceActuel.toLowerCase().includes(s) ||
      (doc.destinataireExterne && doc.destinataireExterne.toLowerCase().includes(s))
    );
  });

  const filteredSortant = sortantDocs.filter((doc: CourrierSimule) => {
    let matchSearch = true;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      matchSearch = !!(
        doc.objet.toLowerCase().includes(s) ||
        doc.reference.toLowerCase().includes(s) ||
        doc.source.toLowerCase().includes(s) ||
        doc.serviceActuel.toLowerCase().includes(s) ||
        (doc.destinataireExterne && doc.destinataireExterne.toLowerCase().includes(s))
      );
    }
    let matchStatut = true;
    if (filtreStatutSortant !== "tous") {
      const statutBrut = normalizeStatus(doc.statut);
      matchStatut = statutBrut === filtreStatutSortant;
    }
    return matchSearch && matchStatut;
  });

  const filteredSortantNormal = filteredSortant.filter((doc) => doc.type === "sortant-normal");
  const filteredSortantDemande = filteredSortant.filter((doc) => doc.type === "sortant-demande");

  const totalDocs = visibleCourriers.length || 1;
  const mapToGroup = (s: string): string => {
    if (s === "Nouveau" || s === "EnCours" || s === "EnInstance" || s === "EnAttente" || s === "Brouillon") return "EnAttente";
    if (s === "Cloture" || s === "Envoye" || s === "Archive") return "Traite";
    if (s === "Annule") return "Annule";
    return "EnAttente";
  };
  const countByGroup = (group: string) => visibleCourriers.filter((doc: CourrierSimule) => mapToGroup(normalizeStatus(doc.statut)) === group).length;

  const SERVICE_COLORS: Record<string, string> = {
    "BureauOrdre": "#3b82f6",
    "OuvertureDossier": "#8b5cf6",
    "KitabaKhasa": "#06b6d4",
    "JalsatWaIjra2at": "#f59e0b",
    "TaslimNusakh": "#10b981",
    "Archive": "#6b7280",
    "BureauNotification": "#ec4899",
    "BureauExpertise": "#14b8a6",
    "CelluleInformatique": "#6366f1",
    "GestionFinanciere": "#f97316",
    "CaisseTribunal": "#84cc16",
    "BureauRecouvrement": "#ef4444",
    "ProcduresCommissaireRoyal": "#a855f7",
    "GestionPourvoisCassation": "#0ea5e9",
    "RemiseCopieJugement": "#22c55e",
    "Greffe": "#e11d48",
    "Direction": "#1e293b",
  };
  const SERVICE_LABELS: Record<string, string> = langue === "ar" ? {
    "BureauOrdre": "مكتب الضبط",
    "OuvertureDossier": "فتح الملفات",
    "KitabaKhasa": "الكتابة الخاصة",
    "JalsatWaIjra2at": "الجلسات والإجراءات",
    "Ijra2Baht": "البحث والتحقيق",
    "MofawidMalaki": "المفوض الملكي",
    "Khibra": "الخبرة القضائية",
    "MustacharMoqarir": "المستشار المقرر",
    "TaslimNusakh": "قسم تسليم النسخ",
    "Tabligh": "التبليغ",
    "TasfiyatSawa2ir": "تسوية المصاريف",
    "Archive": "الأرشيف",
    "BureauNotification": "مكتب التبليغ",
    "BureauExpertise": "مكتب الخبرة",
    "CelluleInformatique": "الوحدة المعلوماتية",
    "EfficaciteJudiciaire": "الكفاءة القضائية",
    "GestionFinanciere": "التسيير المالي",
    "CaisseTribunal": "صندوق المحكمة",
    "BureauRecouvrement": "التحصيل",
    "ProcduresCommissaireRoyal": "إجراءات المفوض الملكي",
    "GestionPourvoisCassation": "الطعن بالنقض",
    "RemiseCopieJugement": "تسليم نسخ الأحكام",
    "Greffe": "القلم",
    "Direction": "المديرية",
    "Enregistrement": "التسجيل",
    "Consultant": "مستشار",
    "Directeur": "المدير العام",
  } : {
    "BureauOrdre": "Bureau d'ordre",
    "OuvertureDossier": "Ouverture des dossiers",
    "KitabaKhasa": "Secrétariat particulier",
    "JalsatWaIjra2at": "Séances & audiences",
    "Ijra2Baht": "Enquête & recherche",
    "MofawidMalaki": "Commissaire du roi",
    "Khibra": "Expertise judiciaire",
    "MustacharMoqarir": "Conseiller rapporteur",
    "TaslimNusakh": "Délivrance des copies",
    "Tabligh": "Signification",
    "TasfiyatSawa2ir": "Règlement des dépens",
    "Archive": "Archives",
    "BureauNotification": "Bureau de notification",
    "BureauExpertise": "Bureau d'expertise",
    "CelluleInformatique": "Cellule informatique",
    "EfficaciteJudiciaire": "Efficacité judiciaire",
    "GestionFinanciere": "Gestion financière",
    "CaisseTribunal": "Caisse du tribunal",
    "BureauRecouvrement": "Recouvrement",
    "ProcduresCommissaireRoyal": "Procédures commissaire royal",
    "GestionPourvoisCassation": "Pourvois en Cassation",
    "RemiseCopieJugement": "Remise Copie Jugement",
    "Greffe": "Greffe",
    "Direction": "Direction",
    "Enregistrement": "Enregistrement",
    "Consultant": "Consultant",
    "Directeur": "Directeur",
  };

  const statusStats = (() => {
    const statuses = [
      { key: "EnAttente", label: cur.statEnAttente, count: countByGroup("EnAttente"), color: "#f59e0b" },
      { key: "Traite", label: cur.statAcceptees, count: countByGroup("Traite"), color: "#10b981" },
      { key: "Refuse", label: cur.statRefusees, count: 0, color: "#ef4444" },
      { key: "Annule", label: cur.statAnnulees, count: countByGroup("Annule"), color: "#6b7280" },
    ];

    if (isAdmin || isGreffier) {
      const serviceBreakdown: Record<string, Record<string, number>> = {};
      statuses.forEach((s) => { serviceBreakdown[s.key] = {}; });
      visibleCourriers.forEach((doc) => {
        const group = mapToGroup(normalizeStatus(doc.statut));
        const svc = doc.serviceActuelKey || "Autres";
        if (!serviceBreakdown[group]) serviceBreakdown[group] = {};
        serviceBreakdown[group][svc] = (serviceBreakdown[group][svc] || 0) + 1;
      });
      return { statuses, serviceBreakdown, SERVICE_COLORS, SERVICE_LABELS };
    }

    return { statuses, serviceBreakdown: null, SERVICE_COLORS: null, SERVICE_LABELS: null };
  })();

  const docsArchives = visibleCourriers.filter((doc: CourrierSimule) => normalizeStatus(doc.statut) === "Archive").length + localRetraits.length;
  const activityCards = [
    { title: cur.notifications, value: transactionStats.enAttente, view: "transactions" as VueActive, accent: "bg-amber-500" },
    { title: cur.transactionsTraitees, value: transactionStats.acceptes, view: "transactions" as VueActive, accent: "bg-emerald-500" },
    { title: cur.docsRetourner, value: transactionStats.refuses, view: "transactions" as VueActive, accent: "bg-indigo-500" }
  ];

  const selectedWorkflowDoc = visibleCourriers.find((doc: CourrierSimule) => doc.id === workflowDocId) ||
    (searchTerm ? visibleCourriers.find((doc: CourrierSimule) =>
      doc.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.objet.toLowerCase().includes(searchTerm.toLowerCase())
    ) : null) ||
    filteredGeneral.find((doc: CourrierSimule) => doc.serviceActuelKey === USER_SERVICE_TO_ENUM[userService]) ||
    filteredGeneral.find((doc: CourrierSimule) => doc.type === "entrant-juridique") ||
    filteredGeneral[0] || visibleCourriers[0] || null;

  const WORKFLOW_SERVICE_MAP: Record<string, number> = {
    "BureauOrdre": 0,
    "OuvertureDossier": 1,
    "KitabaKhasa": 2,
    "JalsatWaIjra2at": 3,
    "Ijra2Baht": 3,
    "MofawidMalaki": 3,
    "Khibra": 3,
    "MustacharMoqarir": 3,
    "TaslimNusakh": 4,
    "Tabligh": 4,
    "TasfiyatSawa2ir": 4,
    "Archive": 5,
    "BureauNotification": 3,
    "BureauExpertise": 3,
    "CelluleInformatique": 3,
    "GestionFinanciere": 3,
    "CaisseTribunal": 3,
    "BureauRecouvrement": 3,
    "ProcduresCommissaireRoyal": 3,
    "GestionPourvoisCassation": 3,
    "RemiseCopieJugement": 4,
    "Greffe": 2,
    "Direction": 0,
  };

  const getWorkflowIndex = (doc: CourrierSimule | null) => {
    if (!doc) return 0;
    const key = doc.serviceActuelKey || "";
    if (WORKFLOW_SERVICE_MAP[key] !== undefined) return WORKFLOW_SERVICE_MAP[key];
    const service = doc.serviceActuel.toLowerCase();
    if (service.includes("archive") || service.includes("الأرشيف") || service.includes("مؤرشف")) return 5;
    if (service.includes("taslim") || service.includes("tabligh") || service.includes("tasfiya") || service.includes("نسخ") || service.includes("التبليغ") || service.includes("الصوائر")) return 4;
    if (service.includes("jalsat") || service.includes("audience") || service.includes("recherche") || service.includes("expertise") || service.includes("rapporteur") || service.includes("الجلسات") || service.includes("الخبرة") || service.includes("المقرر")) return 3;
    if (service.includes("kitaba") || service.includes("secrétariat") || service.includes("الكتابة")) return 2;
    if (service.includes("ouverture") || service.includes("فتح")) return 1;
    return 0;
  };
  const workflowCurrentIndex = getWorkflowIndex(selectedWorkflowDoc);

  const docsPerStep = WORKFLOW_STEPS.map((ws) => {
    return visibleCourriers.filter((doc) => {
      const key = doc.serviceActuelKey || "";
      if (WORKFLOW_SERVICE_MAP[key] !== undefined) {
        const stepIndex = WORKFLOW_SERVICE_MAP[key];
        if (ws.service === "BureauOrdre") return stepIndex === 0;
        if (ws.service === "OuvertureDossier") return stepIndex === 1;
        if (ws.service === "KitabaKhasa") return stepIndex === 2;
        if (ws.service === "JalsatWaIjra2at") return stepIndex === 3;
        if (ws.service === "TaslimNusakh") return stepIndex === 4;
        if (ws.service === "Archive") return stepIndex === 5;
      }
      return false;
    }).length;
  });

  const recentActivity = visibleCourriers.slice(0, 6).map((d) => ({
    type: d.type,
    label: getServiceLabel(d.serviceActuel, langue),
    reference: d.reference,
    time: d.date,
    doc: d,
  }));

  const serviceLoadMap: Record<string, number> = {};
  visibleCourriers.forEach((d) => {
    const key = d.serviceActuelKey || d.serviceActuel;
    serviceLoadMap[key] = (serviceLoadMap[key] || 0) + 1;
  });
  const serviceLoad = Object.entries(serviceLoadMap)
    .map(([service, count]) => ({ service, count, label: getServiceLabel(service, langue) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const fetchCorbeille = async () => {
    if (!token) return;
    try {
      setCorbeilleDocs(await api.get("/api/Documents/corbeille", token));
    } catch (err) { console.error("Fetch corbeille error:", err); alert(cur.erreurChargement); }
  };

  const restoreDocument = async (id: number) => {
    if (!token) return;
    try {
      await api.patch(`/api/Documents/${id}/restaurer`, undefined, token);
      await fetchCorbeille();
      await refetch();
      alert(cur.documentRestauré);
    } catch (e) {
      alert(`${cur.erreurRestauration}: ${getErrorMessage(e)}`);
    }
  };

  const permanentDeleteDocument = async (id: number) => {
    if (!token) return;
    try {
      await api.delete(`/api/Documents/${id}/permanent`, token);
      await fetchCorbeille();
      alert(langue === "fr" ? "Document supprimé définitivement" : "تم الحذف نهائياً");
    } catch (e) {
      alert(getErrorMessage(e));
    }
  };

  const searchLocalDirectory = async () => {
    try {
      const w = window as typeof window & { showDirectoryPicker?: (opts?: { mode: string }) => Promise<FileSystemDirectoryHandle> };
      if (typeof w.showDirectoryPicker !== "function") {
        alert(cur.navigateurNonSupport);
        return;
      }
      const dirHandle = await w.showDirectoryPicker({ mode: "read" });
      const files: { name: string; content: string; path: string }[] = [];

      const readDir = async (dir: FileSystemDirectoryHandle, path: string) => {
        // The TS DOM lib doesn't declare the async-iteration helpers on
        // FileSystemDirectoryHandle yet — browsers do implement values().
        const values = (dir as FileSystemDirectoryHandle & { values(): AsyncIterableIterator<FileSystemHandle> }).values();
        for await (const entry of values) {
          const entryPath = path ? `${path}/${entry.name}` : entry.name;
          if (entry.kind === "file" && (entry.name.endsWith(".pdf") || entry.name.endsWith(".doc") || entry.name.endsWith(".docx") || entry.name.endsWith(".txt") || entry.name.endsWith(".csv") || entry.name.endsWith(".xlsx") || entry.name.endsWith(".xls"))) {
            try {
              const file = await (entry as FileSystemFileHandle).getFile();
              if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
                const arrayBuffer = await file.arrayBuffer();
                const XLSX = await import("xlsx");
                const wb = XLSX.read(arrayBuffer, { type: "array" });
                let allText = "";
                for (const sheetName of wb.SheetNames) {
                  const ws = wb.Sheets[sheetName];
                  const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];
                  allText += jsonData.map((row) => row.join(" ")).join("\n") + "\n";
                }
                files.push({ name: file.name, content: allText, path: entryPath });
              } else if (file.name.endsWith(".doc") || file.name.endsWith(".docx")) {
                const arrayBuffer = await file.arrayBuffer();
                const mammoth = await import("mammoth");
                const result = await mammoth.extractRawText({ arrayBuffer });
                files.push({ name: file.name, content: result.value, path: entryPath });
              } else if (file.name.endsWith(".pdf")) {
                const arrayBuffer = await file.arrayBuffer();
                const pdfjsLib = await import("pdfjs-dist");
                pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                let fullText = "";
                for (let i = 1; i <= pdf.numPages; i++) {
                  const page = await pdf.getPage(i);
                  const content = await page.getTextContent();
                  fullText += content.items.map((item) => ("str" in item ? item.str : "")).join(" ") + "\n";
                }
                files.push({ name: file.name, content: fullText, path: entryPath });
              } else {
                const text = await file.text();
                files.push({ name: file.name, content: text, path: entryPath });
              }
            } catch (fileErr) { console.error("File read error:", entry.name, fileErr); }
          } else if (entry.kind === "directory") {
            await readDir(entry as FileSystemDirectoryHandle, entryPath);
          }
        }
      };

      await readDir(dirHandle, "");
      setLocalFiles(files);
      setSearchLocalFiles(true);
      alert(cur.fichiersTrouves(files.length));
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      if (!isAbort) {
        alert(cur.erreurAccesFichiers);
      }
    }
  };

  const getLocalSearchResults = (term: string) => {
    if (!term || localFiles.length === 0) return [];
    const lower = term.toLowerCase();
    return localFiles
      .filter(f => f.name.toLowerCase().includes(lower) || f.content.toLowerCase().includes(lower))
      .map(f => ({
        name: f.name,
        path: f.path,
        snippet: f.content
          ? f.content.substring(Math.max(0, f.content.toLowerCase().indexOf(lower) - 40), f.content.toLowerCase().indexOf(lower) + 60) + "..."
          : ""
      }));
  };

  const exportGeneralDocs = (format: ExportFormat) => {
    const rows = filteredGeneral.map((doc) => ({
      [cur.exporterTitre]: doc.objet,
      [cur.exporterReference]: doc.reference,
      [cur.exporterType]: doc.type,
      [cur.exporterDate]: doc.date,
      [cur.exporterSource]: doc.source,
      [cur.exporterService]: getServiceLabel(doc.serviceActuel, langue),
      [cur.exporterStatut]: doc.statut
    }));
    exportRows(rows, "courriers_entrants", format, cur.entrants);
  };

  const toggleDocSelect = (id: number) => {
    setSelectedDocIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  const selectAllDocs = () => {
    if (selectedDocIds.length === filteredGeneral.length) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(filteredGeneral.map((d) => d.id));
    }
  };

  const exportSelectedDocs = (format: ExportFormat) => {
    const docs = filteredGeneral.filter((d) => selectedDocIds.includes(d.id));
    const rows = docs.map((doc) => ({
      [cur.exporterTitre]: doc.objet,
      [cur.exporterReference]: doc.reference,
      [cur.exporterType]: doc.type,
      [cur.exporterDate]: doc.date,
      [cur.exporterSource]: doc.source,
      [cur.exporterService]: getServiceLabel(doc.serviceActuel, langue),
      [cur.exporterStatut]: doc.statut
    }));
    exportRows(rows, "selection_export", format, `${cur.entrants} (${docs.length})`);
  };

  const exportSortantDocs = (format: ExportFormat) => {
    const rows = filteredSortant.map((doc) => ({
      [cur.exporterTitre]: doc.objet,
      [cur.exporterReference]: doc.reference,
      [cur.exporterType]: doc.typeSortant || doc.type,
      [cur.exporterDate]: doc.date,
      [cur.exporterSource]: doc.source,
      [cur.tribunalOrigine || "Tribunal origine"]: doc.tribunalOrigine || "",
      [cur.tribunalDestination || "Tribunal destination"]: doc.tribunalDestination || "",
      [cur.exporterDestinataire]: doc.destinataireExterne || "",
      [cur.exporterStatut]: doc.statut
    }));
    exportRows(rows, "courriers_sortants", format, cur.sortants);
  };

  const exportAdminData = async (format: ExportFormat, type: string) => {
    if (!token) return;
    try {
      let url = "";
      if (type === "utilisateurs") url = "/api/Auth/users";
      else if (type === "services") url = "/api/Services";
      else if (type === "equipements") url = "/api/Equipment";
      else if (type === "listes") url = "/api/ListItem";
      else if (type === "notifications") url = "/api/Transactions";
      if (!url) return;
      const data = await api.get<unknown[]>(url, token);
      if (!Array.isArray(data) || data.length === 0) {
        alert(cur.aucuneDonneeExport);
        return;
      }
      const rows = (data as Record<string, unknown>[]).map((item) => {
        const row: Record<string, string> = {};
        Object.keys(item).forEach((key) => {
          if (key !== "id" && key !== "password" && key !== "token") {
            row[key] = String(item[key] ?? "");
          }
        });
        return row;
      });
      exportRows(rows, type, format, String((cur as Record<string, unknown>)[type] || "") || type);
    } catch {
      alert(cur.erreurExport);
    }
  };

  const exportNotifications = async (format: ExportFormat) => {
    if (!token) return;
    try {
      const data = await api.get<unknown[]>("/api/Transactions", token);
      if (!Array.isArray(data) || data.length === 0) {
        alert(cur.aucuneDonneeExport);
        return;
      }
      const rows = (data as Record<string, unknown>[]).map((t) => ({
        [cur.tblType]: String(t.documentSujet || ""),
        [cur.tblSource]: String(t.sourceServiceName || t.sourceServiceId || ""),
        [cur.tblDest]: String(t.destinationServiceName || t.destinationServiceId || ""),
        [cur.statut]: String(t.statut || ""),
        [cur.commentaire]: String(t.message || ""),
        [cur.tblDate]: String(t.dateTransaction || ""),
      }));
      exportRows(rows, "notifications", format, cur.notifications);
    } catch {
      alert(cur.erreurExport);
    }
  };

  const [, setImportFileName] = useState("");
  const [, setImportFile] = useState<File | null>(null);

  const [showMappingModal, setShowMappingModal] = useState(false);
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [mappedImportData, setMappedImportData] = useState<ExportRow[]>([]);



  const handleImportExcelFile = async (file: File) => {
    if (!token) return;
    try {
      const result = await importFromFile(file);
      const data = result.data;
      if (data.length === 0) {
        alert(cur.aucuneDonneeFichier);
        return;
      }
      // Always show mapping modal for Excel files
      const columns = result.columns;
      setExcelColumns(columns.length > 0 ? columns : ["Colonne 1"]);
      setMappedImportData(data);
      setImportFileName(file.name);
      setImportFile(file);
      setShowMappingModal(true);
    } catch (err) {
      alert(getErrorMessage(err) || cur.erreurImport);
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    try {
      const result = await importFromFile(file);
      const data = result.data;
      if (data.length === 0) {
        alert(cur.aucuneDonneeFichier);
        e.target.value = "";
        return;
      }
      // Always show mapping modal for Excel files
      const columns = result.columns;
      setExcelColumns(columns.length > 0 ? columns : ["Colonne 1"]);
      setMappedImportData(data);
      setImportFileName(file.name);
      setImportFile(file);
      setShowMappingModal(true);
    } catch (err) {
      alert(getErrorMessage(err) || cur.erreurImport);
    }
    e.target.value = "";
  };

  const confirmMappedImport = async (mapping: Record<string, string>) => {
    if (mappedImportData.length === 0) return;

    // Map each row using the column mapping
    const mappedRows: Record<string, string>[] = mappedImportData.map((row) => {
      const mappedRow: Record<string, string> = {};
      for (const [excelCol, dbField] of Object.entries(mapping)) {
        if (row[excelCol] !== undefined) {
          mappedRow[dbField] = String(row[excelCol] ?? "");
        }
      }
      return mappedRow;
    });

    // Determine doc type from the mapping or data
    const hasTypeField = mappedRows.some(r => r.typeCircuit);
    const docType = hasTypeField && mappedRows.some(r => r.typeCircuit?.includes("juridique"))
      ? "juridique"
      : "admin";

    // Single POST to backend import endpoint
    try {
      const result = await api.post<{ message?: string; success?: number; errors?: number }>(
        "/api/ExcelImport",
        { docType, mapping, rows: mappedRows },
        token
      );

      alert(result.message || (langue === "fr"
        ? `Import terminé: ${result.success} succès, ${result.errors} erreurs`
        : `تم الاستيراد: ${result.success} نجاح, ${result.errors} أخطاء`));
    } catch (err) {
      alert(getErrorMessage(err) || "Erreur lors de l'import / خطأ أثناء الاستيراد");
    }

    setShowMappingModal(false);
    setMappedImportData([]);
    setExcelColumns([]);
    setImportFile(null);
    await refetch();
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      let endpoint = "";
      let body: Record<string, unknown> = {};

      const numeroOrdreFinal = reference.trim();

      if (!numeroOrdreFinal) {
        alert(cur.entrerReference);
        setIsSubmitting(false);
        return;
      }

      if (vueActive === "entrant-admin") {
        if (!modeTraitement) {
          alert(cur.choisirModeTraitement);
          setIsSubmitting(false);
          return;
        }
        endpoint = "/api/CourrierAdmin";
        body = {
          numeroOrdre: numeroOrdreFinal,
          expediteur: tiers,
          objet: objet,
          dateReception: new Date().toISOString(),
          typeCircuit: "standard",
          numeroReference: numeroOrdreFinal,
          modeTraitement: modeTraitement,
          serviceDestinataire: modeTraitement === "unique" ? serviceDestinataire : null,
          servicesDiffusion: modeTraitement === "diffusion" ? servicesDiffusion : null,
          source: source,
          dateArrivee: dateArrivee,
          dateMessage: dateMessage,
          numeroInterne: numeroInterne,
          anneeNumerotation: anneeNumerotation,
          transmissible: transmissible === "Oui",
          etat: etat,
          notes: notes,
          fichier: fichier ? fichier.name : null
        };
      } else if (vueActive === "entrant-juridique") {
        endpoint = "/api/CourrierJuridique";
        body = {
          reference: numeroOrdreFinal,
          objet: objet,
          provenance: tiers,
          circuit: circuitJuridique,
          typeCircuit: circuitJuridique === "kitaba_khasa" ? "exception" : "classique",
          motifException: circuitJuridique === "kitaba_khasa" ? typeException : null,
          jalsatTransaction: circuitJuridique === "maktab_dabt" ? etapeJalsat : null,
          taslimTransaction: circuitJuridique === "maktab_dabt" ? etapeTaslim : null,
          autoriteRetrait: (circuitJuridique === "maktab_dabt" && etapeTaslim === "archive") ? autoriteRetrait : null,
          etapeService: etapeService,
          numeroDossierAppel: numeroDossierAppel,
          numeroBureauOrdre: numeroBureauOrdre || numeroOrdreFinal,
          demandeur: tiers || "",
          etatGlobal: etat || "En cours",
          etapeJalsatActuelle: etapeJalsat || "ijra2_baht",
          typeProcedure: typeProcedure,
          numCourAppel: numCourAppel,
          conseillerRapporteur: conseillerRapporteur,
          dateAudience: dateAudience,
        };
      } else if (vueActive === "sortant-normal" || vueActive === "sortant-demande") {
        endpoint = "/api/CourrierSortant";
        body = {
          destinataire: tiers,
          reference: numeroOrdreFinal,
          objet: objet,
          typeSortant: vueActive === "sortant-normal" ? "normal" : "demande",
          dateEnvoi: dateEnvoi || new Date().toISOString(),
          numeroEnvoi: numeroOrdreFinal,
          statut: "Brouillon",
          service: serviceSortant,
          numeroBureauOrdre: numeroBureauOrdreSortant,
          notes: notesSortant,
          fichier: fichierSortant ? fichierSortant.name : null,
          tribunalOrigine: tribunalOrigineSortant,
          tribunalDestination: tribunalDestinationSortant
        };
      } else {
        alert(cur.enregistrementSimule);
        await refetch();
        resetForm();
        setIsSubmitting(false);
        return;
      }

      const data = await api.post<{
        courrier?: { id: number };
        dossier?: { id: number };
        sortant?: { id: number };
        id?: number;
        message?: string;
      }>(endpoint, body, token);
      const docId = data.courrier?.id || data.dossier?.id || data.sortant?.id || data.id;

      // Upload file if one was selected
      const currentFile = vueActive === "entrant-admin" ? fichier : vueActive === "entrant-juridique" ? juridiqueFichier : fichierSortant;
      if (docId && currentFile) {
        const fd = new FormData();
        fd.append("file", currentFile);
        try {
          await api.send(`/api/FileUpload/${docId}`, "POST", fd, token);
        } catch (uploadErr) {
          console.error("Upload error:", uploadErr);
          alert(cur.erreurBackend);
        }
      }

      // Wait 500ms for DB to commit, then refetch
      await new Promise(r => setTimeout(r, 500));
      await refetch();

      alert(data.message || cur.enregistreSuccesPoint);
      await refetch();
      resetForm();
      setVueActive("dashboard");
    } catch (error) {
      console.error("Erreur submit:", error);
      let msg = getErrorMessage(error) || "Erreur inconnue";
      // Traduire les erreurs backend en FR/AR
      if (msg.includes("numéro d'ordre existe déjà")) {
        msg = cur.errNumExiste;
      } else if (msg.includes("Données invalides")) {
        msg = cur.errDonneesInvalides;
      } else if (msg.includes("Erreur serveur")) {
        msg = cur.errServeur;
      }
      setErrorMessage(msg);
      alert(cur.erreurPrefix + msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setReference("");
    setTiers("");
    setObjet("");
    setDestinataireExterne("");
    setDateEnvoi("");
    setSource("");
    setDateArrivee("");
    setDateMessage("");
    setNumeroInterne("");
    setAnneeNumerotation("");
    setTransmissible("Oui");
    setEtat("");
    setNotes("");
    setFichier(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setCircuitJuridique("");
    setEtapeService(1);
    setEtapeJalsat("");
    setEtapeTaslim("");
    setAutoriteRetrait("");
    setTypeException("");
    setModeTraitement("");
    setServiceDestinataire("");
    setServicesDiffusion([]);
    setNumeroDossierAppel("");
    setTypeProcedure("ordinaire");
    setNumCourAppel("");
    setConseillerRapporteur("");
    setDateAudience("");
    setStatutSousService("");
    setCommentaireSousService("");
    setDocLie("");
    setDossierPrincipal("");
    setSourceDocLie("");
    setParentDossier("");
    setJuridiqueDate("");
    setNumeroBureauOrdre("");
    setAutoYearSuffix("");
    setJuridiqueEtat("");
    setJuridiqueService("");
    setTypeDossier("");
    setNumeroPremiereInstance("");
    setJuridiqueNotes("");
    setJuridiqueFichier(null);
    setServiceSortant("");
    setNumeroBureauOrdreSortant("");
    setNotesSortant("");
    setFichierSortant(null);
    setTribunalOrigineSortant("");
    setTribunalDestinationSortant("");
  };

  const toggleSelected = (id: number) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const openTransfer = (doc: CourrierSimule) => {
    setTransferModalDoc(doc);
    setSelectedServices([]);
    setTransferMessage("");
    setTransferMustReturn(false);
    setTransferTargetUserId(null);
    setSelectedUserIds([]);
  };

  const confirmTransfer = async (services?: string[]) => {
    if (!canTransfer) { alert(cur.permissionRefusee); return; }
    const docsToProcess = (batchTransferDocs.length > 0 ? batchTransferDocs : (transferModalDoc ? [transferModalDoc] : [])).filter(doc => doc.transmissible !== "Non");
    if (docsToProcess.length === 0) return;
    const servicesToTransfer = services || selectedServices;
    if (servicesToTransfer.length === 0) {
      alert(cur.choisirServiceDest);
      return;
    }

    if (!token) {
      alert(cur.sessionExpiree);
      return;
    }

    let successCount = 0;
    let failCount = 0;
    let lastError = "";

    // Build a set of known Historique service codes for flagging
    let historicalCodes: Set<string> = new Set();
    try {
      const histServices = await api.get<{ code: string }[]>("/api/historical-services", token);
      historicalCodes = new Set(histServices.map((s) => s.code));
    } catch { /* ignore */ }

    for (const doc of docsToProcess) {
      for (const svc of servicesToTransfer) {
        try {
          const isHistorical = historicalCodes.has(svc);
          // Send all selected user IDs (multi-user routing)
          // If no users selected, send null (route to all service users)
          const userIdsToSend = selectedUserIds.length > 0 ? selectedUserIds : (transferTargetUserId ? [transferTargetUserId] : null);
          await api.post(
            "/api/Transfer",
            {
              documentId: doc.id,
              documentType: doc.type,
              serviceDestination: svc,
              message: transferMessage || null,
              doitRevenir: transferMustReturn,
              targetUserId: userIdsToSend?.[0] || null,
              targetUserIds: userIdsToSend,
              isHistoricalService: isHistorical,
            },
            token
          );
          successCount++;
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            alert(cur.sessionExpiree);
            logout();
            setTransferModalDoc(null);
            setBatchTransferDocs([]);
            setSelectedServices([]);
            setTransferMessage("");
            setTransferTargetUserId(null);
            setSelectedUserIds([]);
            return;
          }
          failCount++;
          console.error(`Transfer ${doc.reference} to ${svc} error:`, err);
          const errStatus = err instanceof ApiError ? err.status : 0;
          lastError = `(${svc}: ${errStatus || getErrorMessage(err) || "réseau"})`;
        }
      }
    }

    if (successCount > 0) {
      alert(langue === "fr"
        ? `${successCount} transfert(s) réussi(s)${failCount > 0 ? ` (${failCount} échec(s) ${lastError})` : ""}`
        : `تم ${successCount} تحويل بنجاح${failCount > 0 ? ` (${failCount} فشل ${lastError})` : ""}`);
      await refetch();
      fetchPending();
    } else {
      const hint = lastError.includes("401")
        ? (langue === "fr" ? "\n\nToken invalide. Reconnectez-vous." : "\n\nرمز غير صالح. أعد تسجيل الدخول.")
        : lastError.includes("fetch")
          ? (langue === "fr" ? "\n\nBackend inaccessible. Vérifiez que le serveur tourne sur port 5200." : "\n\nالخادم غير متاح. تأكد من تشغيل الخادم على البورت 5200.")
          : "";
      alert(cur.echecTransfert + lastError + hint);
    }

    setTransferModalDoc(null);
    setBatchTransferDocs([]);
    setSelectedIds([]);
    setSelectedDocIds([]);
    setSelectedServices([]);
    setTransferMessage("");
    setTransferTargetUserId(null);
    setSelectedUserIds([]);
  };

  const archiveSelection = async () => {
    if (!canArchive) { alert(cur.permissionRefusee); return; }
    const updates = selectedIds.reduce<Record<number, Partial<CourrierSimule>>>((acc, id) => {
      acc[id] = { serviceActuel: getServiceLabel("Archive", langue), statut: getStatusLabel("Archive", langue) };
      return acc;
    }, {});
    setDocOverrides((current) => ({ ...current, ...updates }));
    if (token && selectedIds.length > 0) {
      try {
        await api.post("/api/Documents/archive-batch", { ids: selectedIds }, token);
        await refetch();
      } catch (err) {
        console.warn("Archivage local uniquement:", err);
        alert(cur.erreurBackend);
      }
    }
    setSelectedIds([]);
  };

  const changerStatutSortant = async (id: number, nouveauStatut: string) => {
    setDocOverrides((current) => ({
      ...current,
      [id]: { ...(current[id] || {}), statut: getStatusLabel(nouveauStatut, langue) },
    }));
    if (!token) return;
    try {
      await api.put(`/api/CourrierSortant/${id}`, { statut: nouveauStatut }, token);
      await refetch();
    } catch (err) {
      console.warn("Statut appliqué localement, backend inaccessible:", err);
      alert(cur.erreurBackend);
    }
  };

  const handleDelete = async (doc: CourrierSimule) => {
    if (!canDelete) { alert(cur.permissionRefusee); return; }
    const confirmMsg = langue === "fr"
      ? "Voulez-vous vraiment supprimer ce document ?"
      : "هل تريد بالتأكيد حذف هذه الوثيقة ؟";
    if (!confirm(confirmMsg)) return;

    const endpoint = doc.type === "entrant-juridique"
      ? `/api/CourrierJuridique/${doc.id}`
      : doc.type === "sortant-normal" || doc.type === "sortant-demande"
        ? `/api/CourrierSortant/${doc.id}`
        : `/api/CourrierAdmin/${doc.id}`;

    if (!token) {
      alert(cur.connecterSuppression);
      return;
    }

    try {
      await api.delete(endpoint, token);
      setSelectedIds((current) => current.filter((id) => id !== doc.id));
      alert(cur.documentSupprime);
      await refetch();
    } catch (err) {
      console.error("Erreur suppression:", err);
      alert(`${cur.erreurPrefix} ${getErrorMessage(err) || cur.erreurBackend}`);
    }
  };

  const registerRetrait = (row: { id: number; reference: string; objet: string }) => {
    if (!canRetrait) { alert(cur.permissionRefusee); return; }
    setRetraitDoc({ id: row.id, reference: row.reference, objet: row.objet });
  };

  const openRetournerModal = async () => {
    setShowRetournerModal(true);
    try {
      setRetournerDocs(await api.get("/api/Transactions/doit-revenir", token));
    } catch {
      setRetournerDocs([]);
    }
  };

  const batchTransferSelected = () => {
    const docs = filteredGeneral.filter((item) => selectedIds.includes(item.id) && item.transmissible !== "Non");
    if (docs.length === 0) {
      alert(langue === "fr" ? "Aucun document transférable sélectionné" : "لا توجد وثائق قابلة للتحويل");
      return;
    }
    if (docs.length === 1) {
      openTransfer(docs[0]);
    } else {
      setBatchTransferDocs(docs);
      setTransferModalDoc(docs[0]);
      setSelectedServices([]);
      setTransferMessage("");
      setTransferMustReturn(false);
      setTransferTargetUserId(null);
    }
  };

  if (!isAuthenticated || !user) {
    return <LoginPage langue={langue} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-800 font-sans antialiased" dir={langue === "ar" ? "rtl" : "ltr"}>
      <Sidebar
        langue={langue}
        setLangue={setLangue}
        vueActive={vueActive}
        setVueActive={setVueActive}
        user={user}
        logout={logout}
        cur={cur}
        canSeeEntrantAdmin={canSeeEntrantAdmin}
        canSeeEntrantJuridique={canSeeEntrantJuridique}
        canSeeSortantNormal={canSeeSortantNormal}
        canSeeSortantDemande={canSeeSortantDemande}
        canManageUsers={canManageUsers}
        canSeeAdminSection={canSeeAdminSection}
        canSeeServicesAdmin={canSeeServicesAdmin}
        canSeePermissionsAdmin={canSeePermissionsAdmin}
        canSeeEquipementsAdmin={canSeeEquipementsAdmin}
        canSeeHistoriquesAdmin={canSeeHistoriquesAdmin}
        canSeeListesAdmin={canSeeListesAdmin}
        canOpenDossiers={canOpenDossiers}
        canTransfer={canTransfer}
        canViewArchives={canViewArchives}
        canViewTransactions={canViewTransactions}
        canSearchDossiers={canSearchDossiers}
        pendingNotifications={pendingNotifications}
      />

      <main className="flex-1 flex flex-col min-w-0 bg-white">
        <header className="border-b border-slate-200 p-6 flex justify-between items-center bg-white">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {vueActive === "dashboard" && cur.tbd}
              {vueActive === "mes-entites" && cur.mesDocuments}
              {vueActive === "transactions" && cur.registreTransactions}
              {vueActive === "archives" && cur.archivesJuridiques}
              {vueActive === "admin-listes" && cur.gestionListes}
              {vueActive === "recherche-dossiers" && cur.rechercheDossiers}
              {vueActive === "entrant-admin" && cur.admin}
              {vueActive === "entrant-juridique" && cur.juridique}
              {vueActive === "sortant-normal" && cur.normalMenu}
                {vueActive === "sortant-demande" && cur.demandeMenu}
                {vueActive === "admin-utilisateurs" && cur.utilisateurs}
                {vueActive === "admin-services" && cur.services}
                {vueActive === "admin-permissions" && cur.permissions}
                {vueActive === "admin-equipements" && cur.equipements}
                {vueActive === "notifications" && cur.notifications}
                {vueActive === "profil" && cur.monProfilPage}
            </h1>
            <p className="text-[11px] font-bold text-slate-500 mt-0.5">{cur.courAppel} • {cur.royaume}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600 font-bold text-xs">
            {new Date().toLocaleDateString()}
          </div>
        </header>

        <div className="p-8 flex-1 overflow-y-auto w-full mx-auto space-y-8">
          <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
          {vueActive === "dashboard" && (
            <DashboardView
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              workflowDoc={selectedWorkflowDoc}
              setWorkflowDocId={setWorkflowDocId}
              filteredGeneral={filteredGeneral}
              filteredSortant={filteredSortant}
              allDocs={visibleCourriers}
              filtreStatutSortant={filtreStatutSortant}
              setFiltreStatutSortant={setFiltreStatutSortant}
              stats={statusStats}
              totalDocs={totalDocs}
              activityCards={activityCards}
              onViewDoc={(doc: CourrierSimule) => { setSelectedDocument(doc); setShowModal(true); }}
              onTransferDoc={openTransfer}
              onDeleteDoc={handleDelete}
              canDelete={canDelete}
              canTransfer={canTransfer}
              canModify={canCreateSortantNormal}
              onOpenDoc={(doc: CourrierSimule) => setWorkspaceDocId(doc.id)}
              onMarquerEnvoye={(id: number) => changerStatutSortant(id, "Envoye")}
              onMarquerAttente={(id: number) => changerStatutSortant(id, "EnAttente")}
              onAnnuler={(id: number) => changerStatutSortant(id, "Annule")}
              onNavigate={setVueActive}
              cur={cur}
              langue={langue}
              onExportGeneral={exportGeneralDocs}
              onImportExcel={handleImportExcelFile}
              onExportSortant={exportSortantDocs}
              selectedDocIds={selectedDocIds}
              onToggleDocSelect={toggleDocSelect}
              onSelectAllDocs={selectAllDocs}
              docsPerStep={docsPerStep}
              workflowIndex={workflowCurrentIndex}
              recentActivity={recentActivity}
              serviceLoad={serviceLoad}
            />
          )}

          {vueActive === "mes-entites" && (
            <MesEntitesView
              langue={langue}
              cur={cur}
              filteredGeneral={filteredGeneral}
              selectedIds={selectedIds}
              selectedDocIds={selectedDocIds}
              docsArchives={docsArchives}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              onNavigate={setVueActive}
              onOpenRetourner={openRetournerModal}
              toggleSelected={toggleSelected}
              setSelectedIds={setSelectedIds}
              onViewDoc={(doc: CourrierSimule) => { setSelectedDocument(doc); setShowModal(true); }}
              onTransfer={openTransfer}
              onBatchTransferSelected={batchTransferSelected}
              onDelete={handleDelete}
              onArchiveSelection={archiveSelection}
              onExportSelected={exportSelectedDocs}
              onExportGeneral={exportGeneralDocs}
              onDownloadTemplate={() => downloadExcelTemplate(langue)}
              onImportExcel={handleImportExcel}
              getServiceLabel={getServiceLabel}
              canTransfer={canTransfer}
              canArchive={canArchive}
              canDelete={canDelete}
            />
          )}

      {vueActive === "mes-dossiers-en-cours" && (
        <MesDossiersEnCoursView
          langue={langue}
          cur={cur}
          token={token}
          userService={userService}
          userId={user?.id}
          visibleCourriers={visibleCourriers}
          hasPermission={hasPermission}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          toggleSelected={toggleSelected}
          selectedDocument={selectedDocument}
          setSelectedDocument={setSelectedDocument}
          setShowModal={setShowModal}
          openTransfer={openTransfer}
          handleDelete={handleDelete}
          getServiceLabel={getServiceLabel}
        />
      )}

      {vueActive === "transactions" && (
            <TransactionsPage
              langue={langue}
              cur={cur}
              token={token}
              onAccepted={refetch}
            />
          )}

          {vueActive === "archives" && (
            <ArchivesView
              langue={langue}
              cur={cur}
              showCorbeille={showCorbeille}
              setShowCorbeille={setShowCorbeille}
              corbeilleDocs={corbeilleDocs}
              onFetchCorbeille={fetchCorbeille}
              onRestoreDocument={restoreDocument}
              onPermanentDelete={permanentDeleteDocument}
              filteredGeneral={filteredGeneral}
              docsArchives={docsArchives}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              onRegisterRetrait={registerRetrait}
              canSeeCorbeille={hasPermission("voir_corbeille") || isGreffier}
              getServiceLabel={getServiceLabel}
            />
          )}

          {vueActive === "recherche-dossiers" && canSearchDossiers && (
            <RechercheDossiersView
              langue={langue}
              cur={cur}
              visibleCourriers={visibleCourriers}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              searchFilterService={searchFilterService}
              setSearchFilterService={setSearchFilterService}
              searchFilterType={searchFilterType}
              setSearchFilterType={setSearchFilterType}
              searchFilterDateDebut={searchFilterDateDebut}
              setSearchFilterDateDebut={setSearchFilterDateDebut}
              searchFilterDateFin={searchFilterDateFin}
              setSearchFilterDateFin={setSearchFilterDateFin}
              searchLocalFiles={searchLocalFiles}
              setSearchLocalFiles={setSearchLocalFiles}
              localFiles={localFiles}
              setLocalFiles={setLocalFiles}
              onSearchLocalDirectory={searchLocalDirectory}
              getLocalSearchResults={getLocalSearchResults}
              getServiceLabel={getServiceLabel}
              onViewDoc={(doc: CourrierSimule) => { setSelectedDocument(doc); setShowModal(true); }}
            />
          )}

          {isFormView && canUseForm && (
            <div className="bg-white rounded-xl border border-slate-300 shadow-sm w-full overflow-hidden">
              <div className="p-4 bg-slate-900 text-white font-bold text-xs">
                <span>
                  {vueActive === "entrant-admin" && cur.admin}
                  {vueActive === "entrant-juridique" && cur.juridique}
                  {vueActive === "sortant-normal" && cur.normal}
                  {vueActive === "sortant-demande" && cur.demande}
                </span>
              </div>

              <form onSubmit={handleFormSubmit} className="p-8 space-y-6">
                {vueActive !== "entrant-admin" && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-2">
                          {vueActive.startsWith("entrant") ? cur.provenance :
                           (vueActive === "sortant-normal" || vueActive === "sortant-demande") ? cur.destinataireExterne :
                           cur.destination} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={tiers}
                          onChange={(e) => setTiers(e.target.value)}
                          className="w-full border border-slate-300 p-3 rounded-lg text-xs outline-none focus:border-blue-500 bg-slate-50/50"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-2">{cur.tblRef} <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={reference}
                          onChange={(e) => setReference(e.target.value)}
                          placeholder={cur.recherche_exemple}
                          className="w-full border border-slate-300 p-3 rounded-lg text-xs outline-none focus:border-blue-500 bg-slate-50/50"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">{cur.tblTitre} <span className="text-red-500">*</span></label>
                      <textarea
                        rows={3}
                        value={objet}
                        onChange={(e) => setObjet(e.target.value)}
                        placeholder={langue === "ar" ? "اكتب هنا الموضوع..." : "Saisissez l'objet..."}
                        className="w-full border border-slate-300 p-3 rounded-lg text-xs outline-none focus:border-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">                          {cur.serviceOrigine}
                      </label>
                      <input
                        type="text"
                        value={userService}
                        disabled
                        className="w-full border border-slate-300 p-3 rounded-lg text-xs outline-none bg-slate-100 text-slate-500"
                      />
                    </div>
                  </>
                )}

                {vueActive === "entrant-admin" && canSeeEntrantAdmin && (
                  <AdminForm
                    expediteur={tiers} setExpediteur={setTiers}
                    source={source} setSource={setSource}
                    dateArrivee={dateArrivee} setDateArrivee={setDateArrivee}
                    dateMessage={dateMessage} setDateMessage={setDateMessage}
                    numeroInterne={numeroInterne} setNumeroInterne={setNumeroInterne}
                    anneeNumerotation={anneeNumerotation} setAnneeNumerotation={setAnneeNumerotation}
                    transmissible={transmissible} setTransmissible={setTransmissible}
                    etat={etat} setEtat={setEtat}
                    notes={notes} setNotes={setNotes}
                    fichier={fichier} setFichier={setFichier}
                    modeTraitement={modeTraitement} setModeTraitement={setModeTraitement}
                    serviceDestinataire={serviceDestinataire} setServiceDestinataire={setServiceDestinataire}
                    servicesDiffusion={servicesDiffusion} setServicesDiffusion={setServicesDiffusion}
                    langue={langue} cur={cur}
                    sourceOptions={sourceOptions}
                    etatOptions={etatOptions}
                    reference={reference} setReference={setReference}
                    objet={objet} setObjet={setObjet}
                    serviceOrigine={userService} setServiceOrigine={() => {}} canEditService={isAdmin || isGreffier}
                  />
                )}

                {vueActive === "entrant-juridique" && canSeeEntrantJuridique && (
                  <JuridiqueForm
                    docLie={docLie} setDocLie={setDocLie}
                    dossierPrincipal={dossierPrincipal} setDossierPrincipal={setDossierPrincipal}
                    sourceDocLie={sourceDocLie} setSourceDocLie={setSourceDocLie}
                    parentDossier={parentDossier} setParentDossier={setParentDossier}
                    juridiqueDate={juridiqueDate} setJuridiqueDate={setJuridiqueDate}
                    numeroBureauOrdre={numeroBureauOrdre} setNumeroBureauOrdre={setNumeroBureauOrdre}
                    autoYearSuffix={autoYearSuffix} setAutoYearSuffix={setAutoYearSuffix}
                    juridiqueEtat={juridiqueEtat} setJuridiqueEtat={setJuridiqueEtat}
                    juridiqueService={juridiqueService} setJuridiqueService={setJuridiqueService}
                    typeDossier={typeDossier} setTypeDossier={setTypeDossier}
                    numeroPremiereInstance={numeroPremiereInstance} setNumeroPremiereInstance={setNumeroPremiereInstance}
                    juridiqueNotes={juridiqueNotes} setJuridiqueNotes={setJuridiqueNotes}
                    juridiqueFichier={juridiqueFichier} setJuridiqueFichier={setJuridiqueFichier}
                    circuitJuridique={circuitJuridique} setCircuitJuridique={setCircuitJuridique}
                    etapeService={etapeService} setEtapeService={setEtapeService}
                    etapeJalsat={etapeJalsat} setEtapeJalsat={setEtapeJalsat}
                    etapeTaslim={etapeTaslim} setEtapeTaslim={setEtapeTaslim}
                    autoriteRetrait={autoriteRetrait} setAutoriteRetrait={setAutoriteRetrait}
                    typeException={typeException} setTypeException={setTypeException}
                    numeroDossierAppel={numeroDossierAppel} setNumeroDossierAppel={setNumeroDossierAppel}
                    typeProcedure={typeProcedure} setTypeProcedure={setTypeProcedure}
                    numCourAppel={numCourAppel} setNumCourAppel={setNumCourAppel}
                    conseillerRapporteur={conseillerRapporteur} setConseillerRapporteur={setConseillerRapporteur}
                    dateAudience={dateAudience} setDateAudience={setDateAudience}
                    statutSousService={statutSousService} setStatutSousService={setStatutSousService}
                    commentaireSousService={commentaireSousService} setCommentaireSousService={setCommentaireSousService}
                    reference={reference} tiers={tiers} objet={objet}
                    isJalsatService={isJalsatService}
                    isTaslimService={isTaslimService}
                    langue={langue} cur={cur}
                    userRole={role}
                  />
                )}

                {(vueActive === "sortant-normal" || vueActive === "sortant-demande") && (
                   <SortantForm
                    dateEnvoi={dateEnvoi}
                    setDateEnvoi={setDateEnvoi}
                    typeCourrier={vueActive === "sortant-normal" ? cur.normal : cur.demande}
                    vueActive={vueActive}
                    cur={cur}
                    service={serviceSortant}
                    setService={setServiceSortant}
                    numeroBureauOrdre={numeroBureauOrdreSortant}
                    setNumeroBureauOrdre={setNumeroBureauOrdreSortant}
                    notes={notesSortant}
                    setNotes={setNotesSortant}
                    fichier={fichierSortant}
                    setFichier={setFichierSortant}
                    langue={langue}
                    tribunalOrigine={tribunalOrigineSortant}
                    setTribunalOrigine={setTribunalOrigineSortant}
                    tribunalDestination={tribunalDestinationSortant}
                    setTribunalDestination={setTribunalDestinationSortant}
                  />
                )}

                <div className="pt-4 border-t border-slate-200 flex justify-end">
                  <button
                    type="submit"
                    disabled={!!isSubmitting}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-8 py-4 rounded-xl transition shadow-md disabled:opacity-50"
                  >
                    {isSubmitting ? cur.chargement : cur.btnEnregistrer}
                  </button>
                </div>
              </form>
            </div>
          )}

          {(vueActive === "sortant-normal" || vueActive === "sortant-demande") && (
            <Suspense fallback={<div className="flex items-center justify-center py-10"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div></div>}>
              <SortantTable
                documents={vueActive === "sortant-normal" ? filteredSortantNormal : filteredSortantDemande}
                filtreStatut={filtreStatutSortant}
                setFiltreStatut={setFiltreStatutSortant}
                onView={(doc) => { setSelectedDocument(doc); setShowModal(true); }}
                onTransfer={openTransfer}
                onDelete={handleDelete}
                canDelete={canDelete}
                canTransfer={canTransfer}
                canModify={canCreateSortantNormal}
                onMarquerEnvoye={(id) => changerStatutSortant(id, "Envoye")}
                onMarquerAttente={(id) => changerStatutSortant(id, "EnAttente")}
                onAnnuler={(id) => changerStatutSortant(id, "Annule")}
                cur={cur}
                langue={langue}
                onExport={vueActive === "sortant-normal" ? exportSortantDocs : exportSortantDocs}
              />
            </Suspense>
          )}

          {vueActive === "admin-utilisateurs" && canManageUsers && (
            <GestionUtilisateurs langue={langue} cur={cur} token={token} onExport={(f) => exportAdminData(f, "utilisateurs")} />
          )}

          {vueActive === "admin-services" && canSeeServicesAdmin && (
            <GestionServices langue={langue} cur={cur} token={token} onExport={(f) => exportAdminData(f, "services")} />
          )}

          {vueActive === "admin-permissions" && canSeePermissionsAdmin && (
            <GestionPermissions langue={langue} cur={cur} token={token} />
          )}

          {vueActive === "admin-equipements" && canSeeEquipementsAdmin && (
            <GestionEquipements langue={langue} cur={cur} token={token} onExport={(f) => exportAdminData(f, "equipements")} />
          )}

          {vueActive === "admin-services-historiques" && canSeeHistoriquesAdmin && (
            <GestionServicesHistoriques langue={langue} cur={cur} token={token} />
          )}

          {vueActive === "admin-listes" && canSeeListesAdmin && (
            <GestionListes langue={langue} cur={cur} token={token} onExport={(f) => exportAdminData(f, "listes")} />
          )}

          {vueActive === "notifications" && (
            <NotificationsPage langue={langue} cur={cur} token={token} onExport={exportNotifications} refreshTrigger={notificationRefreshTrigger} />
          )}

          {vueActive === "profil" && (
            <ProfilPage langue={langue} cur={cur} token={token} user={user} />
          )}
          </Suspense>
        </div>
      </main>

      <Suspense fallback={null}>
      {transferModalDoc && (
        <TransferModal
          doc={transferModalDoc}
          onClose={() => setTransferModalDoc(null)}
          onConfirm={confirmTransfer}
          selectedServices={selectedServices}
          setSelectedServices={setSelectedServices}
          transferMessage={transferMessage}
          setTransferMessage={setTransferMessage}
          transferMustReturn={transferMustReturn}
          setTransferMustReturn={setTransferMustReturn}
          langue={langue}
          cur={cur}
          setTargetUserId={setTransferTargetUserId}
          selectedUserIds={selectedUserIds}
          setSelectedUserIds={setSelectedUserIds}
          userService={userService}
        />
      )}

      {showMappingModal && (
        <ImportMappingModal
          isOpen={showMappingModal}
          onClose={() => setShowMappingModal(false)}
          onConfirm={confirmMappedImport}
          excelColumns={excelColumns}
          langue={langue}
          previewData={mappedImportData}
        />
      )}

      {showModal && selectedDocument && (
        <DetailModal
          doc={selectedDocument}
          onClose={() => { setShowModal(false); setHistoriqueActions([]); }}
          onTransfer={(doc) => { setShowModal(false); setTransferModalDoc(doc); }}
          onSaved={() => refetch()}
          historique={historiqueActions}
          cur={cur}
          langue={langue}
          token={token}
        />
      )}

      {retraitDoc && (
        <ArchiveRetraitPage
          langue={langue}
          cur={cur}
          token={token}
          selectedDoc={retraitDoc}
          onClose={() => setRetraitDoc(null)}
          userNom={user?.nom || ""}
        />
      )}

      {showRetournerModal && (
        <div className="fixed inset-0 z-[999] bg-black/40 flex items-center justify-center p-4" onClick={() => setShowRetournerModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-sm text-slate-800">
                {langue === "fr" ? "Documents à retourner" : "الوثائق المرجعة"} ({retournerDocs.length})
              </h3>
              <button onClick={() => setShowRetournerModal(false)} className="px-3 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {retournerDocs.length === 0 ? (
                <p className="text-center text-slate-400 text-xs font-bold py-8">{langue === "fr" ? "Aucun document à retourner" : "لا توجد وثائق للإرجاع"}</p>
              ) : (
                <div className="space-y-2">
                  {retournerDocs.map((t) => (
                    <div key={t.id} className="p-3 border border-amber-200 rounded-lg bg-amber-50 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold text-slate-800">{t.documentSujet}</p>
                        <p className="text-[11px] text-slate-500">
                          {langue === "fr" ? "De" : "من"}: {getServiceLabel(t.sourceServiceId, langue)} → {getServiceLabel(t.destinationServiceId, langue)}
                        </p>
                        {t.message && <p className="text-[11px] text-red-600 mt-1">{langue === "fr" ? "Motif" : "السبب"}: {t.message}</p>}
                      </div>
                      <span className="px-2 py-1 text-[10px] font-bold rounded bg-amber-100 text-amber-700">
                        {langue === "fr" ? "À retourner" : "مرجع"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Workspace Modal */}
      {workspaceDocId && (
        <WorkspaceModal
          docId={workspaceDocId}
          onClose={() => setWorkspaceDocId(null)}
          token={token}
          langue={langue}
          cur={cur}
          onTransfer={(doc: CourrierSimule) => {
            setWorkspaceDocId(null);
            openTransfer(doc);
          }}
        />
      )}
      </Suspense>
    </div>
  );
}