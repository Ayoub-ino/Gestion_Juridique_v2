# -*- coding: utf-8 -*-
"""
Génère la présentation de soutenance (PowerPoint) pour le PFE Gestion Juridique.
Réalisé par : Ayoub AGROUKH & Ikrame OUDGHIRI

- 16:9, charte sobre (navy/blanc) cohérente avec le rapport
- Réutilise les diagrammes exportés dans diagrams/ (PNG 200 dpi)
- Notes de l'orateur incluses sur chaque diapositive (mode présentateur)
"""
import os
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIAG = os.path.join(ROOT, "diagrams")
OUT = os.path.join(ROOT, "Soutenance_Gestion_Juridique.pptx")

NAVY = RGBColor(0x1F, 0x38, 0x64)
BLUE = RGBColor(0x2E, 0x74, 0xB5)
LIGHT = RGBColor(0xDC, 0xE6, 0xF1)
GREY = RGBColor(0x55, 0x55, 0x55)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)

SW, SH = Inches(13.333), Inches(7.5)  # 16:9

prs = Presentation()
prs.slide_width = SW
prs.slide_height = SH
BLANK = prs.slide_layouts[6]

IMG_SCALE = 0.92  # % of available box used by images


# ---------------------------------------------------------------- helpers ---
def add_slide():
    return prs.slides.add_slide(BLANK)


def style_title(tb, text, size=30, color=NAVY):
    tf = tb.text_frame
    tf.clear()
    p = tf.paragraphs[0]
    r = p.add_run()
    r.text = text
    r.font.size = Pt(size)
    r.font.bold = True
    r.font.color.rgb = color
    r.font.name = "Calibri"
    return tb


def header(slide, text, sub=None):
    """Bandeau de titre standard."""
    bar = slide.shapes.add_shape(1, Inches(0), Inches(0), SW, Inches(0.95))
    bar.fill.solid()
    bar.fill.fore_color.rgb = NAVY
    bar.line.fill.background()
    tf = bar.text_frame
    tf.margin_left = Inches(0.55)
    tf.margin_top = Inches(0.08)
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]
    r = p.add_run()
    r.text = text
    r.font.size = Pt(24)
    r.font.bold = True
    r.font.color.rgb = WHITE
    r.font.name = "Calibri"
    if sub:
        r2 = p.add_run()
        r2.text = "   |   " + sub
        r2.font.size = Pt(14)
        r2.font.color.rgb = LIGHT
        r2.font.name = "Calibri"


def bullets(slide, items, left=0.7, top=1.25, width=12.0, height=5.9, size=16):
    tb = slide.shapes.add_textbox(Inches(left), Inches(top), Inches(width), Inches(height))
    tf = tb.text_frame
    tf.word_wrap = True
    first = True
    for it in items:
        if isinstance(it, tuple):
            txt, lvl = it
        else:
            txt, lvl = it, 0
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        p.level = lvl
        r = p.add_run()
        r.text = ("• " if lvl == 0 else "– ") + txt
        r.font.size = Pt(size if lvl == 0 else size - 2)
        r.font.color.rgb = RGBColor(0x22, 0x22, 0x22)
        r.font.name = "Calibri"
        p.space_after = Pt(7 if lvl == 0 else 4)
    return tb


def notes(slide, text):
    slide.notes_slide.notes_text_frame.text = text


def pic(slide, fname, left, top, max_w, max_h):
    """Insère une image centrée dans une boîte max_w × max_h (pouces)."""
    path = os.path.join(DIAG, fname)
    if not os.path.exists(path):
        raise SystemExit("Missing diagram: " + path)
    from PIL import Image
    with Image.open(path) as im:
        iw, ih = im.size
    scale = min(max_w / iw, max_h / ih) * IMG_SCALE
    w, h = iw * scale, ih * scale
    return slide.shapes.add_picture(path, Inches(left + (max_w - w) / 2),
                                    Inches(top + (max_h - h) / 2),
                                    Inches(w), Inches(h))


def footer(slide, n):
    tb = slide.shapes.add_textbox(Inches(11.9), Inches(7.08), Inches(1.2), Inches(0.35))
    p = tb.text_frame.paragraphs[0]
    r = p.add_run()
    r.text = f"{n:02d}"
    r.font.size = Pt(11)
    r.font.color.rgb = GREY
    r.font.name = "Calibri"


N = 0


def num():
    global N
    N += 1
    return N


# ------------------------------------------------------------- 01 : title ---
s = add_slide()
bg = s.shapes.add_shape(1, Inches(0), Inches(0), SW, SH)
bg.fill.solid()
bg.fill.fore_color.rgb = NAVY
bg.line.fill.background()

tb = s.shapes.add_textbox(Inches(0.8), Inches(1.6), Inches(11.7), Inches(3.4))
tf = tb.text_frame
tf.word_wrap = True
p = tf.paragraphs[0]
r = p.add_run(); r.text = "Application de Gestion des Dossiers Judiciaires"
r.font.size = Pt(40); r.font.bold = True; r.font.color.rgb = WHITE
p2 = tf.add_paragraph(); p2.space_before = Pt(14)
r = p2.add_run(); r.text = "Système de gestion juridique — digitalisation du circuit documentaire"
r.font.size = Pt(20); r.font.color.rgb = LIGHT
p3 = tf.add_paragraph(); p3.space_before = Pt(30)
r = p3.add_run(); r.text = "Cour d'Appel Administrative"
r.font.size = Pt(16); r.font.color.rgb = LIGHT

tb2 = s.shapes.add_textbox(Inches(0.8), Inches(5.3), Inches(11.7), Inches(1.6))
tf2 = tb2.text_frame
p = tf2.paragraphs[0]
r = p.add_run(); r.text = "Présenté par :  Ayoub AGROUKH  &  Ikrame OUDGHIRI"
r.font.size = Pt(22); r.font.bold = True; r.font.color.rgb = WHITE
p = tf2.add_paragraph(); p.space_before = Pt(10)
r = p.add_run(); r.text = "Encadrant académique : Pr. [Nom]      Encadrant tribunal : M. [Nom]      Année universitaire 2025-2026"
r.font.size = Pt(14); r.font.color.rgb = LIGHT
notes(s, "Bonjour. Nous présentons notre projet de fin d'études : la conception et la réalisation "
         "d'une application web de gestion des dossiers judiciaires pour la Cour d'Appel "
         "Administrative, réalisée par Ayoub AGROUKH et Ikrame OUDGHIRI.")

# --------------------------------------------------------- 02 : plan ------
s = add_slide()
header(s, "Plan de la présentation")
num()
bullets(s, [
    "Contexte et problématique",
    "Solution proposée et démonstration fonctionnelle",
    "Conception (UML) et architecture technique",
    "Sécurité : authentification JWT et RBAC dynamique",
    "Qualité : tests et validation",
    "Démonstration vidéo / captures",
    "Bilan, perspectives et conclusion",
], size=20)
notes(s, "Le plan suit le fil du rapport : du besoin métier vers la solution, la conception, la "
         "sécurité — le point fort du projet — puis la qualité et le bilan.")

# ------------------------------------------------- 03 : contexte ----------
s = add_slide()
header(s, "Contexte", "Cour d'Appel Administrative")
num()
bullets(s, [
    "Circuit documentaire en 6 étapes : Bureau d'ordre → Ouverture → Secrétariat particulier → Séances & audiences → Délivrance & clôture → Archives",
    "Gestion aujourd'hui essentiellement papier : registres manuels, transferts physiques",
    "Stage d'immersion : observation des services et entretiens avec les agents",
    "Objectif : digitaliser le circuit sans le bouleverser — l'application reflète l'organisation réelle du tribunal",
], size=18)
pic(s, "Figure_01_Workflow_dossier_judiciaire_6_etapes.png", 6.9, 1.2, 6.0, 5.6)
notes(s, "La Cour traite les recours contre les décisions administratives. Un dossier traverse six "
         "services dans un ordre strict. Le diagramme reprend le circuit réel observé pendant le "
         "stage — chaque étape correspond à un service RBAC dans l'application.")

# ------------------------------------------------- 04 : problématique -----
s = add_slide()
header(s, "Problématique")
num()
bullets(s, [
    "Traçabilité : où est le dossier ? qui l'a traité ? — plusieurs heures de recherche en cas d'égarement",
    "Lenteur des échanges : aucun accusé de réception entre services",
    "Historique non fiable : registres manuels, pas de statistiques",
    "Aucun contrôle d'accès fin entre services",
    "Bilinguisme FR/AR difficile à maintenir sur papier",
], size=18)
box = s.shapes.add_shape(1, Inches(0.7), Inches(5.6), Inches(11.9), Inches(1.2))
box.fill.solid(); box.fill.fore_color.rgb = LIGHT; box.line.fill.background()
tf = box.text_frame; tf.word_wrap = True
tf.margin_left = Inches(0.3)
p = tf.paragraphs[0]
r = p.add_run()
r.text = "Comment digitaliser ce circuit en garantissant traçabilité totale, contrôle d'accès fin par service et bilinguisme ?"
r.font.size = Pt(17); r.font.bold = True; r.font.color.rgb = NAVY
notes(s, "Six difficultés majeures relevées sur le terrain. La question centrale est affichée en "
         "bas : elle structure toute la solution présentée ensuite.")

# ------------------------------------------- 05 : solution (fonctionnel) --
s = add_slide()
header(s, "Solution proposée", "Fonctionnalités clés")
num()
bullets(s, [
    "3 familles de documents : courriers administratifs, dossiers judiciaires, courriers sortants (avec fichiers joints)",
    "Transferts inter-services avec accusé de réception : accepter ou refuser (motif obligatoire, retour expéditeur)",
    "Espace de travail par document : informations, notes, historique complet, fichiers",
    "Workflow visible : progression en 6 étapes, registre des transactions",
    "Recherche multicritère, corbeille, retraits d'archives autorisés",
    "Import/Export Excel & Word — back-office complet (utilisateurs, services, permissions)",
    "Interface bilingue FR/AR (RTL) avec thème clair/sombre",
], size=16)
notes(s, "La couverture fonctionnelle reflète point par point la spécification des besoins. "
         "Insister sur l'accusé de réception : le refus motive un retour automatique à "
         "l'expéditeur — c'est le cœur du workflow.")

# ------------------------------------------- 06 : architecture ------------
s = add_slide()
header(s, "Architecture technique", "3 tiers")
num()
pic(s, "Figure_02_Architecture_3_tiers.png", 0.4, 1.05, 8.0, 6.2)
bullets(s, [
    "Next.js 16 / React 19 (TypeScript)",
    "API REST ASP.NET Core 10 — 22 contrôleurs, 114 endpoints",
    "SQL Server + EF Core 10 (migrations, seed)",
    "Typage de bout en bout : contrats OpenAPI → types TS",
], left=8.6, top=1.5, width=4.5, height=5.0, size=15)
notes(s, "Architecture classique 3 tiers, éprouvée. Le point clé : le typage de bout en bout — "
         "les types TypeScript sont générés depuis l'OpenAPI du backend, toute divergence est "
         "détectée à la compilation.")

# ------------------------------------------- 07 : conception UML ----------
s = add_slide()
header(s, "Conception", "Diagramme de classes (extrait)")
num()
pic(s, "Figure_06_Diagramme_de_classes_RBAC_documents.png", 0.4, 1.05, 8.6, 6.2)
bullets(s, [
    "Hiérarchie Document (TPC) : administratif, judiciaire, sortant",
    "Transaction = traçabilité des mouvements (jamais supprimée)",
    "Socle RBAC : Service × Permission (matrice dynamique)",
    "11 fiches de cas d'utilisation détaillées dans le rapport",
], left=9.2, top=1.5, width=4.0, height=5.0, size=14)
notes(s, "Le modèle de données est le contrat du projet. Trois choix structurants : l'héritage "
         "TPC des documents, la table Transaction conservée intégralement pour la chaîne de "
         "responsabilité, et la matrice service × permission.")

# ------------------------------------------- 08 : sécurité JWT ------------
s = add_slide()
header(s, "Sécurité", "Authentification JWT")
num()
pic(s, "Figure_07_Sequence_Authentification_JWT.png", 0.4, 1.05, 8.4, 6.2)
bullets(s, [
    "BCrypt : mots de passe jamais en clair (salt intégré)",
    "JWT signé, expiration stricte (ClockSkew = 0)",
    "Token en mémoire côté client, jamais en localStorage",
    "Message d'erreur générique : pas d'indice à l'attaquant",
], left=9.0, top=1.5, width=4.2, height=5.0, size=15)
notes(s, "Authentification sans état, adaptée à une SPA. Détail apprécié des jurys : le skew "
         "horaire est nul, un token expiré est rejeté immédiatement. Les erreurs de connexion "
         "sont volontairement génériques.")

# ------------------------------------------- 09 : sécurité RBAC -----------
s = add_slide()
header(s, "Sécurité", "RBAC dynamique")
num()
bullets(s, [
    "18 permissions dynamiques × 9 services métier — matrice modifiable à chaud",
    "Attribut [RequirePermission] sur chaque endpoint sensible (114 endpoints protégés)",
    "Middleware serveur : permissions du service + overrides administrateur → 403 sinon",
    "Séparation des responsabilités : 20 permissions métier désactivées pour l'admin",
    "Double commande : l'UI masque (ergonomie), le serveur interdit (sécurité)",
], size=17)
notes(s, "Le point fort du projet. L'administrateur peut reconfigurer les droits sans "
         "redéploiement. Insister sur la règle d'or : le navigateur ne décide rien, le serveur "
         "vérifie tout — masquer un bouton n'est qu'une question d'ergonomie, jamais de sécurité.")

# ------------------------------------------- 10 : transfert ---------------
s = add_slide()
header(s, "Scénario cœur", "Transfert d'un document")
num()
pic(s, "Figure_08_Sequence_Transfert_document.png", 0.4, 1.05, 8.4, 6.2)
bullets(s, [
    "JWT → permissions → transaction SQL",
    "Multi-destinataires : 1 transaction par destinataire",
    "Rollback intégral : jamais de « demi-transfert »",
    "Refus : motif obligatoire + retour à l'expéditeur",
], left=9.0, top=1.5, width=4.2, height=5.0, size=15)
notes(s, "Le scénario qui traverse toutes les couches. La transaction SQL garantit l'atomicité : "
         "toute erreur annule l'ensemble. Le statut précédent est sauvegardé pour permettre le "
         "retour arrière en cas de refus.")

# ------------------------------------------- 11 : tests -------------------
s = add_slide()
header(s, "Qualité", "Stratégie de tests")
num()
bullets(s, [
    "103 tests unitaires xUnit — règles métier et sécurité (middleware, transactions, seed)",
    "62 scénarios Cypress E2E — parcours réels, comportement dynamique des permissions",
    "Audit boîte noire : 46 vérifications HTTP (200 si autorisé / 403 sinon)",
    "Matrice documentée régénérable par scan du code — la doc ne diverge pas du code",
], size=17)
# mini-table
from pptx.util import Inches as In
rows, cols = 5, 2
tbl = s.shapes.add_table(rows, cols, Inches(0.9), Inches(4.6), Inches(7.2), Inches(2.2)).table
tbl.columns[0].width = In(5.4)
tbl.columns[1].width = In(1.8)
data = [("Suite", "Volume"), ("xUnit backend", "103"), ("Cypress app.cy.ts", "35"),
        ("Cypress permission-toggle", "27"), ("Audit permissions", "46")]
for i, (a, b) in enumerate(data):
    for j, v in enumerate((a, b)):
        cell = tbl.cell(i, j)
        cell.text = v
        para = cell.text_frame.paragraphs[0]
        para.runs[0].font.size = Pt(13)
        para.runs[0].font.bold = (i == 0)
notes(s, "Trois niveaux complémentaires : la règle métier est prouvée unitairement, le parcours "
         "utilisateur validé de bout en bout, la politique de sécurité auditée de l'extérieur "
         "comme le ferait un attaquant. La pyramide de tests, appliquée.")

# ------------------------------------------- 12 : démarche + difficultés --
s = add_slide()
header(s, "Démarche & difficultés surmontées")
num()
bullets(s, [
    "Cycle en V adapté : spécification validée → conception UML → développement incrémental → tests → recette agents",
    "Binôme : noyau commun (analyse, conception) puis modules parallèles, revue croisée Git",
    "Contrôle d'accès repensé : paramètre client → attribut serveur (zéro régression, prouvé par la suite de tests)",
    "Overrides administrateur : séparation des responsabilités (20 permissions métier désactivées)",
    "Transactions SQL : atomicité des transferts (rollback intégral)",
    "HistoricalService : les références passées restent lisibles après renommage d'un service",
], size=16)
notes(s, "La diapositive « difficultés » est souvent la plus appréciée du jury : elle montre la "
         "maturité. Chaque difficulté présentée avec sa solution — la refonte du contrôle "
         "d'accès est l'exemple phare, sécurisée par la suite de tests.")

# ------------------------------------------- 13 : perspectives ------------
s = add_slide()
header(s, "Perspectives")
num()
bullets(s, [
    "Cache mémoire des permissions avec invalidation — pour de plus forts volumes",
    "Notifications asynchrones (file de messages) et e-mailing",
    "Statistiques avancées et tableaux de bord de pilotage pour la direction",
    "Signature électronique des documents et archivage conforme",
    "Déploiement sécurisé sur le réseau du tribunal (HTTPS, sauvegardes)",
], size=18)
notes(s, "Des perspectives réalistes, cohérentes avec les limites assumées du rapport (cache des "
         "permissions, notifications synchrones). Elles montrent que le système est pensé pour "
         "évoluer.")

# ------------------------------------------- 14 : conclusion --------------
s = add_slide()
header(s, "Conclusion")
num()
bullets(s, [
    "Une application full-stack opérationnelle : le circuit papier → un workflow digitalisé, tracé et sécurisé",
    "Traçabilité totale : chaque mouvement horodaté et attribuable — chaîne de responsabilité complète",
    "Sécurité éprouvée : RBAC dynamique vérifié par 211 tests et audits automatisés",
    "Répond point par point à la problématique posée en ouverture",
], size=18)
box = s.shapes.add_shape(1, Inches(0.7), Inches(5.7), Inches(11.9), Inches(1.1))
box.fill.solid(); box.fill.fore_color.rgb = NAVY; box.line.fill.background()
tf = box.text_frame; tf.word_wrap = True
p = tf.paragraphs[0]; p.alignment = PP_ALIGN.CENTER
r = p.add_run()
r.text = "Merci de votre attention — nous répondons à vos questions"
r.font.size = Pt(20); r.font.bold = True; r.font.color.rgb = WHITE
notes(s, "Conclusion en écho à la problématique : traçabilité, contrôle d'accès fin, "
         "bilinguisme. Terminer en remerciant le jury et inviter aux questions.")

# ------------------------------------------------------------- save -------
prs.save(OUT)
print("OK ->", OUT)
print("Slides:", len(prs.slides.slides if hasattr(prs.slides, 'slides') else prs.slides._sldIdLst))
