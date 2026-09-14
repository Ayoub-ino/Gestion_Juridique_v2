# -*- coding: utf-8 -*-
"""
Génère les diagrammes UML du rapport (PNG haute résolution) avec matplotlib.
Sortie : rapport_assets/fig_*.png
"""
import os
import shutil
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Ellipse, FancyArrowPatch, Rectangle, Circle
from matplotlib.lines import Line2D

plt.rcParams["font.family"] = "DejaVu Sans"

OUT_DIR = os.path.join(os.path.dirname(__file__), "rapport_assets")
os.makedirs(OUT_DIR, exist_ok=True)
EXPORT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "diagrams")

# Noms descriptifs pour l'export standalone (diagrams/), utiles pour slides/Word
FIG_EXPORT = {
    "fig01_workflow": "Figure_01_Workflow_dossier_judiciaire_6_etapes",
    "fig02_architecture": "Figure_02_Architecture_3_tiers",
    "fig03_uc_admin": "Figure_03_Cas_utilisation_Administrateur",
    "fig04_uc_agent": "Figure_04_Cas_utilisation_Agent_de_service",
    "fig05_uc_archive": "Figure_05_Cas_utilisation_Service_Archives",
    "fig06_classes": "Figure_06_Diagramme_de_classes_RBAC_documents",
    "fig07_seq_auth": "Figure_07_Sequence_Authentification_JWT",
    "fig08_seq_transfer": "Figure_08_Sequence_Transfert_document",
    "fig09_activity": "Figure_09_Activite_Workflow_Bureau_ordre_Archives",
    "fig10_er": "Figure_10_Modele_entite_association_EF_Core",
}

FIG_DESCRIPTIONS = {
    "fig01_workflow": "Circuit d'un dossier judiciaire en 6 étapes (Bureau d'ordre → Archives), avec boucle de refus.",
    "fig02_architecture": "Architecture trois-tiers : Next.js/React → API ASP.NET Core (middlewares) → SQL Server (EF Core).",
    "fig03_uc_admin": "Cas d'utilisation — Administrateur (utilisateurs, services, matrice RBAC, équipements).",
    "fig04_uc_agent": "Cas d'utilisation — Agent de service (création de documents, transferts, acceptation/refus).",
    "fig05_uc_archive": "Cas d'utilisation — Service Archives (archivage, corbeille, retraits autorisés).",
    "fig06_classes": "Diagramme de classes : hiérarchie Document (TPC), Transaction, ActionJuridique + socle RBAC.",
    "fig07_seq_auth": "Séquence — Authentification JWT (vérification BCrypt, émission du token, /api/auth/me).",
    "fig08_seq_transfer": "Séquence — Transfert multi-destinataires avec middleware [RequirePermission] et rollback.",
    "fig09_activity": "Diagramme d'activité — workflow complet avec décision accepter/refuser.",
    "fig10_er": "Modèle Entité-Association EF Core avec cardinalités (PK, FK, unique, SetNull).",
}


def export_standalone():
    """Copie les figures vers diagrams/ (PNG haute résolution + SVG vectoriel)."""
    os.makedirs(EXPORT_DIR, exist_ok=True)
    count = 0
    for base, nice in FIG_EXPORT.items():
        for ext in ("png", "svg"):
            src = os.path.join(OUT_DIR, f"{base}.{ext}")
            if os.path.exists(src):
                shutil.copy2(src, os.path.join(EXPORT_DIR, f"{nice}.{ext}"))
                count += 1
    # README descriptif
    lines = ["# Diagrammes UML du projet Gestion Juridique", "",
             "Générés par `scripts/generate_diagrams.py` (matplotlib).", "",
             "- **PNG (200 dpi)** : insertion dans Word/PowerPoint, impression.",
             "- **SVG (vectoriel)** : zoom sans perte, retouche possible (Inkscape, Figma, Illustrator).", ""]
    for base, nice in FIG_EXPORT.items():
        lines.append(f"- **{nice}.png / .svg** — {FIG_DESCRIPTIONS[base]}")
    with open(os.path.join(EXPORT_DIR, "README.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(f"Exported {count} files (+ README.md) to {EXPORT_DIR}")

NAVY = "#1F3864"
BLUE = "#2E74B5"
LIGHT = "#DCE6F1"
LIGHTER = "#EEF3FB"
GREY = "#555555"


def save(fig, name):
    base = os.path.splitext(name)[0]
    fig.savefig(os.path.join(OUT_DIR, name), dpi=200, bbox_inches="tight", facecolor="white")
    fig.savefig(os.path.join(OUT_DIR, base + ".svg"), bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print("saved", base, "(.png + .svg)")


def actor(ax, x, y, label, scale=1.0):
    """Stick figure actor."""
    s = scale
    ax.add_patch(Circle((x, y + 0.42 * s), 0.10 * s, fill=False, lw=1.6, color="black"))
    ax.plot([x, x], [y + 0.32 * s, y + 0.02 * s], color="black", lw=1.6)
    ax.plot([x - 0.14 * s, x + 0.14 * s], [y + 0.24 * s, y + 0.24 * s], color="black", lw=1.6)
    ax.plot([x, x - 0.10 * s], [y + 0.02 * s, y - 0.16 * s], color="black", lw=1.6)
    ax.plot([x, x + 0.10 * s], [y + 0.02 * s, y - 0.16 * s], color="black", lw=1.6)
    ax.text(x, y - 0.30 * s, label, ha="center", va="top", fontsize=10, fontweight="bold")


def usecase(ax, x, y, w, h, label, fs=8.5):
    e = Ellipse((x, y), w, h, facecolor=LIGHTER, edgecolor=NAVY, lw=1.4)
    ax.add_patch(e)
    ax.text(x, y, label, ha="center", va="center", fontsize=fs, linespacing=1.15)


def link(ax, x1, y1, x2, y2, style="-", arrow=False):
    ax.add_patch(FancyArrowPatch((x1, y1), (x2, y2),
                                 arrowstyle="-" if not arrow else "->",
                                 mutation_scale=12, lw=1.1, color="black",
                                 linestyle=style, shrinkA=2, shrinkB=2))


def box(ax, x, y, w, h, text, fc=LIGHTER, ec=NAVY, fs=8.5, bold=False, rounded=True):
    if rounded:
        ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.02,rounding_size=0.06",
                                    facecolor=fc, edgecolor=ec, lw=1.3))
    else:
        ax.add_patch(Rectangle((x, y), w, h, facecolor=fc, edgecolor=ec, lw=1.3))
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=fs,
            linespacing=1.25, fontweight="bold" if bold else "normal")


def arrow(ax, p1, p2, color=NAVY, lw=1.6, style="-|>", ls="-", ms=14):
    ax.add_patch(FancyArrowPatch(p1, p2, arrowstyle=style, mutation_scale=ms,
                                 lw=lw, color=color, linestyle=ls, shrinkA=0, shrinkB=0))


def title(ax, t):
    ax.text(0.5, 1.02, t, transform=ax.transAxes, ha="center", va="bottom",
            fontsize=13, fontweight="bold", color=NAVY)


# ============================================================ FIG 1 : workflow
def fig_workflow():
    fig, ax = plt.subplots(figsize=(11.5, 3.4))
    ax.set_xlim(0, 12); ax.set_ylim(0, 3); ax.axis("off")
    steps = [
        ("1. Bureau d'ordre\nمكتب الضبط", "Enregistrement\ndes courriers"),
        ("2. Ouverture des dossiers\nفتح الملفات", "N° dossier +\ncircuit"),
        ("3. Secrétariat particulier\nالكتابة الخاصة", "Préparation\nd'audience"),
        ("4. Séances & audiences\nالجلسات والإجراءات", "Enquête, expertises,\nconseiller rapporteur"),
        ("5. Délivrance & clôture\nتسليم النسخ", "Signification,\ndépens, copies"),
        ("6. Archives\nالأرشيف", "Archivage\n+ retraits"),
    ]
    w, h, y = 1.72, 1.15, 1.35
    xs = [0.25 + i * 1.98 for i in range(6)]
    for i, ((label, sub), x) in enumerate(zip(steps, xs)):
        box(ax, x, y, w, h, label, fc=LIGHT if i % 2 == 0 else LIGHTER, fs=8.3, bold=True)
        ax.text(x + w / 2, y - 0.28, sub, ha="center", va="top", fontsize=7.3, color=GREY)
        if i < 5:
            arrow(ax, (x + w + 0.03, y + h / 2), (x + 1.98 - 0.03, y + h / 2))
    # retour refus
    ax.annotate("", xy=(xs[1] + w / 2, y + h + 0.06), xytext=(xs[4] + w / 2, y + h + 0.06),
                arrowprops=dict(arrowstyle="-|>", color="#B23A48", lw=1.4,
                                connectionstyle="arc3,rad=-0.25", linestyle="--"))
    ax.text((xs[1] + xs[4]) / 2 + w / 2, y + h + 0.55, "Refus → retour à l'étape précédente (rollback)",
            ha="center", fontsize=8, color="#B23A48", style="italic")
    title(ax, "Circuit d'un dossier judiciaire — workflow en 6 étapes")
    save(fig, "fig01_workflow.png")


# ======================================================== FIG 2 : architecture
def fig_archi():
    fig, ax = plt.subplots(figsize=(9.5, 6.2))
    ax.set_xlim(0, 10); ax.set_ylim(0, 10); ax.axis("off")
    # tier 1
    box(ax, 1.0, 7.6, 8.0, 1.9, "", fc="#F5F8FD")
    ax.text(1.2, 9.25, "TIER PRÉSENTATION — Navigateur (http://localhost:3000)", fontsize=9.5,
            fontweight="bold", color=NAVY)
    box(ax, 1.3, 7.8, 2.4, 1.0, "Next.js 16\nReact 19", bold=True)
    box(ax, 3.9, 7.8, 2.4, 1.0, "TypeScript\n(types OpenAPI)", )
    box(ax, 6.5, 7.8, 2.3, 1.0, "Tailwind 4\nFR / AR (RTL)")
    # tier 2
    box(ax, 1.0, 3.6, 8.0, 3.3, "", fc="#F5F8FD")
    ax.text(1.2, 6.65, "TIER MÉTIER — API REST ASP.NET Core 10 (http://localhost:5200)",
            fontsize=9.5, fontweight="bold", color=NAVY)
    box(ax, 1.3, 5.3, 3.6, 1.0, "Middleware JWT\n(authentification)", fc=LIGHT, bold=True)
    box(ax, 5.1, 5.3, 3.6, 1.0, "PermissionValidationMiddleware\n[RequirePermission]", fc=LIGHT, bold=True)
    box(ax, 1.3, 3.85, 1.75, 0.95, "22\nContrôleurs", fs=8.3)
    box(ax, 3.2, 3.85, 1.75, 0.95, "Services\nmétier", fs=8.3)
    box(ax, 5.1, 3.85, 1.75, 0.95, "EF Core 10\nDbContext", fs=8.3)
    box(ax, 7.0, 3.85, 1.75, 0.95, "Seeder\nRBAC", fs=8.3)
    # tier 3
    box(ax, 2.6, 0.7, 4.8, 1.5, "SQL Server (LocalDB)\n18+ tables : Documents, Transactions,\nRBAC (Service, Permission, ServicePermission…)",
        fc=LIGHT, bold=False, fs=8.6)
    # flows
    arrow(ax, (5.0, 7.75), (5.0, 6.95), color=NAVY)
    ax.text(5.15, 7.35, "JSON / HTTPS  (Authorization: Bearer <JWT>)", fontsize=8, color=GREY)
    arrow(ax, (5.0, 3.55), (5.0, 2.25), color=NAVY)
    ax.text(5.15, 2.9, "SQL (migrations EF Core)", fontsize=8, color=GREY)
    title(ax, "Architecture générale de l'application (3 tiers)")
    save(fig, "fig02_architecture.png")


# ============================================ FIG 3-5 : use case diagrams -----
def _uc_common_actors(ax):
    pass


def fig_uc_admin():
    fig, ax = plt.subplots(figsize=(10.5, 7.6))
    ax.set_xlim(0, 12); ax.set_ylim(0, 10); ax.axis("off")
    # system boundary
    ax.add_patch(Rectangle((2.6, 0.4), 9.0, 9.2, fill=False, lw=1.4, edgecolor=GREY))
    ax.text(7.1, 9.32, "Système de Gestion Juridique", ha="center", fontsize=10.5,
            fontweight="bold", color=NAVY)
    actor(ax, 1.2, 5.0, "Administrateur", 1.25)
    ucs = [
        (5.0, 8.5, 3.4, 0.85, "S'authentifier"),
        (5.0, 7.3, 3.4, 0.85, "Gérer les utilisateurs\n(créer, modifier, archiver, restaurer)"),
        (5.0, 5.9, 3.4, 0.85, "Gérer les services RBAC\n(soft-delete, restauration)"),
        (5.0, 4.5, 3.4, 0.85, "Gérer la matrice des permissions\n(18 permissions + overrides admin)"),
        (5.0, 3.1, 3.4, 0.85, "Gérer les services historiques"),
        (5.0, 1.7, 3.4, 0.85, "Gérer équipements & listes\ndynamiques"),
        (9.1, 8.5, 3.0, 0.85, "Consulter les registres\net le tableau de bord"),
        (9.1, 7.1, 3.0, 0.85, "Exporter Excel / Word"),
        (9.1, 5.7, 3.0, 0.85, "Consulter la piste\nd'audit (transactions)"),
        (9.1, 4.3, 3.0, 0.85, "Réinitialiser / relancer\nle seed RBAC"),
    ]
    for x, y, w, h, lab in ucs:
        usecase(ax, x, y, w, h, lab)
    for _, y, _, _, _ in ucs:
        link(ax, 1.45, 5.0, 3.3, y)
    # includes
    link(ax, 6.7, 7.3, 7.6, 8.5, style="--", arrow=True)
    ax.text(7.35, 7.95, "«include»\nauthentification", fontsize=7, color=GREY, ha="center")
    title(ax, "Diagramme de cas d'utilisation — Administrateur")
    save(fig, "fig03_uc_admin.png")


def fig_uc_agent():
    fig, ax = plt.subplots(figsize=(10.5, 7.8))
    ax.set_xlim(0, 12); ax.set_ylim(0, 10); ax.axis("off")
    ax.add_patch(Rectangle((2.6, 0.4), 9.0, 9.2, fill=False, lw=1.4, edgecolor=GREY))
    ax.text(7.1, 9.32, "Système de Gestion Juridique", ha="center", fontsize=10.5,
            fontweight="bold", color=NAVY)
    actor(ax, 1.2, 5.2, "Agent de service\n(Bureau d'ordre,\nOuverture, Kitaba,\nSéances, Délivrance)", 1.2)
    ucs = [
        (5.2, 8.5, 3.6, 0.85, "S'authentifier"),
        (5.2, 7.1, 3.6, 0.9, "Créer un courrier administratif\nentrant"),
        (5.2, 5.7, 3.6, 0.9, "Créer un dossier juridique\n(classique / exception)"),
        (5.2, 4.3, 3.6, 0.9, "Créer un courrier sortant\n(normal / demande)"),
        (5.2, 2.9, 3.6, 0.9, "Transférer un document\n(1..n utilisateurs, diffusion)"),
        (9.2, 8.4, 3.0, 0.85, "Accepter / Refuser un transfert\n(notifications)"),
        (9.2, 6.9, 3.0, 0.85, "Consulter l'espace de travail\n(notes, historique)"),
        (9.2, 5.4, 3.0, 0.85, "Rechercher des dossiers"),
        (9.2, 3.9, 3.0, 0.85, "Archiver / supprimer\n(soft-delete, corbeille)"),
        (9.2, 2.4, 3.0, 0.85, "Exporter Excel / Word\nImporter Excel"),
    ]
    for x, y, w, h, lab in ucs:
        usecase(ax, x, y, w, h, lab)
    for _, y, _, _, _ in ucs:
        link(ax, 1.5, 5.2, 3.4, y)
    link(ax, 7.0, 2.9, 7.7, 8.4, style="--", arrow=True)
    ax.text(7.6, 5.6, "«include»\nnotification au\ndestinataire", fontsize=7, color=GREY, ha="center")
    link(ax, 7.0, 5.7, 7.7, 6.9, style="--", arrow=True)
    ax.text(7.35, 6.55, "«include»\nauthentification", fontsize=7, color=GREY, ha="center")
    title(ax, "Diagramme de cas d'utilisation — Agent de service")
    save(fig, "fig04_uc_agent.png")


def fig_uc_archive():
    fig, ax = plt.subplots(figsize=(10.0, 6.4))
    ax.set_xlim(0, 12); ax.set_ylim(0, 8.5); ax.axis("off")
    ax.add_patch(Rectangle((2.6, 0.4), 9.0, 7.7, fill=False, lw=1.4, edgecolor=GREY))
    ax.text(7.1, 7.82, "Système de Gestion Juridique", ha="center", fontsize=10.5,
            fontweight="bold", color=NAVY)
    actor(ax, 1.2, 4.4, "Service\nArchives", 1.2)
    actor(ax, 10.8, 4.4, "Chef du greffe /\nConseiller /\n1er président", 1.0)
    ucs = [
        (5.4, 6.6, 3.4, 0.85, "S'authentifier"),
        (5.4, 5.2, 3.4, 0.85, "Archiver les dossiers clôturés\n(unitaire / par lot)"),
        (5.4, 3.8, 3.4, 0.85, "Gérer la corbeille\n(restauration)"),
        (5.4, 2.4, 3.4, 0.85, "Enregistrer un retrait\nde dossier"),
        (9.4, 4.6, 2.6, 0.8, "Retirer un dossier\n(autorité habilitée)"),
    ]
    for x, y, w, h, lab in ucs:
        usecase(ax, x, y, w, h, lab)
    for x, y, w, h, lab in ucs[:4]:
        link(ax, 1.5, 4.4, 3.7, y)
    link(ax, 10.55, 4.4, 9.4 - 1.3 + 0.55, 4.6)  # actor2 -> retrait
    link(ax, 7.1, 2.4, 8.1, 4.6, style="--", arrow=True)
    ax.text(7.75, 3.45, "«include»", fontsize=7, color=GREY, ha="center")
    title(ax, "Diagramme de cas d'utilisation — Service Archives")
    save(fig, "fig05_uc_archive.png")


# ==================================================== FIG 6 : class diagram ---
def fig_classes():
    fig, ax = plt.subplots(figsize=(13.5, 9.2))
    ax.set_xlim(0, 14); ax.set_ylim(0, 10); ax.axis("off")

    def cls(x, y, w, name, attrs, methods=None, header=LIGHT):
        n = len(attrs) + (1 if methods else 0)
        h = 0.42 + 0.24 * len(attrs) + (0.26 * len(methods) if methods else 0)
        ax.add_patch(Rectangle((x, y - h), w, h, facecolor="white", edgecolor=NAVY, lw=1.4))
        ax.add_patch(Rectangle((x, y - 0.42), w, 0.42, facecolor=header, edgecolor=NAVY, lw=1.4))
        ax.text(x + w / 2, y - 0.21, name, ha="center", va="center", fontsize=8.8,
                fontweight="bold")
        body = list(attrs) + ([ "─" ] if methods else []) + list(methods or [])
        for i, a in enumerate(body):
            ax.text(x + 0.08, y - 0.56 - i * 0.24, a, fontsize=6.9, va="center",
                    family="DejaVu Sans", color="#222222")
        return (x, y, w, h)

    # Document hierarchy (left)
    doc = cls(0.4, 9.5, 3.5, "Document", [
        "+ Id : int",
        "+ NumeroReference : string",
        "+ Objet / Sujet : string",
        "+ DateCreation : DateTime",
        "+ ServiceActuel : ServiceTribunal",
        "+ StatutActuel : StatutDossier",
        "+ NumeroBureauOrdre : string",
        "+ EstSupprime : bool  {soft-delete}",
        "+ FilePath : string?",
    ])
    ca = cls(0.4, 6.35, 3.5, "CourrierAdministratif", [
        "+ NumeroOrdre : string",
        "+ Expediteur : string",
        "+ DateReception : DateTime",
        "+ TypeCircuit : string",
        "+ Transmissible : bool",
    ])
    dj = cls(0.4, 3.55, 3.5, "DossierJuridique", [
        "+ NumeroDossierJuridique : string?",
        "+ TypeCircuit : classique|exception",
        "+ MotifException : islah|mousaada|...",
        "+ Demandeur : string",
        "+ EtapeJalsatActuelle : string",
        "+ EtapeService : int (1..4)",
        "+ JalsatTransaction / TaslimTransaction",
        "+ AutoriteRetrait : string?",
    ])
    cs = cls(0.4, 1.15, 3.5, "CourrierSortant", [
        "+ DestinataireExterne : string",
        "+ TypeSortant : normal|demande",
        "+ DateEnvoi : DateTime",
        "+ NumeroEnvoi : string",
        "+ TribunalOrigine/Destination : string",
    ])
    # inheritance arrows
    for child_y in (6.35, 3.55, 1.15):
        arrow(ax, (2.15, child_y), (2.15, 6.9 if child_y == 6.35 else (4.6 if child_y == 3.55 else 6.9)),
              color=NAVY, lw=1.3, style="-|>")
    # fix: draw proper generalization to Document bottom
    # (simpler: vertical line up to Document)
    # Transaction (middle)
    tr = cls(5.0, 8.6, 4.1, "Transaction", [
        "+ Id, DocumentId (FK)",
        "+ ServiceOrigine / ServiceDestination : ServiceTribunal",
        "+ DateTransaction : DateTime",
        "+ Statut : EnAttente|Acceptee|Refusee",
        "+ Commentaire / MotifRefus : string?",
        "+ DoitRevenir : bool",
        "+ TargetUserId (FK) → Utilisateur",
        "+ StatutPrecedent : StatutDossier? {rollback}",
        "+ HistoricalServiceCode : string?",
    ])
    action = cls(5.0, 4.6, 4.1, "ActionJuridique", [
        "+ DossierId (FK) → DossierJuridique",
        "+ Service / Action / Statut : string",
        "+ Utilisateur : string?",
        "+ DateAction : DateTime",
        "+ Donnees : JSON",
    ])
    note = cls(5.0, 2.2, 4.1, "DocumentNote / DocumentModification", [
        "+ DocumentId (FK)",
        "+ Contenu / champ modifié + horodatage",
        "+ Utilisateur",
    ])
    # RBAC (right)
    usr = cls(10.0, 9.3, 3.6, "Utilisateur", [
        "+ Id, Login, Nom",
        "+ PasswordHash (BCrypt)",
        "+ ServiceId (FK) → Service",
        "+ IsActive / DeletedAt {soft-delete}",
    ])
    svc = cls(10.0, 6.15, 3.6, "Service", [
        "+ Id, Code {unique}, Nom",
        "+ Description, IsActive, DeletedAt",
    ])
    perm = cls(10.0, 3.7, 3.6, "Permission", [
        "+ Id, Key {unique}",
        "+ LabelFr / LabelAr, Catégorie",
    ])
    sp = cls(10.0, 1.2, 3.6, "ServicePermission", [
        "+ ServiceId + PermissionKey {unique}",
        "+ Enabled : bool",
    ])
    ov = cls(5.0, 0.2, 4.1, "AdminPermissionOverride", [
        "+ PermissionKey {unique}, Enabled=false",
    ])
    # associations
    def assoc(a, b, label="", ls="-"):
        ax.add_line(Line2D([a[0] + a[2] / 2 if False else a[0] + a[2], b[0]],
                           [a[1] - a[3] / 2, b[1] - b[3] / 2], color=NAVY, lw=1.2, linestyle=ls))
        if label:
            ax.text((a[0] + a[2] + b[0]) / 2, (a[1] - a[3] / 2 + b[1] - b[3] / 2) / 2 + 0.12,
                    label, fontsize=7, color=GREY, ha="center")
    assoc(doc, tr, "1  ─  *  Transactions")
    assoc(dj, action, "1  ─  *")
    assoc(doc, note, "1  ─  *")
    assoc(usr, svc, "*  ─  1")
    assoc(svc, sp, "1  ─  *")
    assoc(perm, sp, "1  ─  *")
    # dashed links override->perm
    ax.add_line(Line2D([9.1, 10.0], [0.62, 2.6], color=NAVY, lw=1.1, linestyle="--"))
    ax.text(9.0, 1.5, "override", fontsize=7, color=GREY)
    title(ax, "Diagramme de classes — modèle de données (simplifié)")
    save(fig, "fig06_classes.png")


# ================================================ FIG 7 : seq authentication --
def fig_seq_auth():
    fig, ax = plt.subplots(figsize=(11.5, 6.6))
    ax.set_xlim(0, 12); ax.set_ylim(0, 10); ax.axis("off")
    participants = [
        ("Utilisateur", 1.3), ("LoginPage\n(React)", 3.6),
        ("AuthContext", 5.9), ("AuthController\n(API)", 8.2), ("AppDbContext\n(SQL Server)", 10.6),
    ]
    lifelines = []
    for name, x in participants:
        box(ax, x - 1.05, 9.0, 2.1, 0.75, name, fc=LIGHT, bold=True, fs=8.6)
        ax.add_line(Line2D([x, x], [9.0, 0.5], color=GREY, lw=0.9, linestyle=":"))
        lifelines.append(x)
    U, LP, AC, CTRL, DB = lifelines

    def msg(y, a, b, label, ret=False):
        arrow(ax, (a, y), (b, y), color="#222222" if not ret else GREY, lw=1.3,
              style="-|>", ls="-" if not ret else (0, (4, 2)), ms=11)
        ax.text((a + b) / 2, y + 0.13, label, ha="center", fontsize=7.6)

    msg(8.2, U, LP, "1: saisit login + mot de passe")
    msg(7.4, LP, CTRL, "2: POST /api/Auth/login")
    msg(6.6, CTRL, DB, "3: SELECT utilisateur + hash")
    msg(5.8, DB, CTRL, "4: Utilisateur (PasswordHash)")
    ax.add_patch(Rectangle((7.4, 4.9), 1.6, 0.65, facecolor="#FFF2CC", edgecolor="#B8860B", lw=1.2))
    ax.text(8.2, 5.22, "BCrypt.Verify()", ha="center", fontsize=7.6, fontweight="bold")
    msg(4.3, CTRL, DB, "5: charge Service + Permissions")
    msg(3.5, DB, CTRL, "6: permissions du service")
    msg(2.6, CTRL, LP, "7: 200 {token JWT, profil, permissions}")
    msg(1.7, LP, AC, "8: setToken + setPermissions")
    msg(0.95, LP, U, "9: redirige vers le tableau de bord", ret=True)
    ax.text(8.2, 6.15, "[échec] → 401 identifiants invalides", fontsize=7.3, color="#B23A48",
            ha="center", style="italic")
    title(ax, "Diagramme de séquence — Authentification (JWT)")
    save(fig, "fig07_seq_auth.png")


# ================================================== FIG 8 : seq transfert -----
def fig_seq_transfer():
    fig, ax = plt.subplots(figsize=(11.5, 7.4))
    ax.set_xlim(0, 12); ax.set_ylim(0, 11); ax.axis("off")
    participants = [
        ("Agent\n(expéditeur)", 1.2), ("TransferModal\n(React)", 3.3),
        ("API ASP.NET\n(Middlewares)", 5.6), ("TransactionService", 8.0),
        ("AppDbContext\n(SQL Server)", 10.6),
    ]
    for name, x in participants:
        box(ax, x - 1.05, 10.1, 2.1, 0.78, name, fc=LIGHT, bold=True, fs=8.4)
        ax.add_line(Line2D([x, x], [10.1, 0.5], color=GREY, lw=0.9, linestyle=":"))
    A, M, MW, TS, DB = [x for _, x in participants]

    def msg(y, a, b, label, ret=False):
        arrow(ax, (a, y), (b, y), color="#222222" if not ret else GREY, lw=1.3,
              style="-|>", ls="-" if not ret else (0, (4, 2)), ms=11)
        ax.text((a + b) / 2, y + 0.14, label, ha="center", fontsize=7.5)

    msg(9.2, A, M, "1: clique « Transférer »")
    msg(8.4, M, M, "", ret=False)
    ax.text(3.3, 8.62, "choisit service + utilisateurs\n+ mode + commentaire", ha="center",
            fontsize=7.3, color=GREY)
    msg(7.6, M, MW, "2: POST /api/Transfer {documentId, service, targetUserIds[]}")
    ax.add_patch(Rectangle((4.8, 6.35), 1.6, 0.95, facecolor="#FFF2CC", edgecolor="#B8860B", lw=1.2))
    ax.text(5.6, 6.82, "JWT validé\n[RequirePermission]\n(transferer)", ha="center", fontsize=7.2,
            fontweight="bold")
    msg(5.6, MW, TS, "3: création des transactions")
    msg(4.8, TS, DB, "4: statut précédent + 1 transaction / destinataire")
    msg(4.0, DB, TS, "5: OK (commit)")
    msg(3.2, TS, MW, "6: 200 OK")
    msg(2.4, MW, M, "7: 200 OK")
    msg(1.6, M, A, "8: notification destinataires + rafraîchissement", ret=True)
    ax.text(9.3, 1.0, "Destinataire → POST /api/Transactions {accepter|refuser + motif}\n"
                      "refus ⇒ rollback StatutPrecedent", fontsize=7.4, color=NAVY, ha="center",
            style="italic")
    title(ax, "Diagramme de séquence — Transfert d'un document")
    save(fig, "fig08_seq_transfer.png")


# ================================================== FIG 9 : activity ----------
def fig_activity():
    fig, ax = plt.subplots(figsize=(9.0, 11.5))
    ax.set_xlim(0, 10); ax.set_ylim(0, 15); ax.axis("off")
    cx = 5.0

    def node(y, label, shape="action", w=4.6, h=0.72):
        if shape == "start":
            ax.add_patch(Circle((cx, y), 0.22, facecolor="black"))
        elif shape == "end":
            ax.add_patch(Circle((cx, y), 0.26, facecolor="none", edgecolor="black", lw=1.6))
            ax.add_patch(Circle((cx, y), 0.16, facecolor="black"))
        elif shape == "decision":
            ax.add_patch(Rectangle((cx - w / 2, y - h / 2), w, h, facecolor="#FFF2CC",
                                   edgecolor="#B8860B", lw=1.3))
            ax.text(cx, y, label, ha="center", va="center", fontsize=8.0)
            return
        else:
            box(ax, cx - w / 2, y - h / 2, w, h, label, fs=8.4)

    def down(y1, y2, label=None, dx=0):
        arrow(ax, (cx + dx, y1), (cx + dx, y2))
        if label:
            ax.text(cx + dx + 0.12, (y1 + y2) / 2, label, fontsize=7.6, color=GREY)

    node(14.2, "", "start")
    down(13.95, 13.35)
    node(13.0, "Agent s'authentifie (JWT)")
    down(12.64, 12.05)
    node(11.7, "Bureau d'ordre : enregistrer le courrier\n(numérotation, fichier joint)")
    down(11.34, 10.75)
    node(10.4, "Ouverture des dossiers : créer le dossier\n(n° dossier, circuit classique/exception)")
    down(10.04, 9.45)
    node(9.1, "Secrétariat : préparer l'audience\n(conseiller rapporteur, date)")
    down(8.74, 8.15)
    node(7.8, "Séances : transactions d'audience\n(enquête, commissaire, expertise, rapporteur)")
    down(7.44, 6.85)
    node(6.5, "Délivrance : signification, dépens, copies")
    down(6.14, 5.55)
    node(5.2, "Transférer au service suivant\n(1..n destinataires)")
    down(4.84, 4.25)
    node(3.9, "Décision du destinataire", shape="decision")
    # branches
    arrow(ax, (cx + 2.3, 3.9), (cx + 3.4, 3.9), color="#2F7D32", lw=1.4)
    ax.text(cx + 2.42, 4.05, "[accepté]", fontsize=7.6, color="#2F7D32")
    arrow(ax, (cx - 2.3, 3.9), (cx - 3.4, 3.9), color="#B23A48", lw=1.4)
    ax.text(cx - 2.75, 4.05, "[refusé]", fontsize=7.6, color="#B23A48")
    box(ax, cx + 3.4, 2.35, 1.3, 0.9, "", fc="#F5F8FD")
    ax.text(cx + 4.05, 2.8, "Service actuel\ndu document\nmis à jour", ha="center", fontsize=7.2)
    down(3.54, 2.8, dx=4.05)
    box(ax, cx - 4.75, 2.35, 1.4, 0.9, "", fc="#F5F8FD")
    ax.text(cx - 4.05, 2.8, "Motif obligatoire\n→ rollback\nStatutPrecedent", ha="center", fontsize=7.2)
    down(3.54, 2.8, dx=-4.05)
    # merge
    arrow(ax, (cx + 4.05, 2.35), (cx, 1.55), color=NAVY, lw=1.3)
    arrow(ax, (cx - 4.05, 2.35), (cx, 1.55), color=NAVY, lw=1.3)
    node(1.2, "Dossier clôturé ?", shape="decision", w=3.6)
    arrow(ax, (cx + 1.8, 1.2), (cx + 2.9, 1.2), color="#2F7D32", lw=1.4)
    ax.text(cx + 1.9, 1.36, "[non] → nouvelle itération", fontsize=7.4, color="#2F7D32")
    ax.add_line(Line2D([cx + 2.9, cx + 2.9], [1.2, 5.2], color=NAVY, lw=1.3))
    ax.add_line(Line2D([cx + 2.9, cx + 2.42], [5.2, 5.2], color=NAVY, lw=1.3))
    arrow(ax, (cx + 2.9, 5.2), (cx + 2.42, 5.2), color=NAVY, lw=1.3)
    arrow(ax, (cx - 1.8, 1.2), (cx - 2.6, 1.2), color="#B23A48", lw=1.4)
    ax.text(cx - 2.35, 1.36, "[oui]", fontsize=7.6, color="#B23A48")
    down(0.94, 0.55, dx=-2.6)
    node(0.2, "Archivage définitif (Service Archives) + retraits", w=5.4, h=0.66)
    arrow(ax, (cx - 2.6, 0.0 + 0.53 + 0.0), (cx, -0.12 + 0.53), color=NAVY)  # dummy
    ax.add_line(Line2D([cx - 2.6, cx - 2.6], [1.2, 0.2], color=NAVY, lw=1.3))
    ax.add_line(Line2D([cx - 2.6, cx - 2.7], [0.2, 0.2], color=NAVY, lw=1.3))
    arrow(ax, (cx - 2.6, 0.2), (cx - 2.72, 0.2), color=NAVY)
    title(ax, "Diagramme d'activité — workflow Bureau d'ordre → Archives")
    save(fig, "fig09_activity.png")


# ================================================ FIG 10 : ER diagram --------
def fig_er():
    """Entity-Relationship diagram (EF Core / SQL Server) with cardinalities."""
    fig, ax = plt.subplots(figsize=(13.5, 9.8))
    ax.set_xlim(0, 14); ax.set_ylim(0, 10.5); ax.axis("off")

    def entity(x, y, w, name, rows):
        # rows: list of (text, kind) with kind in {'pk','fk','attr'}
        h = 0.40 + 0.235 * len(rows)
        ax.add_patch(Rectangle((x, y - h), w, h, facecolor="white", edgecolor=NAVY, lw=1.4))
        ax.add_patch(Rectangle((x, y - 0.40), w, 0.40, facecolor=LIGHT, edgecolor=NAVY, lw=1.4))
        ax.text(x + w / 2, y - 0.20, name, ha="center", va="center", fontsize=8.8,
                fontweight="bold")
        for i, (txt, kind) in enumerate(rows):
            yy = y - 0.53 - i * 0.235
            if kind == "pk":
                ax.text(x + 0.07, yy, txt, fontsize=6.8, va="center", family="DejaVu Sans",
                        color="#8A6D00", fontweight="bold")
            elif kind == "fk":
                ax.text(x + 0.07, yy, txt, fontsize=6.8, va="center", family="DejaVu Sans",
                        color=BLUE, style="italic")
            else:
                ax.text(x + 0.07, yy, txt, fontsize=6.8, va="center", family="DejaVu Sans",
                        color="#222222")
        return (x, y, w, h, len(rows))

    def rel(a, b, side_a="r", side_b="l", card_a="1", card_b="*", dashed=False,
            label="", la=0.0, lb=0.0):
        ax_y = a[1] - a[3] / 2
        bx_y = b[1] - b[3] / 2
        if side_a == "r":
            p1 = (a[0] + a[2], ax_y + la)
        else:
            p1 = (a[0], ax_y + la)
        if side_b == "l":
            p2 = (b[0], bx_y + lb)
        else:
            p2 = (b[0] + b[2], bx_y + lb)
        ax.add_line(Line2D([p1[0], p2[0]], [p1[1], p2[1]], color=NAVY, lw=1.2,
                           linestyle=(0, (5, 3)) if dashed else "-"))
        ax.text(p1[0] + (0.12 if side_a == "r" else -0.24), p1[1] + 0.10, card_a,
                fontsize=8, fontweight="bold", color="#B23A48",
                ha="left" if side_a == "r" else "right")
        ax.text(p2[0] + (-0.24 if side_b == "l" else 0.12), p2[1] + 0.10, card_b,
                fontsize=8, fontweight="bold", color="#B23A48",
                ha="right" if side_b == "l" else "left")
        if label:
            ax.text((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2 + 0.10, label, fontsize=6.8,
                    color=GREY, ha="center", style="italic")

    # --- documents column (left)
    doc = entity(0.3, 10.3, 3.4, "Document (TPC)", [
        ("PK  Id : int", "pk"),
        ("NumeroReference, Objet, Sujet", "attr"),
        ("ServiceActuel, StatutActuel", "attr"),
        ("EstSupprime (soft-delete)", "attr"),
        ("FilePath : string?", "attr"),
    ])
    ca = entity(0.3, 7.55, 3.4, "CourrierAdministratif", [
        ("PK  Id (héritée)", "pk"),
        ("NumeroOrdre, Expediteur", "attr"),
        ("TypeCircuit, Transmissible", "attr"),
    ])
    dj = entity(0.3, 5.15, 3.4, "DossierJuridique", [
        ("PK  Id (héritée)", "pk"),
        ("TypeCircuit, MotifException", "attr"),
        ("Demandeur, EtapeService 1..4", "attr"),
    ])
    cs = entity(0.3, 2.75, 3.4, "CourrierSortant", [
        ("PK  Id (héritée)", "pk"),
        ("TypeSortant, NumeroEnvoi", "attr"),
        ("TribunalOrigine/Destination", "attr"),
    ])
    ret = entity(0.3, 0.95, 3.4, "Retrait", [
        ("PK  Id : int", "pk"),
        ("FK  DocumentId → Document", "fk"),
        ("AutoriteRetrait, Motif", "attr"),
    ])

    # --- transactions column (middle)
    tr = entity(5.3, 10.3, 3.8, "Transaction", [
        ("PK  Id : int", "pk"),
        ("FK  DocumentId → Document", "fk"),
        ("FK  TargetUserId → Utilisateur", "fk"),
        ("ServiceOrigine / Destination", "attr"),
        ("Statut : EnAttente|Acceptee|Refusee", "attr"),
        ("StatutPrecedent (rollback)", "attr"),
    ])
    act = entity(5.3, 6.55, 3.8, "ActionJuridique", [
        ("PK  Id : int", "pk"),
        ("FK  DossierId → DossierJuridique", "fk"),
        ("Service, Action, Statut, Données JSON", "attr"),
    ])
    note = entity(5.3, 4.05, 3.8, "DocumentNote / Modification", [
        ("PK  Id : int", "pk"),
        ("FK  DocumentId → Document", "fk"),
        ("Contenu / champ + horodatage", "attr"),
    ])
    acl = entity(5.3, 1.55, 3.8, "DocumentAccess", [
        ("FK  DocumentId → Document", "fk"),
        ("ServiceCode — unique (doc, service)", "attr"),
    ])

    # --- RBAC column (right)
    usr = entity(10.3, 10.3, 3.4, "Utilisateur", [
        ("PK  Id : int", "pk"),
        ("FK  ServiceId → Service (SetNull)", "fk"),
        ("Login, PasswordHash (BCrypt)", "attr"),
        ("IsActive / DeletedAt", "attr"),
    ])
    svc = entity(10.3, 7.15, 3.4, "Service", [
        ("PK  Id : int", "pk"),
        ("Code — unique", "pk"),
        ("IsActive / DeletedAt", "attr"),
    ])
    sp = entity(10.3, 4.35, 3.4, "ServicePermission", [
        ("FK  ServiceId + PermissionKey", "fk"),
        ("unique (ServiceId, PermissionKey)", "pk"),
        ("Enabled : bool", "attr"),
    ])
    perm = entity(10.3, 1.55, 3.4, "Permission", [
        ("PK  Id : int", "pk"),
        ("Key — unique", "pk"),
        ("LabelFr / LabelAr, Category", "attr"),
    ])

    # inheritance (TPC): children -> Document
    for cy in (7.55 - 1.0, 5.15 - 0.9, 2.75 - 0.9):
        ax.add_line(Line2D([2.0, 2.0], [cy, cy + 0.35], color=NAVY, lw=1.1))
    ax.add_line(Line2D([0.6, 3.4], [6.95, 6.95], color=NAVY, lw=1.1))
    ax.add_line(Line2D([0.6, 0.6], [6.95, 7.55 - 1.0 - 0.35 + 0.35], color=NAVY, lw=0))
    # simple upward arrows from each child box top to Document bottom
    for child_y in (7.55 - 1.0, 5.15 - 0.9, 2.75 - 0.9):
        arrow(ax, (1.05 if child_y > 5 else 1.05, child_y), (1.05, 10.3 - 1.55),
              color=NAVY, lw=1.0, style="-|>", ls=(0, (4, 3)))
    ax.text(0.45, 10.3 - 1.75, "héritage", fontsize=6.8, color=GREY, style="italic",
            ha="left", rotation=90)

    # relationships with cardinalities
    rel(doc, tr, "r", "l", "1", "0..*", label="Transactions")
    rel(doc, note, "r", "l", "1", "0..*", label="notes / audit", la=-1.2, lb=0.4)
    rel(doc, acl, "r", "l", "1", "0..*", label="ACL", la=-2.4, lb=-0.2)
    rel(doc, ret, "r", "l", "1", "0..*", label="retraits", la=0.0, lb=0.2)
    rel(dj, act, "r", "l", "1", "0..*", label="actions", la=-0.6, lb=0.2)
    rel(tr, usr, "r", "l", "*", "0..1", label="cible (SetNull)", la=-0.8, lb=-0.6)
    rel(usr, svc, "r", "l", "*", "1", label="appartient", la=-0.6, lb=-0.4)
    rel(svc, sp, "r", "l", "1", "0..*", label="", la=-0.6, lb=-0.3)
    rel(perm, sp, "r", "r", "1", "0..*", label="", la=-0.4, lb=-0.3)
    # permission key (logical FK)
    ax.add_line(Line2D([10.3, 9.1], [1.9, 3.6], color=NAVY, lw=1.0, linestyle=(0, (5, 3))))
    ax.text(9.45, 2.6, "PermissionKey (logique)", fontsize=6.6, color=GREY, style="italic",
            rotation=38)

    title(ax, "Diagramme Entité-Association (EF Core / SQL Server) — cardinalités")
    save(fig, "fig10_er.png")


if __name__ == "__main__":
    fig_workflow()
    fig_archi()
    fig_uc_admin()
    fig_uc_agent()
    fig_uc_archive()
    fig_classes()
    fig_seq_auth()
    fig_seq_transfer()
    fig_activity()
    fig_er()
    export_standalone()
    print("All diagrams generated in", OUT_DIR, "and exported to", EXPORT_DIR)
