"use client";

import type { TranslationKeys } from "@/lib/translations";
import type { User } from "@/context/AuthContext";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Langue } from "@/app/types";
import { useServiceLabels } from "@/app/hooks/useServiceLabels";
import { api } from "@/lib/api/client";
import { notify } from "@/lib/feedback";
import { getErrorMessage } from "@/lib/utils";

interface Props {
  langue: Langue;
  cur: TranslationKeys;
  token: string | null;
  user: User;
}

/** One row of the delegation history — the same shape for both sides. */
interface DelegationEntry {
  id: number;
  userId: number;
  substituteUserId: number;
  substituteUserName?: string;
  absentUserName?: string;
  dateAssignation: string;
  dateDebut: string;
  dateFin?: string | null;
  dateRevocation?: string | null;
  dateAcceptation?: string | null;
  statut: string;
  statutLabel: string;
  motifRefus?: string | null;
  isActive: boolean;
  /** "absent" when I am the one being replaced, "substitute" when I replace. */
  role: "absent" | "substitute";
}

interface CoveringEntry {
  id: number;
  absentUserId: number;
  absentUserName: string;
  absentUserService?: string;
  dateDebut: string;
  dateFin?: string | null;
  statut: string;
  isActive: boolean;
}

interface SubstitutionActionEntry {
  id: number;
  effectueParUserId: number;
  effectueParNom: string;
  pourUserId: number;
  pourNom: string;
  action: string;
  documentId?: number | null;
  reference: string;
  dateAction: string;
}

interface ServiceRow {
  id: number;
  nom: string;
  code: string;
  isActive: boolean;
}

interface ServiceUser {
  id: number;
  nom: string;
}

/** Status chip colour, shared by the history and the active cards. */
const STATUS_STYLES: Record<string, string> = {
  EnAttente: "bg-amber-100 text-amber-700",
  Accepte: "bg-emerald-100 text-emerald-700",
  Refuse: "bg-rose-100 text-rose-700",
  Revoque: "bg-slate-100 text-slate-500",
  Termine: "bg-slate-100 text-slate-500",
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString() : "-";

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "-";

/** A delegation is "running" only while accepted and still inside its period. */
const isRunning = (entry: DelegationEntry) =>
  entry.statut === "Accepte" && entry.isActive;

export function ProfilPage({ langue, cur, token, user }: Props) {
  const [history, setHistory] = useState<DelegationEntry[]>([]);
  const [covering, setCovering] = useState<CoveringEntry[]>([]);
  const [actions, setActions] = useState<SubstitutionActionEntry[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [serviceUsers, setServiceUsers] = useState<ServiceUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Replacement draft
  const [destService, setDestService] = useState("");
  const [destUserId, setDestUserId] = useState<number>(0);
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [busy, setBusy] = useState(false);

  const t = (fr: string, ar: string) => (langue === "fr" ? fr : ar);

  const fetchHistory = useCallback(async () => {
    if (!user?.id) return;
    try {
      setHistory(await api.get<DelegationEntry[]>(`/api/Substitutes/history/${user.id}`, token));
    } catch (err) { console.warn(err); }
  }, [user, token]);

  const fetchCovering = useCallback(async () => {
    if (!user?.id) return;
    try {
      setCovering(await api.get<CoveringEntry[]>(`/api/Substitutes/covering/${user.id}`, token));
    } catch (err) { console.warn(err); }
  }, [user, token]);

  const fetchActions = useCallback(async () => {
    if (!user?.id) return;
    try {
      setActions(await api.get<SubstitutionActionEntry[]>(`/api/Substitutes/actions/${user.id}`, token));
    } catch (err) { console.warn(err); }
  }, [user, token]);

  // Destination services come from the live catalog (useServiceLabels gives the
  // translated name), so a service created from the admin panel is selectable
  // immediately and an archived one disappears.
  const fetchServices = useCallback(async () => {
    if (!token) return;
    try {
      const rows = await api.get<ServiceRow[]>("/api/rbac/services", token);
      setServices(Array.isArray(rows) ? rows.filter((s) => s.isActive) : []);
    } catch (err) { console.warn(err); }
  }, [token]);

  useEffect(() => {
    fetchHistory();
    fetchCovering();
    fetchActions();
    fetchServices();
  }, [fetchHistory, fetchCovering, fetchActions, fetchServices]);

  // A service must be picked before its users can be listed; changing it clears
  // the previously chosen colleague, which belonged to the other service.
  useEffect(() => {
    if (!token || !destService) {
      setServiceUsers([]);
      setDestUserId(0);
      return;
    }

    let cancelled = false;
    setLoadingUsers(true);
    api
      .get<ServiceUser[]>(`/api/Users/by-service/${encodeURIComponent(destService)}`, token)
      .then((rows) => {
        if (!cancelled) setServiceUsers(Array.isArray(rows) ? rows.filter((u) => u.id !== user.id) : []);
      })
      .catch(() => { if (!cancelled) setServiceUsers([]); })
      .finally(() => { if (!cancelled) setLoadingUsers(false); });

    setDestUserId(0);
    return () => { cancelled = true; };
  }, [token, destService, user.id]);

  const refreshAll = () => {
    fetchHistory();
    fetchCovering();
    fetchActions();
  };

  const handleSaveSubstitute = async () => {
    if (!destService) {
      notify(t("Veuillez choisir un service", "يرجى اختيار مصلحة"));
      return;
    }
    if (!destUserId) {
      notify(t("Veuillez choisir un remplaçant dans ce service", "يرجى اختيار بديل من هذه المصلحة"));
      return;
    }
    if (!dateFin) {
      notify(t("Veuillez indiquer la fin de la période de remplacement", "يرجى تحديد نهاية مدة النيابة"));
      return;
    }
    if (dateDebut && new Date(dateFin) <= new Date(dateDebut)) {
      notify(t("La fin de la période doit être après son début", "يجب أن تكون نهاية المدة بعد بدايتها"));
      return;
    }

    setBusy(true);
    try {
      await api.post(
        "/api/Substitutes",
        {
          userId: user.id,
          substituteUserId: destUserId,
          dateDebut: dateDebut ? new Date(dateDebut).toISOString() : null,
          dateFin: new Date(dateFin).toISOString(),
        },
        token
      );
      notify(
        t(
          "Invitation envoyée. Le remplacement commencera dès qu'elle sera acceptée.",
          "تم إرسال الدعوة. ستبدأ النيابة بمجرد قبولها."
        )
      );
      setDestService("");
      setDestUserId(0);
      setDateDebut("");
      setDateFin("");
      refreshAll();
    } catch (err) {
      notify(t("Impossible d'enregistrer le remplaçant : ", "تعذر حفظ البديل: ") + getErrorMessage(err));
    }
    setBusy(false);
  };

  /** The absent agent stops their own replacement — before or after acceptance. */
  const handleStop = async (id: number) => {
    setBusy(true);
    try {
      await api.post(`/api/Substitutes/${id}/terminer`, {}, token);
      notify(t("Remplacement arrêté", "تم إيقاف النيابة"));
      refreshAll();
    } catch (err) {
      notify(t("Impossible d'arrêter le remplacement : ", "تعذر إيقاف النيابة: ") + getErrorMessage(err));
    }
    setBusy(false);
  };

  const { getServiceLabel } = useServiceLabels(token, langue);

  const activeDelegation = useMemo(
    () => history.find((h) => h.role === "absent" && h.statut === "Accepte" && h.isActive),
    [history]
  );
  const pendingInvitation = useMemo(
    () => history.find((h) => h.role === "absent" && h.statut === "EnAttente"),
    [history]
  );
  const coveringNow = covering.filter((c) => c.isActive || c.statut === "Accepte");

  /**
   * History reads newest-relevant first: what is running right now, then the
   * invitations still awaiting an answer, then everything already settled.
   */
  const orderedHistory = useMemo(() => {
    const rank = (e: DelegationEntry) =>
      isRunning(e) ? 0 : e.statut === "EnAttente" ? 1 : 2;
    return [...history].sort(
      (a, b) =>
        rank(a) - rank(b) ||
        new Date(b.dateAssignation).getTime() - new Date(a.dateAssignation).getTime()
    );
  }, [history]);

  const runningCount = history.filter(isRunning).length;

  /**
   * How long the replacement actually ran: from the moment the colleague
   * accepted (or the period's start, for rows predating acceptance) to the real
   * end — the stop/refusal date, else the period's end, else now while running.
   * This is the "how much time" both parties see in their own profile.
   */
  const durationLabel = (entry: DelegationEntry): string => {
    if (entry.statut === "EnAttente" || entry.statut === "Refuse") return "—";
    const start = new Date(entry.dateAcceptation || entry.dateDebut);
    const end = isRunning(entry)
      ? new Date()
      : new Date(entry.dateRevocation || entry.dateFin || entry.dateDebut);
    const ms = Math.max(0, end.getTime() - start.getTime());
    const days = Math.floor(ms / 86_400_000);
    const hours = Math.floor((ms % 86_400_000) / 3_600_000);
    if (days === 0 && hours === 0) return t("moins d'une heure", "أقل من ساعة");
    return days > 0
      ? `${days} ${t("j", "ي")} ${hours} ${t("h", "س")}`
      : `${hours} ${t("h", "س")}`;
  };

  /** One sentence that says how the delegation ended, not just its status. */
  const outcomeLabel = (entry: DelegationEntry): string => {
    if (entry.statut === "EnAttente") {
      return t("Invitation en attente d'acceptation", "دعوة في انتظار القبول");
    }
    if (isRunning(entry)) {
      return t("En cours", "جارية");
    }
    switch (entry.statut) {
      case "Refuse":
        return t("Refusée par le remplaçant", "رفضها البديل");
      case "Revoque":
        return t("Arrêtée avant la fin de la période", "أُوقفت قبل نهاية المدة");
      case "Termine":
        return t("Période écoulée", "انتهت المدة");
      default:
        return entry.statutLabel || entry.statut;
    }
  };

  const fieldClass =
    "w-full border border-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-blue-500 bg-white";
  const labelClass = "block text-xs font-bold text-slate-700 mb-1";

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm" data-testid="profil-infos">
        <h3 className="font-bold text-sm text-slate-800 mb-4">{t("Mes informations", "معلوماتي")}</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <span className="block text-[11px] font-bold text-slate-500 mb-1">{t("Nom complet", "الاسم الكامل")}</span>
            <p className="text-xs font-bold text-slate-800 p-2.5 bg-slate-50 rounded-lg border border-slate-200">{user?.nom || "-"}</p>
          </div>
          <div>
            <span className="block text-[11px] font-bold text-slate-500 mb-1">Login</span>
            <p className="text-xs font-bold text-slate-800 p-2.5 bg-slate-50 rounded-lg border border-slate-200">{user?.login || "-"}</p>
          </div>
          <div>
            <span className="block text-[11px] font-bold text-slate-500 mb-1">{t("Service", "المصلحة")}</span>
            <p className="text-xs font-bold text-slate-800 p-2.5 bg-slate-50 rounded-lg border border-slate-200">{getServiceLabel(user?.service || "")}</p>
          </div>
          <div>
            <span className="block text-[11px] font-bold text-slate-500 mb-1">{t("Rôle", "الدور")}</span>
            <p className="text-xs font-bold text-slate-800 p-2.5 bg-slate-50 rounded-lg border border-slate-200">{user?.role || "-"}</p>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mt-3">
          {t(
            "Ces informations sont gérées par l'administrateur et ne sont pas modifiables ici.",
            "هذه المعلومات يديرها المدير ولا يمكن تعديلها من هنا."
          )}
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm" data-testid="profil-substitution">
        <h3 className="font-bold text-sm text-slate-800 mb-1">{t("Gestion de l'absence — remplaçant", "إدارة الغياب — البديل")}</h3>
        <p className="text-[11px] text-slate-500 mb-4">
          {t(
            "Choisissez le service puis l'agent qui vous remplacera, et la période du remplacement. Votre remplaçant reçoit une invitation : dès qu'il l'accepte, un espace de remplacement s'ouvre pour lui et lui donne accès à vos dossiers et à vos permissions, jusqu'à la fin de la période ou jusqu'à ce que vous arrêtiez le remplacement.",
            "اختر المصلحة ثم الموظف الذي سينوب عنك، ومدة النيابة. يتلقى البديل دعوة: بمجرد قبولها يُفتح له فضاء نيابة يمنحه الوصول إلى ملفاتك وصلاحياتك، إلى غاية نهاية المدة أو إيقافك للنيابة."
          )}
        </p>

        {activeDelegation ? (
          <div className="space-y-3" data-testid="delegation-active">
            <p className="text-xs text-slate-600">
              {t("Remplaçant actuel", "البديل الحالي")} :{" "}
              <span className="font-bold text-emerald-700">{activeDelegation.substituteUserName}</span>
            </p>
            <p className="text-[11px] text-slate-500">
              {t("Période", "المدة")} : {formatDate(activeDelegation.dateDebut)} → {formatDate(activeDelegation.dateFin)}
            </p>
            <p className="text-[11px] text-slate-400">
              {t(
                "Cette personne travaille dans votre espace : vos dossiers, vos permissions et vos notifications. Chaque action qu'elle effectue est tracée.",
                "يعمل هذا الشخص في فضائك: ملفاتك وصلاحياتك وإشعاراتك. وتُسجَّل كل حركة يقوم بها."
              )}
            </p>
            <button
              type="button"
              data-testid="stop-delegation"
              onClick={() => handleStop(activeDelegation.id)}
              disabled={busy}
              className="px-4 py-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 disabled:opacity-40 transition"
            >
              {t("Arrêter le remplacement", "إيقاف النيابة")}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingInvitation ? (
              <div
                className="flex items-start justify-between gap-4 p-3 rounded-lg border border-amber-200 bg-amber-50"
                data-testid="delegation-pending"
              >
                <div>
                  <p className="text-xs font-bold text-amber-800">
                    {t("Invitation en attente", "دعوة في الانتظار")} — {pendingInvitation.substituteUserName}
                  </p>
                  <p className="text-[11px] text-amber-700 mt-1">
                    {t("Période", "المدة")} : {formatDate(pendingInvitation.dateDebut)} →{" "}
                    {formatDate(pendingInvitation.dateFin)}
                  </p>
                  <p className="text-[11px] text-amber-700">
                    {t(
                      "Le remplacement ne commencera qu'une fois l'invitation acceptée.",
                      "لن تبدأ النيابة إلا بعد قبول الدعوة."
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleStop(pendingInvitation.id)}
                  disabled={busy}
                  className="whitespace-nowrap px-3 py-1.5 rounded-lg border border-rose-200 bg-white text-rose-700 text-[11px] font-bold disabled:opacity-40"
                >
                  {t("Annuler l'invitation", "إلغاء الدعوة")}
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-500">{t("Aucun remplaçant défini.", "لم يتم تحديد بديل.")}</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label htmlFor="substitute-service" className={labelClass}>
                  {t("Service", "المصلحة")} <span className="text-red-500">*</span>
                </label>
                <select
                  id="substitute-service"
                  data-testid="substitute-service"
                  value={destService}
                  onChange={(e) => setDestService(e.target.value)}
                  className={fieldClass}
                >
                  <option value="">-- {t("Choisir un service", "اختر مصلحة")} --</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.code}>{s.nom}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="substitute-select" className={labelClass}>
                  {t("Remplaçant", "البديل")} <span className="text-red-500">*</span>
                </label>
                <select
                  id="substitute-select"
                  data-testid="substitute-user"
                  value={destUserId}
                  onChange={(e) => setDestUserId(Number(e.target.value))}
                  disabled={!destService || loadingUsers}
                  className={`${fieldClass} disabled:bg-slate-50 disabled:text-slate-400`}
                >
                  <option value={0}>
                    {!destService
                      ? `-- ${t("Choisissez d'abord un service", "اختر مصلحة أولاً")} --`
                      : loadingUsers
                        ? t("Chargement...", "جار التحميل...")
                        : `-- ${t("Choisir un utilisateur", "اختر مستخدماً")} --`}
                  </option>
                  {serviceUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.nom}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="substitute-start" className={labelClass}>{t("Début", "البداية")}</label>
                <input
                  id="substitute-start"
                  type="datetime-local"
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                  className={fieldClass}
                />
              </div>

              <div>
                <label htmlFor="substitute-end" className={labelClass}>
                  {t("Fin", "النهاية")} <span className="text-red-500">*</span>
                </label>
                <input
                  id="substitute-end"
                  data-testid="substitute-end"
                  type="datetime-local"
                  value={dateFin}
                  onChange={(e) => setDateFin(e.target.value)}
                  required
                  className={fieldClass}
                />
              </div>
            </div>

            {destService && !loadingUsers && serviceUsers.length === 0 && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                {t(
                  "Aucun utilisateur actif dans ce service. Choisissez-en un autre.",
                  "لا يوجد مستخدم نشط في هذه المصلحة. اختر مصلحة أخرى."
                )}
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                data-testid="save-delegation"
                onClick={handleSaveSubstitute}
                disabled={busy}
                className="px-6 py-2.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-40 transition"
              >
                {cur.btnEnregistrer}
              </button>
            </div>
          </div>
        )}

        {covering.length > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-200" data-testid="delegation-covering">
            <p className="text-xs font-bold text-slate-700 mb-2">
              {t("Vous remplacez actuellement", "أنت تنوب حالياً عن")}
            </p>
            <ul className="space-y-1">
              {covering.map((c) => (
                <li key={c.id} className="text-xs text-slate-600">
                  <span className="font-bold text-slate-800">{c.absentUserName}</span>
                  {" — "}
                  {c.statut === "EnAttente"
                    ? t("invitation à accepter", "دعوة في انتظار القبول")
                    : `${t("du", "من")} ${formatDate(c.dateDebut)} ${t("au", "إلى")} ${formatDate(c.dateFin)}`}
                  {c.isActive && (
                    <span className="ml-2 px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                      {t("Espace ouvert", "الفضاء مفتوح")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {coveringNow.some((c) => c.isActive) && (
              <p className="text-[11px] text-slate-400 mt-2">
                {t(
                  "Votre espace de remplacement est accessible depuis le menu latéral.",
                  "يمكن الوصول إلى فضاء النيابة من القائمة الجانبية."
                )}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden" data-testid="profil-historique">
        <div className="p-4 border-b border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-sm text-slate-800">{t("Historique des remplacements", "سجل النيابات")}</h3>
            <div className="flex gap-2 text-[10px] font-bold">
              <span className="px-2 py-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-700">
                {runningCount} {t("en cours", "جارية")}
              </span>
              <span className="px-2 py-1 rounded border border-slate-200 bg-slate-100 text-slate-600">
                {history.length} {t("au total", "في المجموع")}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {t(
              "Les remplacements que vous avez accordés et ceux que vous avez assurés : la période convenue, la durée réellement couverte et la façon dont chacun s'est terminé.",
              "النيابات التي منحتها وتلك التي أديتها: المدة المتفق عليها، والمدة التي غُطيت فعلاً، وكيف انتهت كل واحدة."
            )}
          </p>
        </div>
        <div className="overflow-x-auto" data-testid="delegation-history">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="p-3 text-start">{t("Rôle", "الدور")}</th>
                <th className="p-3 text-start">{t("Remplaçant", "البديل")}</th>
                <th className="p-3 text-start">{t("Remplace", "ينوب عن")}</th>
                <th className="p-3 text-start">{t("Période convenue", "المدة المتفق عليها")}</th>
                <th className="p-3 text-start">{t("Durée couverte", "المدة المغطاة")}</th>
                <th className="p-3 text-start">{t("Issue", "النتيجة")}</th>
                <th className="p-3 text-start">{t("Fin réelle / motif", "النهاية الفعلية / السبب")}</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-bold">
                    {t("Aucun remplacement", "لا توجد نيابات")}
                  </td>
                </tr>
              ) : (
                orderedHistory.map((entry) => {
                  const running = isRunning(entry);
                  // The date the delegation really ended: the stop, else the
                  // period's own end. Shown only once it is no longer running.
                  const endedOn = entry.dateRevocation || entry.dateFin;
                  return (
                    <tr
                      key={entry.id}
                      data-testid={`delegation-history-${entry.id}`}
                      data-role={entry.role}
                      data-status={entry.statut}
                      className={`border-b border-slate-100 ${running ? "bg-emerald-50/40" : "hover:bg-slate-50"}`}
                    >
                      <td className="p-3">
                        <span className="px-2 py-1 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                          {entry.role === "absent"
                            ? t("Je suis remplacé", "أنا من يُناب عنه")
                            : t("Je remplace", "أنا أنوب")}
                        </span>
                      </td>
                      <td className={`p-3 font-bold ${entry.role === "substitute" ? "text-blue-700" : ""}`}>
                        {entry.substituteUserName || "-"}
                        {entry.role === "substitute" && (
                          <span className="ms-1 text-[10px] font-normal text-slate-400">
                            {t("(vous)", "(أنت)")}
                          </span>
                        )}
                      </td>
                      <td className="p-3">{entry.absentUserName || "-"}</td>
                      <td className="p-3 whitespace-nowrap">
                        {formatDate(entry.dateDebut)} → {formatDate(entry.dateFin)}
                      </td>
                      <td className="p-3 whitespace-nowrap font-bold text-slate-700">
                        {durationLabel(entry)}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold whitespace-nowrap ${STATUS_STYLES[entry.statut] || "bg-slate-100 text-slate-500"}`}>
                          {entry.statutLabel || entry.statut}
                        </span>
                        <span className="block mt-1 text-[10px] text-slate-500">{outcomeLabel(entry)}</span>
                      </td>
                      <td className="p-3 text-slate-500">
                        {entry.motifRefus ? (
                          <span className="italic">{entry.motifRefus}</span>
                        ) : running ? (
                          <span className="text-emerald-700">{t("En cours", "جارية")}</span>
                        ) : endedOn ? (
                          formatDateTime(endedOn)
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden" data-testid="profil-trace">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-bold text-sm text-slate-800">{t("Traçabilité — qui a agi à la place de qui", "التتبع — من تصرف مكان من")}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="p-3 text-start">{t("Action", "الإجراء")}</th>
                <th className="p-3 text-start">{t("Dossier", "الملف")}</th>
                <th className="p-3 text-start">{t("Effectué par", "نُفِّذ من طرف")}</th>
                <th className="p-3 text-start">{t("Au nom de", "باسم")}</th>
                <th className="p-3 text-start">{t("Date", "التاريخ")}</th>
              </tr>
            </thead>
            <tbody>
              {actions.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-400 font-bold">{t("Aucune action déléguée", "لا توجد إجراءات مفوضة")}</td></tr>
              ) : (
                actions.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-3 font-bold">{a.action}</td>
                    <td className="p-3 font-mono">{a.reference || (a.documentId ?? "-")}</td>
                    <td className="p-3">{a.effectueParNom || "-"}</td>
                    <td className="p-3">{a.pourNom || "-"}</td>
                    <td className="p-3">{new Date(a.dateAction).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
