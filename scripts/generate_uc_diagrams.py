# -*- coding: utf-8 -*-
"""
Génère les diagrammes de cas d'utilisation (PNG) avec matplotlib.
Sortie : diagrams/UC_*.png
"""
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Ellipse, FancyArrowPatch, Rectangle, Circle
from matplotlib.lines import Line2D

plt.rcParams["font.family"] = "DejaVu Sans"

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "diagrams")
os.makedirs(OUT, exist_ok=True)

NAVY = "#1F3864"
BLUE = "#2E74B5"
LIGHT = "#DCE6F1"
LIGHTER = "#EEF3FB"
GREY = "#555555"
RED = "#B23A48"


def actor(ax, x, y, label, scale=1.0):
    s = scale
    ax.add_patch(Circle((x, y + 0.42 * s), 0.10 * s, fill=False, lw=1.6, color="black"))
    ax.plot([x, x], [y + 0.32 * s, y + 0.02 * s], color="black", lw=1.6)
    ax.plot([x - 0.14 * s, x + 0.14 * s], [y + 0.24 * s, y + 0.24 * s], color="black", lw=1.6)
    ax.plot([x, x - 0.10 * s], [y + 0.02 * s, y - 0.16 * s], color="black", lw=1.6)
    ax.plot([x, x + 0.10 * s], [y + 0.02 * s, y - 0.16 * s], color="black", lw=1.6)
    ax.text(x, y - 0.30 * s, label, ha="center", va="top", fontsize=9, fontweight="bold")


def usecase(ax, x, y, w, h, label, fs=7.5):
    e = Ellipse((x, y), w, h, facecolor=LIGHTER, edgecolor=NAVY, lw=1.2)
    ax.add_patch(e)
    ax.text(x, y, label, ha="center", va="center", fontsize=fs, linespacing=1.15)


def link(ax, x1, y1, x2, y2, style="-", arrow=False):
    ax.add_patch(FancyArrowPatch(
        (x1, y1), (x2, y2),
        arrowstyle="-" if not arrow else "->",
        mutation_scale=10, lw=0.9, color="black",
        linestyle=style, shrinkA=2, shrinkB=2,
    ))


def title(ax, t):
    ax.text(0.5, 1.02, t, transform=ax.transAxes, ha="center", va="bottom",
            fontsize=12, fontweight="bold", color=NAVY)


def _save(fig, name):
    path = os.path.join(OUT, name)
    fig.savefig(path, dpi=200, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print(f"saved {path}")


def fig_bureau_ordre():
    fig, ax = plt.subplots(figsize=(11, 8))
    ax.set_xlim(0, 12); ax.set_ylim(0, 10); ax.axis("off")
    ax.add_patch(Rectangle((2.4, 0.3), 9.2, 9.3, fill=False, lw=1.4, edgecolor=GREY))
    ax.text(7.0, 9.35, "Système de Gestion Juridique — Bureau d'ordre (19 permissions)",
            ha="center", fontsize=10, fontweight="bold", color=NAVY)
    actor(ax, 1.1, 5.0, "Agent\nBureau\nd'Ordre", 1.2)
    ucs = [
        (5.0, 8.8, 3.2, 0.7, "Créer courrier admin"),
        (5.0, 7.8, 3.2, 0.7, "Créer courrier sortant"),
        (5.0, 6.8, 3.2, 0.7, "Modifier document"),
        (5.0, 5.8, 3.2, 0.7, "Supprimer (soft delete)"),
        (5.0, 4.8, 3.2, 0.7, "Importer Excel"),
        (5.0, 3.8, 3.2, 0.7, "Transférer (unique/diffusion)"),
        (5.0, 2.8, 3.2, 0.7, "Accepter / Refuser"),
        (5.0, 1.8, 3.2, 0.7, "Annuler transfert"),
        (5.0, 0.8, 3.2, 0.7, "Recherche avancée"),
        (8.8, 8.8, 2.8, 0.7, "Export Excel / Word"),
        (8.8, 7.8, 2.8, 0.7, "Espace de travail"),
        (8.8, 6.8, 2.8, 0.7, "Ajouter notes"),
        (8.8, 5.8, 2.8, 0.7, "Historique"),
        (8.8, 4.8, 2.8, 0.7, "Dashboard"),
        (8.8, 3.8, 2.8, 0.7, "Mes entités"),
        (8.8, 2.8, 2.8, 0.7, "Transactions"),
        (8.8, 1.8, 2.8, 0.7, "Télécharger fichiers"),
        (8.8, 0.8, 2.8, 0.7, "Mon profil"),
    ]
    for x, y, w, h, lab in ucs:
        usecase(ax, x, y, w, h, lab)
    for _, y, _, _, _ in ucs:
        link(ax, 1.4, 5.0, 3.3, y)
    title(ax, "Diagramme de cas d'utilisation — Bureau d'ordre")
    _save(fig, "UC_BureauOrdre.png")


def fig_ouverture():
    fig, ax = plt.subplots(figsize=(11, 8))
    ax.set_xlim(0, 12); ax.set_ylim(0, 10); ax.axis("off")
    ax.add_patch(Rectangle((2.4, 0.3), 9.2, 9.3, fill=False, lw=1.4, edgecolor=GREY))
    ax.text(7.0, 9.35, "Système de Gestion Juridique — Ouverture des dossiers (20 permissions)",
            ha="center", fontsize=10, fontweight="bold", color=NAVY)
    actor(ax, 1.1, 5.0, "Agent\nOuverture", 1.2)
    ucs = [
        (5.0, 8.8, 3.2, 0.7, "Créer dossier juridique"),
        (5.0, 7.8, 3.2, 0.7, "Créer/Modifier document"),
        (5.0, 6.8, 3.2, 0.7, "Ouvrir dossier judiciaire"),
        (5.0, 5.8, 3.2, 0.7, "Transférer juridique"),
        (5.0, 4.8, 3.2, 0.7, "Transférer (standard)"),
        (5.0, 3.8, 3.2, 0.7, "Accepter / Refuser"),
        (5.0, 2.8, 3.2, 0.7, "Annuler transfert"),
        (5.0, 1.8, 3.2, 0.7, "Recherche avancée"),
        (5.0, 0.8, 3.2, 0.7, "Import Excel"),
        (8.8, 8.8, 2.8, 0.7, "Export Excel / Word"),
        (8.8, 7.8, 2.8, 0.7, "Espace de travail"),
        (8.8, 6.8, 2.8, 0.7, "Ajouter notes"),
        (8.8, 5.8, 2.8, 0.7, "Historique"),
        (8.8, 4.8, 2.8, 0.7, "Dashboard"),
        (8.8, 3.8, 2.8, 0.7, "Mes entités"),
        (8.8, 2.8, 2.8, 0.7, "Transactions"),
        (8.8, 1.8, 2.8, 0.7, "Télécharger fichiers"),
        (8.8, 0.8, 2.8, 0.7, "Mon profil"),
    ]
    for x, y, w, h, lab in ucs:
        usecase(ax, x, y, w, h, lab)
    for _, y, _, _, _ in ucs:
        link(ax, 1.4, 5.0, 3.3, y)
    title(ax, "Diagramme de cas d'utilisation — Ouverture des dossiers")
    _save(fig, "UC_OuvertureDossiers.png")


def fig_archive():
    fig, ax = plt.subplots(figsize=(11, 8))
    ax.set_xlim(0, 12); ax.set_ylim(0, 10); ax.axis("off")
    ax.add_patch(Rectangle((2.4, 0.3), 9.2, 9.3, fill=False, lw=1.4, edgecolor=GREY))
    ax.text(7.0, 9.35, "Système de Gestion Juridique — Service Archive (20 permissions)",
            ha="center", fontsize=10, fontweight="bold", color=NAVY)
    actor(ax, 1.1, 5.2, "Agent\nArchive", 1.2)
    actor(ax, 10.5, 5.2, "Chef du\ngreffe /\nAutorité", 0.9)
    ucs = [
        (5.0, 8.8, 3.2, 0.7, "Archiver document"),
        (5.0, 7.8, 3.2, 0.7, "Voir corbeille"),
        (5.0, 6.8, 3.2, 0.7, "Restaurer document"),
        (5.0, 5.8, 3.2, 0.7, "Supprimer définitivement"),
        (5.0, 4.8, 3.2, 0.7, "Voir les archives"),
        (5.0, 3.8, 3.2, 0.7, "Enregistrer retrait"),
        (5.0, 2.8, 3.2, 0.7, "Transférer judiciaire"),
        (5.0, 1.8, 3.2, 0.7, "Accepter / Refuser"),
        (5.0, 0.8, 3.2, 0.7, "Recherche + Export"),
        (8.8, 8.8, 2.8, 0.7, "Dashboard"),
        (8.8, 7.8, 2.8, 0.7, "Mes entités"),
        (8.8, 6.8, 2.8, 0.7, "Transactions"),
        (8.8, 5.8, 2.8, 0.7, "Historique"),
        (8.8, 4.8, 2.8, 0.7, "Télécharger fichiers"),
        (8.8, 3.8, 2.8, 0.7, "Mon profil"),
    ]
    for x, y, w, h, lab in ucs:
        usecase(ax, x, y, w, h, lab)
    for _, y, _, _, _ in ucs:
        link(ax, 1.4, 5.2, 3.3, y)
    link(ax, 10.2, 5.2, 8.8 - 1.4 + 0.55, 3.8)
    title(ax, "Diagramme de cas d'utilisation — Service Archive")
    _save(fig, "UC_Archive.png")


def fig_admin():
    fig, ax = plt.subplots(figsize=(12, 8.5))
    ax.set_xlim(0, 13); ax.set_ylim(0, 10.5); ax.axis("off")
    ax.add_patch(Rectangle((2.4, 0.3), 10.2, 9.9, fill=False, lw=1.4, edgecolor=GREY))
    ax.text(7.5, 9.95, "Système de Gestion Juridique — Administrateur (RBAC)",
            ha="center", fontsize=11, fontweight="bold", color=NAVY)
    actor(ax, 1.1, 5.2, "Adminis-\ntrateur", 1.3)
    ucs = [
        (5.0, 9.2, 3.4, 0.7, "Gérer utilisateurs (CRUD)"),
        (5.0, 8.1, 3.4, 0.7, "Gérer services RBAC"),
        (5.0, 7.0, 3.4, 0.7, "Matrice permissions (37 clés)"),
        (5.0, 5.9, 3.4, 0.7, "Overrides admin (séparation)"),
        (5.0, 4.8, 3.4, 0.7, "Gérer équipements"),
        (5.0, 3.7, 3.4, 0.7, "Gérer listes dynamiques"),
        (5.0, 2.6, 3.4, 0.7, "Gérer services historiques"),
        (5.0, 1.5, 3.4, 0.7, "Consulter les registres"),
        (9.2, 9.2, 3.0, 0.7, "Consulter archives"),
        (9.2, 8.1, 3.0, 0.7, "Recherche avancée"),
        (9.2, 7.0, 3.0, 0.7, "Export Excel / Word"),
        (9.2, 5.9, 3.0, 0.7, "Dashboard"),
        (9.2, 4.8, 3.0, 0.7, "Détails document"),
        (9.2, 3.7, 3.0, 0.7, "Mon profil"),
    ]
    for x, y, w, h, lab in ucs:
        usecase(ax, x, y, w, h, lab)
    for _, y, _, _, _ in ucs:
        link(ax, 1.4, 5.2, 3.3, y)
    ax.add_patch(FancyBboxPatch(
        (9.0, 0.4), 3.4, 1.8,
        boxstyle="round,pad=0.1,rounding_size=0.1",
        facecolor="#FFF9E6", edgecolor="#CCAA00", lw=1.2,
    ))
    ax.text(10.7, 1.9, "AdminPermissionOverrides\n20 permissions désactivées\npar défaut :",
            ha="center", va="top", fontsize=7.5, fontweight="bold")
    ax.text(10.7, 1.1, "crée, transfère, supprime,\naccepte, refuse, exporte...",
            ha="center", va="top", fontsize=7, color=RED)
    title(ax, "Diagramme de cas d'utilisation — Administrateur")
    _save(fig, "UC_Administrateur.png")


def fig_global():
    fig, ax = plt.subplots(figsize=(12, 9))
    ax.set_xlim(0, 13); ax.set_ylim(0, 11); ax.axis("off")
    ax.add_patch(Rectangle((2.6, 0.3), 10.0, 10.4, fill=False, lw=1.4, edgecolor=GREY))
    ax.text(7.6, 10.45, "Système de Gestion Juridique — Vue globale",
            ha="center", fontsize=11, fontweight="bold", color=NAVY)
    actor(ax, 1.2, 5.5, "Admin", 1.2)
    actor(ax, 1.2, 2.5, "Agent de\nservice\n(x9)", 1.2)
    actor(ax, 11.5, 2.5, "Chef du\ngreffe", 0.9)
    pairs = [
        (5.0, 9.8, 3.0, 0.65, "S'authentifier (JWT)"),
        (8.5, 9.8, 2.8, 0.65, "Profil + Dashboard"),
        (4.5, 8.7, 3.4, 0.65, "Créer documents\n(admin/juridique/sortant)"),
        (8.2, 8.7, 3.0, 0.65, "Modifier / Supprimer"),
        (4.5, 7.6, 3.4, 0.65, "Transférer (unique/diffusion)"),
        (8.2, 7.6, 3.0, 0.65, "Transfert judiciaire (6 étapes)"),
        (4.5, 6.5, 3.4, 0.65, "Accepter / Refuser / Annuler"),
        (8.2, 6.5, 3.0, 0.65, "Notifications + doit-revenir"),
        (4.5, 5.4, 3.4, 0.65, "Avancer/Reculer étape (Jalsat)"),
        (8.2, 5.4, 3.0, 0.65, "Ouvrir/Clôturer dossier"),
        (4.5, 4.3, 3.4, 0.65, "Recherche avancée"),
        (8.2, 4.3, 3.0, 0.65, "Export Excel / Word"),
        (4.5, 3.2, 3.4, 0.65, "Espace de travail (notes, hist.)"),
        (4.5, 2.1, 3.4, 0.65, "Archiver / Corbeille / Restaurer"),
        (8.2, 2.1, 3.0, 0.65, "Retrait dossier"),
        (4.5, 1.0, 3.4, 0.65, "Gérer utilisateurs + services"),
        (8.2, 1.0, 3.0, 0.65, "Matrice permissions + overrides"),
    ]
    for x, y, w, h, lab in pairs:
        usecase(ax, x, y, w, h, lab)
    for y in [9.8, 8.7, 7.6, 6.5, 5.4, 4.3, 3.2, 2.1]:
        link(ax, 1.5, 2.5, 2.7, y)
    for y in [9.8, 8.7, 1.0]:
        link(ax, 1.5, 5.5, 2.7, y)
    link(ax, 11.2, 2.5, 9.7, 2.1)
    title(ax, "Diagramme de cas d'utilisation — Vue globale simplifiée")
    _save(fig, "UC_Global.png")


if __name__ == "__main__":
    fig_bureau_ordre()
    fig_ouverture()
    fig_archive()
    fig_admin()
    fig_global()
    print("All use-case diagrams generated in", OUT)
