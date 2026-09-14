# -*- coding: utf-8 -*-
"""
Génère le Rapport de Stage (PFE) en PDF pour le projet Gestion Juridique.
Réalisé par : Ayoub AGROUKH & Ikrame OUDGHIRI

- Table des matières automatique (numéros de page réels, 2 passes) + signets PDF
- Chapitre 3 : fiches détaillées UC-01..UC-11 + diagrammes UML embarqués
- Annexe A : inventaire des endpoints API et permissions RBAC
- Annexe B : modèle physique EF Core (diagramme entité-association) + seed
"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, PageBreak,
    Table, TableStyle, KeepTogether, HRFlowable, Image, Preformatted
)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "Rapport_de_Stage_Gestion_Juridique.pdf")
ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rapport_assets")

# ---------------------------------------------------------------- styles ----
NAVY = colors.HexColor("#1F3864")
BLUE = colors.HexColor("#2E74B5")
GREY = colors.HexColor("#444444")
LIGHT = colors.HexColor("#DCE6F1")

st_body = ParagraphStyle("body", fontName="Times-Roman", fontSize=12, leading=17,
                         alignment=TA_JUSTIFY, spaceAfter=8)
st_body_indent = ParagraphStyle("bodyi", parent=st_body, firstLineIndent=24)
st_h1 = ParagraphStyle("H1", fontName="Times-Bold", fontSize=20, leading=25,
                       alignment=TA_CENTER, textColor=NAVY, spaceBefore=6, spaceAfter=14)
st_h2 = ParagraphStyle("H2", fontName="Times-Bold", fontSize=15, leading=19,
                       textColor=NAVY, spaceBefore=14, spaceAfter=8)
st_h3 = ParagraphStyle("H3", fontName="Times-Bold", fontSize=12.5, leading=16,
                       textColor=BLUE, spaceBefore=10, spaceAfter=6)
st_center = ParagraphStyle("center", parent=st_body, alignment=TA_CENTER)
st_center_b = ParagraphStyle("centerb", parent=st_center, fontName="Times-Bold")
st_small = ParagraphStyle("small", parent=st_body, fontSize=10.5, leading=14)
st_bullet = ParagraphStyle("bullet", parent=st_body, leftIndent=22, bulletIndent=8,
                           spaceAfter=4, alignment=TA_JUSTIFY)
st_toc_t = ParagraphStyle("tocT", fontName="Times-Roman", fontSize=10.5, leading=13.5)
st_toc_p = ParagraphStyle("tocP", fontName="Times-Roman", fontSize=10.5, leading=13.5,
                          alignment=2)  # right
st_cap = ParagraphStyle("cap", fontName="Times-Italic", fontSize=10, leading=13,
                        alignment=TA_CENTER, textColor=GREY, spaceBefore=4, spaceAfter=10)
st_tbl = ParagraphStyle("tbl", fontName="Times-Roman", fontSize=10, leading=13)
st_tbl_b = ParagraphStyle("tblb", fontName="Times-Bold", fontSize=10, leading=13)
st_tbl_sm = ParagraphStyle("tblsm", fontName="Times-Roman", fontSize=8.2, leading=10.5)
st_tbl_smb = ParagraphStyle("tblsmb", fontName="Times-Bold", fontSize=8.2, leading=10.5)

E = []
TOC_DATA = []  # filled during pass 1: (level, text, page)


def P(txt, style=st_body):
    E.append(Paragraph(txt, style))


def SP(h=10):
    E.append(Spacer(1, h))


def PB():
    E.append(PageBreak())


def BUL(txt):
    E.append(Paragraph(txt, st_bullet, bulletText="•"))


def TITLE(txt):
    E.append(HRFlowable(width="100%", thickness=1, color=NAVY, spaceBefore=2, spaceAfter=2))
    E.append(Paragraph(txt, st_h1))
    E.append(HRFlowable(width="100%", thickness=1, color=NAVY, spaceAfter=10))


def FIG(name, caption, width=16.0 * cm):
    path = os.path.join(ASSETS, name)
    iw, ih = ImageReader(path).getSize()
    w = min(width, 16.4 * cm)
    h = w * ih / iw
    E.append(Image(path, width=w, height=h))
    E.append(Paragraph(caption, st_cap))


def TABLECAP(txt):
    """Légende numérotée placée au-dessus d'un tableau."""
    E.append(Paragraph(txt, st_cap))


st_capc = ParagraphStyle("capc", parent=st_cap, alignment=TA_CENTER)


def SHOT(num, desc):
    """Cadre de substitution soigné pour une capture d'écran à insérer."""
    body = Paragraph(
        f"<b>[ Emplacement — Figure {num} ]</b><br/><br/>{desc}<br/><br/>"
        f"<font size=8>Remplacer ce cadre par la capture d'écran correspondante "
        f"avant impression.</font>", st_capc)
    t = Table([[body]], colWidths=[13.5 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F4F7FC")),
        ("BOX", (0, 0), (-1, -1), 0.8, BLUE, None, (2, 2)),
        ("TOPPADDING", (0, 0), (-1, -1), 16),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 16),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
    ]))
    E.append(Spacer(1, 4))
    E.append(t)
    E.append(Spacer(1, 4))


def H1(txt):
    """Titre de niveau 1 (chapitre) — enregistré dans la TOC/bookmarks."""
    E.append(Paragraph(txt, st_h1))


def H2(txt):
    E.append(Paragraph(txt, st_h2))


def H3(txt):
    E.append(Paragraph(txt, st_h3))


st_code = ParagraphStyle("code", fontName="Courier", fontSize=7.8, leading=10.6,
                         textColor=colors.HexColor("#222222"))


def CODE(txt):
    """Bloc de code (extrait source) encadré sur fond clair."""
    body = Preformatted(txt, st_code)
    t = Table([[body]], colWidths=[16.1 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.grey),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    E.append(t)


def UC_SHEET(num, titre, acteur, pre, steps, alt, post):
    steps_html = "<br/>".join(f"<b>{i + 1}.</b> {s}" for i, s in enumerate(steps))
    rows = [
        [Paragraph("Cas d'utilisation", st_tbl_b),
         Paragraph(f"<b>UC-{num} : {titre}</b>", st_tbl_b)],
        [Paragraph("Acteur principal", st_tbl_b), Paragraph(acteur, st_tbl)],
        [Paragraph("Pré-condition", st_tbl_b), Paragraph(pre, st_tbl)],
        [Paragraph("Scénario nominal", st_tbl_b), Paragraph(steps_html, st_tbl)],
        [Paragraph("Alternatives", st_tbl_b), Paragraph(alt, st_tbl)],
        [Paragraph("Post-condition", st_tbl_b), Paragraph(post, st_tbl)],
    ]
    t = Table(rows, colWidths=[3.6 * cm, 13.1 * cm])
    t.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    E.append(KeepTogether([t, Spacer(1, 10)]))


def DATA_TABLE(header, rows, widths, style=st_tbl, style_b=st_tbl_b):
    data = [[Paragraph(h, style_b) for h in header]]
    for r in rows:
        data.append([Paragraph(c, style) if isinstance(c, str) else c for c in r])
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    E.append(t)


# ---------------------------------------------------------- document class ---
class RapportDoc(BaseDocTemplate):
    """Two-pass doc: pass 1 collects TOC entries; both passes add PDF outline."""

    def __init__(self, fn, **kw):
        super().__init__(fn, pagesize=A4, leftMargin=2.2 * cm, rightMargin=2.2 * cm,
                         topMargin=2 * cm, bottomMargin=2 * cm, **kw)
        f = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id="f")
        self.addPageTemplates([PageTemplate(id="all", frames=[f], onPage=self._deco)])
        self._toc_entries = []
        self._k = 0

    def _deco(self, canv, doc):
        canv.saveState()
        canv.setFillColor(NAVY)
        canv.rect(0, A4[1] - 1.1 * cm, A4[0], 1.1 * cm, stroke=0, fill=1)
        canv.setFillColor(colors.white)
        canv.setFont("Times-Bold", 9)
        canv.drawString(2.2 * cm, A4[1] - 0.72 * cm,
                        "Rapport de Stage — Application de Gestion des Dossiers Judiciaires")
        canv.drawRightString(A4[0] - 2.2 * cm, A4[1] - 0.72 * cm,
                             "Ayoub AGROUKH  &  Ikrame OUDGHIRI")
        canv.setStrokeColor(NAVY)
        canv.setLineWidth(0.7)
        canv.line(2.2 * cm, 1.5 * cm, A4[0] - 2.2 * cm, 1.5 * cm)
        canv.setFillColor(GREY)
        canv.setFont("Times-Roman", 9)
        canv.drawCentredString(A4[0] / 2, 1.05 * cm, f"{doc.page}")
        canv.restoreState()

    def afterFlowable(self, fl):
        if isinstance(fl, Paragraph) and fl.style.name in ("H1", "H2", "H3"):
            level = {"H1": 0, "H2": 1, "H3": 2}[fl.style.name]
            text = fl.getPlainText()
            self._toc_entries.append((level, text, self.page))
            self._k += 1
            key = f"sec{self._k}"
            self.canv.bookmarkPage(key)
            try:
                self.canv.addOutlineEntry(text, key, level=level, closed=(level >= 1))
            except Exception:
                pass


# ------------------------------------------------------------ page de garde --
def build_story():
    E.clear()
    E.append(Spacer(1, 0.4 * cm))
    P("[Logo Établissement]", st_center)
    SP(6)
    P("<b>[Nom de l'Établissement]</b>", ParagraphStyle("x", parent=st_center_b, fontSize=14))
    P("[Filière]", st_center)
    SP(14)
    P("<b>Projet de Fin d'Études</b>", ParagraphStyle("x", parent=st_center_b, fontSize=16, textColor=NAVY))
    P("Lieu de stage : la Cour d'Appel Administrative", st_center)
    SP(16)
    TITLE("Développement d'une application de gestion des échanges de documents "
          "et de dossiers entre les différents services du tribunal")
    P("Application web full-stack : Next.js 16 (React 19) / ASP.NET Core 10 / SQL Server — "
      "avec système de permissions RBAC et interface bilingue Français / Arabe (RTL).", st_center)
    SP(18)

    t = Table([
        [Paragraph("<b>Réalisé par :</b>", st_tbl_b), Paragraph("<b>Encadré par :</b>", st_tbl_b)],
        [Paragraph("Ayoub AGROUKH<br/>Ikrame OUDGHIRI", st_tbl),
         Paragraph("Pr. [Nom de l'encadrant académique]<br/>M. [Nom de l'encadrant tribunal]", st_tbl)],
    ], colWidths=[8.2 * cm, 8.2 * cm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.6, LIGHT),
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    E.append(t)
    SP(20)
    P("<b>Soutenu devant le jury composé de :</b>", st_center)
    SP(4)
    P("Pr. [Membre du jury 1]        Pr. [Membre du jury 2]        Pr. [Membre du jury 3]", st_center)
    SP(16)
    P("<b>Année Universitaire : 2025 / 2026</b>", ParagraphStyle("x", parent=st_center_b, fontSize=13))
    PB()

    # ------------------------------------------------------------ remerciements
    E.append(Paragraph("Remerciements", st_h1))
    P("Nous tenons à exprimer notre profonde gratitude à notre établissement, qui nous a "
      "permis d'acquérir les connaissances et les compétences nécessaires en informatique "
      "pour la réalisation de ce projet. Nous remercions chaleureusement l'ensemble des "
      "professeurs ainsi que tout le personnel administratif pour leur accompagnement et "
      "leur disponibilité. Leurs enseignements et leurs précieux conseils nous ont donné "
      "l'opportunité de mettre en pratique ce que nous avons appris en classe dans le cadre "
      "d'un projet concret.", st_body_indent)
    P("Nous remercions sincèrement la Cour d'Appel Administrative de nous avoir accueillis "
      "en stage. Tout le personnel a été très accueillant et a bien voulu nous aider à "
      "comprendre le fonctionnement concret des services du tribunal : le bureau d'ordre, "
      "l'ouverture des dossiers, le secrétariat particulier, les séances, la délivrance des "
      "copies et les archives. Cette immersion nous a permis de cerner les vrais besoins des "
      "agents et de concevoir une application qui reflète leur manière de travailler. "
      "C'était une expérience très enrichissante pour nous.", st_body_indent)
    P("Nous tenons à exprimer notre gratitude envers notre encadrant académique, "
      "<b>Pr. [Nom de l'encadrant]</b>, pour son engagement et sa coordination efficace tout "
      "au long de ce projet. Ses conseils éclairés, sa disponibilité et son accompagnement "
      "ont largement contribué à l'orientation de ce travail.", st_body_indent)
    P("Enfin, nous remercions du fond du cœur notre encadrant au sein du tribunal, "
      "<b>M. [Nom de l'encadrant tribunal]</b>. Il a toujours été disponible pour nous, ses "
      "conseils nous ont beaucoup aidé à organiser notre travail, à trouver des solutions "
      "adaptées aux contraintes réelles du terrain et à avancer sereinement dans le "
      "développement de l'application.", st_body_indent)
    PB()

    # ------------------------------------------------------- table des matières
    E.append(Paragraph("Table des matières", st_h1))
    if not TOC_DATA:
        # pass 1 : placeholders (même nombre de lignes que la passe 2)
        E.append(Paragraph("(générée automatiquement à la seconde passe)", st_cap))
    else:
        for level, text, page in TOC_DATA:
            left = Paragraph(
                text,
                ParagraphStyle(f"tt{level}", parent=st_toc_t,
                               leftIndent={0: 0, 1: 14, 2: 30}[level],
                               fontName="Times-Bold" if level == 0 else "Times-Roman",
                               fontSize=11 if level == 0 else 10.5,
                               textColor=NAVY if level == 0 else colors.black))
            right = Paragraph(str(page), st_toc_p)
            row = Table([[left, right]], colWidths=[15.6 * cm, 1.1 * cm])
            row.setStyle(TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.HexColor("#CCD6EA")),
                ("TOPPADDING", (0, 0), (-1, -1), 1.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
            ]))
            E.append(row)
    PB()

    # --------------------------------------------------------- liste des figures
    E.append(Paragraph("Liste des figures", st_h1))
    figs = [
        "Figure 1 : Circuit d'un dossier judiciaire dans le tribunal (workflow en 6 étapes)",
        "Figure 2 : Architecture générale de l'application (3 tiers)",
        "Figure 3 : Diagramme de cas d'utilisation — Administrateur",
        "Figure 4 : Diagramme de cas d'utilisation — Agent de service (Bureau d'ordre)",
        "Figure 5 : Diagramme de cas d'utilisation — Service Archives",
        "Figure 6 : Diagramme de classes — Modèle de données RBAC et documents",
        "Figure 7 : Diagramme de séquence — Authentification (JWT)",
        "Figure 8 : Diagramme de séquence — Transfert d'un document",
        "Figure 9 : Diagramme d'activité — Workflow Bureau d'ordre → Archives",
        "Figure 10 : Page d'authentification (bilingue FR/AR) [capture à insérer]",
        "Figure 11 : Tableau de bord — statistiques, activité récente, charge par service [capture]",
        "Figure 12 : Formulaire de création d'un courrier administratif [capture]",
        "Figure 13 : Formulaire de création d'un dossier juridique [capture]",
        "Figure 14 : Tableau de registre des documents [capture]",
        "Figure 15 : Espace de travail (Workspace) — informations, notes, historique [capture]",
        "Figure 16 : Modale de transfert avec sélection multi-utilisateurs [capture]",
        "Figure 17 : Page des notifications (accepter / refuser) [capture]",
        "Figure 18 : Registre des transactions [capture]",
        "Figure 19 : Gestion des utilisateurs [capture]",
        "Figure 20 : Gestion des services avec archives (soft-delete) [capture]",
        "Figure 21 : Gestion des permissions (matrice RBAC) [capture]",
        "Figure 22 : Gestion des équipements [capture]",
        "Figure 23 : Recherche avancée de dossiers [capture]",
        "Figure 24 : Corbeille et restauration des documents [capture]",
        "Figure 25 : Interface arabe (mode RTL) et thème sombre [capture]",
        "Figure B.1 : Diagramme Entité-Association EF Core avec cardinalités",
    ]
    for f in figs:
        E.append(Paragraph(f, st_toc_t))
    PB()

    # ------------------------------------------------------- liste des tableaux
    E.append(Paragraph("Liste des tableaux", st_h1))
    tabs = [
        "Tableau 1.1 : Architecture technique de l'application (3 tiers)",
        "Tableau 2.1 : Analyse critique — technologies retenues et alternatives",
        "Tableau 4.1 : Synthèse des suites de tests",
        "Tableau A.1 : Endpoints de l'API et permissions requises (par contrôleur)",
        "Tableau A.2 : Clés de permissions RBAC (18 permissions dynamiques)",
        "Tableau B.1 : Comptes de démonstration créés par le SeederService",
    ]
    for t in tabs:
        E.append(Paragraph(t, st_toc_t))
    PB()

    # ------------------------------------------------------------ glossaire ----
    E.append(Paragraph("Glossaire des abréviations", st_h1))
    glossaire = [
        ("API", "Application Programming Interface — interface de programmation exposée par le backend"),
        ("ACL", "Access Control List — liste de contrôle d'accès par service sur un document"),
        ("BCrypt", "Algorithme de hachage de mots de passe à sel intégré et coût paramétrable"),
        ("Corbeille", "Zone des documents supprimés logiquement, restaurables par un utilisateur autorisé"),
        ("CRUD", "Create, Read, Update, Delete — les quatre opérations élémentaires sur une donnée"),
        ("EF Core", "Entity Framework Core — ORM (mapping objet-relationnel) de l'écosystème .NET"),
        ("E2E", "End-to-End — test de bout en bout simulant un utilisateur réel"),
        ("JWT", "Json Web Token — jeton signé portant l'identité de l'utilisateur, validé à chaque requête"),
        ("LINQ", "Language Integrated Query — requêtes typées écrites en C# et traduites en SQL par EF"),
        ("OpenAPI", "Spécification standard décrivant les endpoints d'une API REST"),
        ("PFE", "Projet de Fin d'Études"),
        ("RBAC", "Role-Based Access Control — contrôle d'accès par rôles/permissions"),
        ("REST", "Representational State Transfer — style d'architecture des API web"),
        ("RTL", "Right-To-Left — direction droite-à-gauche de l'interface en arabe"),
        ("SPA", "Single Page Application — application web à page unique"),
        ("TPC", "Table Per Concrete class — stratégie d'héritage EF : une table par classe concrète"),
        ("UML", "Unified Modeling Language — langage de modélisation graphique"),
        ("xUnit", "Cadre de tests unitaires pour .NET"),
    ]
    g_rows = [[Paragraph("<b>Abréviation</b>", st_tbl_b), Paragraph("<b>Signification</b>", st_tbl_b)]]
    for ab, sig in glossaire:
        g_rows.append([Paragraph(ab, st_tbl), Paragraph(sig, st_tbl)])
    gt = Table(g_rows, colWidths=[3.2 * cm, 13.5 * cm])
    gt.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    E.append(gt)
    PB()

    # ------------------------------------------------------------------ abstract
    E.append(Paragraph("Abstract", st_h1))
    P("This report presents the design and implementation of a full-stack web application "
      "for managing judicial files and correspondence, developed during an internship at "
      "the Administrative Court of Appeal (Cour d'Appel Administrative). The main objective "
      "of the project is to digitise and streamline the circulation of administrative and "
      "judicial documents between the court's various departments — registry office "
      "(bureau d'ordre), case opening, private secretariat, hearings, copy delivery and "
      "archives — while ensuring full traceability, secure access control and real-time "
      "tracking of file movements. The project originated from a concrete need observed "
      "during the internship: the traditional paper-based circulation of files was slow, "
      "lacked transparency, and made it difficult to know who held a given file at any "
      "moment.", st_body_indent)
    P("Based on a detailed analysis of the existing workflow, a set of functional "
      "requirements was defined: user authentication with service-level role-based access "
      "control (RBAC), creation of administrative, judicial and outgoing correspondence, "
      "transfer of documents between services with single or multi-user assignment, "
      "acceptance or refusal of transfers with mandatory refusal reasons, withdrawal "
      "management for the archives department, Excel/Word import-export, and comprehensive "
      "audit trails. The system was implemented with a Next.js 16 (React 19) frontend "
      "written in TypeScript, an ASP.NET Core 10 Web API backend with Entity Framework "
      "Core, and a SQL Server database. Security relies on JWT authentication, BCrypt "
      "password hashing and a dynamic permission middleware enforcing granular permissions "
      "at both API and UI level. The application provides a bilingual French/Arabic "
      "interface with full RTL support. Quality was ensured through 103 xUnit unit tests, "
      "62 Cypress end-to-end tests and an automated 46-check permission audit. The "
      "resulting application is currently used as a complete replacement of the manual "
      "paper workflow within the court's services.", st_body_indent)
    SP(6)
    P("<b>Keywords :</b> document management, court, RBAC, dynamic permissions, Next.js, "
      "React, ASP.NET Core, Entity Framework Core, SQL Server, JWT, Cypress, "
      "traceability, workflow.", st_small)
    PB()

    # -------------------------------------------------------------------- résumé
    E.append(Paragraph("Résumé", st_h1))
    P("Ce rapport présente la conception et la réalisation d'une application web full-stack "
      "de gestion des dossiers judiciaires et des courriers, développée dans le cadre d'un "
      "stage à la Cour d'Appel Administrative. L'objectif principal du projet est de "
      "numériser et de fluidifier la circulation des documents administratifs et judiciaires "
      "entre les différents services du tribunal — bureau d'ordre, ouverture des dossiers, "
      "secrétariat particulier, séances et audiences, délivrance des copies et archives — "
      "tout en garantissant une traçabilité complète, un contrôle d'accès sécurisé et un "
      "suivi en temps réel des mouvements des fichiers.", st_body_indent)
    P("Le système a été développé avec un frontend Next.js 16 (React 19) en TypeScript, un "
      "backend ASP.NET Core 10 avec Entity Framework Core, et une base de données SQL "
      "Server. La sécurité repose sur l'authentification JWT, le hachage BCrypt et un "
      "middleware de permissions dynamiques appliquant des permissions granulaires à la "
      "fois au niveau de l'API et de l'interface. L'application offre une interface "
      "bilingue français/arabe avec support RTL complet. La qualité a été assurée par 103 "
      "tests unitaires xUnit, 62 tests end-to-end Cypress et un audit automatique des "
      "permissions comportant 46 vérifications.", st_body_indent)
    SP(6)
    P("<b>Mots-clés :</b> gestion documentaire, tribunal, RBAC, permissions dynamiques, "
      "Next.js, React, ASP.NET Core, Entity Framework Core, SQL Server, JWT, Cypress, "
      "traçabilité, workflow.", st_small)
    PB()

    # -------------------------------------------------------------- introduction
    E.append(Paragraph("Introduction générale", st_h1))
    P("Dans le cadre de l'évolution numérique des administrations publiques, la gestion "
      "efficace des dossiers judiciaires constitue un enjeu majeur. Au sein d'un tribunal, "
      "les dossiers sont encore, pour une large part, traités de manière manuelle, ce qui "
      "entraîne des problèmes de traçabilité, des pertes d'informations, une lenteur dans "
      "les échanges et des erreurs humaines. Chaque jour, des centaines de dossiers "
      "transitent entre différents services — le bureau d'ordre enregistre les courriers "
      "entrants, le service d'ouverture des dossiers leur attribue un numéro, le "
      "secrétariat particulier les prépare pour les audiences, la section des séances "
      "organise les passages devant le tribunal, et enfin la délivrance des copies puis les "
      "archives clôturent le cycle de vie du dossier. Or, en l'absence d'un système "
      "centralisé, il devient difficile de répondre à des questions simples comme : « Où se "
      "trouve le dossier ? », « Qui l'a traité en dernier ? » ou encore « Quel chemin a-t-il "
      "parcouru depuis son arrivée ? ».", st_body_indent)
    P("Face à ce constat, le projet de stage que nous avons réalisé a pour objectif de "
      "numériser l'intégralité du processus de circulation des dossiers entre les services "
      "du tribunal, à travers une application web moderne. Cette application permet à tout "
      "utilisateur autorisé de créer, transférer, consulter et archiver des documents, de "
      "suivre en temps réel leur position actuelle et leur historique complet, et de "
      "recevoir des notifications lorsqu'un document lui est envoyé ou doit être retourné.", st_body_indent)
    P("L'application repose sur une architecture web à trois tiers : un frontend Next.js "
      "16 (React 19) en TypeScript offrant une interface bilingue français/arabe, un "
      "backend ASP.NET Core 10 exposant une API REST sécurisée par JWT, et une base de "
      "données SQL Server gérée par Entity Framework Core. Un point fort du projet est son "
      "système de permissions RBAC dynamique : des permissions granulaires configurables "
      "par service contrôlent à la fois l'accès aux API (réponses 403 côté serveur) et la "
      "visibilité des éléments d'interface (masquage complet côté client).", st_body_indent)
    P("Le présent rapport décrit ce travail en quatre chapitres, complétés par deux "
      "annexes. Le premier chapitre présente le cadre du projet : l'établissement "
      "d'accueil, la problématique observée sur le terrain et la solution proposée. Le "
      "deuxième chapitre détaille les outils et technologies utilisés. Le troisième "
      "chapitre expose la conception du système à travers les diagrammes UML (cas "
      "d'utilisation, classes, séquence, activité) et la description textuelle détaillée "
      "des cas d'utilisation. Le quatrième chapitre présente les interfaces réalisées "
      "ainsi que les démarches de tests et de validation. L'annexe A recense "
      "l'inventaire complet des endpoints de l'API et de leurs permissions, et l'annexe B "
      "documente le modèle physique de données EF Core.", st_body_indent)
    PB()

    # =========================================================== CHAPITRE 1 =====
    E.append(Paragraph("Chapitre 1 : Présentation du cadre du projet", st_h1))
    E.append(Paragraph("1. Introduction", st_h2))
    P("Ce premier chapitre situe le projet dans son contexte. Nous présentons d'abord "
      "l'établissement d'accueil — la Cour d'Appel Administrative — son organisation en "
      "services et le déroulement du stage. Nous exposons ensuite la problématique "
      "concrète observée dans la gestion quotidienne des dossiers, puis nous formalisons "
      "la spécification des besoins fonctionnels et non fonctionnels, avant de décrire la "
      "solution que nous proposons : une application web de gestion et de suivi des "
      "documents judiciaires, avec ses objectifs, ses fonctionnalités clés et son "
      "architecture technique. Le chapitre se termine par la démarche méthodologique "
      "suivie et l'organisation du travail en binôme.")

    E.append(Paragraph("2. Présentation de l'établissement d'accueil", st_h2))
    P("Le stage s'est déroulé au sein de la <b>Cour d'Appel Administrative</b>, juridiction "
      "chargée de juger les recours formés contre les décisions des administrations "
      "publiques. L'établissement est organisé en plusieurs services complémentaires qui "
      "se succèdent dans le traitement d'un dossier judiciaire :")
    BUL("<b>Bureau d'ordre et bureau administratif</b> : point d'entrée de tous les "
        "courriers entrants, enregistrement et numérotation.")
    BUL("<b>Bureau de gestion des dossiers judiciaires (ouverture des dossiers)</b> : "
        "création des dossiers judiciaires, attribution du numéro de dossier et du circuit "
        "de traitement (circuit classique ou exceptionnel).")
    BUL("<b>Secrétariat particulier (Kitaba Khasa)</b> : préparation des dossiers pour les "
        "audiences, gestion du conseiller rapporteur et des dates d'audience.")
    BUL("<b>Séances et audiences (Jalsat Wa Ijra2at)</b> : traitement des transactions "
        "d'audience — enquête et recherche, commissaire du roi, expertise judiciaire, "
        "conseiller rapporteur.")
    BUL("<b>Délivrance des copies (Taslim Nusakh)</b> : signification (tabligh), règlement "
        "des dépens (tasfiyat sawa2ir) et remise des copies des jugements.")
    BUL("<b>Archives</b> : archivage définitif des dossiers clôturés et gestion des retraits "
        "de dossiers (avec autorité habilitée : chef du greffe, conseiller rapporteur, "
        "premier président).")
    BUL("<b>Services transversaux</b> : cellule informatique, gestion financière, caisse du "
        "tribunal, recouvrement, bureau de notification, pourvois en cassation, greffe et "
        "direction.")
    P("Cette organisation a directement inspiré la modélisation de l'application : chaque "
      "service du tribunal correspond à un <b>service RBAC</b> dans le système, avec ses "
      "propres utilisateurs et son propre jeu de permissions. Le circuit d'un dossier "
      "suit six étapes : Bureau d'ordre → Ouverture des dossiers → Secrétariat particulier "
      "→ Séances & audiences → Délivrance & clôture → Archivage définitif.")
    FIG("fig01_workflow.png",
        "Figure 1 : Circuit d'un dossier judiciaire — workflow en 6 étapes", 17.0 * cm)

    E.append(Paragraph("3. Problématique", st_h2))
    P("L'observation du travail quotidien des agents nous a permis d'identifier plusieurs "
      "difficultés majeures dans la gestion papier des dossiers :")
    BUL("<b>Traçabilité insuffisante</b> : il est difficile de savoir où se trouve un "
        "dossier à un instant donné, qui l'a traité en dernier et par quels services il est "
        "passé. La recherche d'un dossier égaré peut prendre plusieurs heures.")
    BUL("<b>Lenteur des échanges</b> : le transfert physique d'un dossier d'un service à "
        "l'autre est lent, et l'agent expéditeur n'a aucun moyen de savoir si le destinataire "
        "a bien reçu et accepté le dossier.")
    BUL("<b>Pas d'historique fiable</b> : les mouvements sont consignés dans des registres "
        "papier manuels, sans possibilité de consultation rapide ni de statistiques.")
    BUL("<b>Aucun contrôle d'accès</b> : tout agent ayant physiquement accès aux registres "
        "peut consulter ou modifier des informations qui ne le concernent pas ; aucune "
        "distinction fine des droits entre services n'est possible sur papier.")
    BUL("<b>Perte de temps sur les tâches répétitives</b> : copier les informations d'un "
        "courrier dans un registre, rédiger des avis de transfert, recalculer les retards… "
        "autant d'opérations manuelles sources d'erreurs.")
    BUL("<b>Bilinguisme difficile à maintenir</b> : les documents du tribunal sont rédigés "
        "en arabe et en français ; tenir deux jeux de registres cohérents est fastidieux.")

    E.append(Paragraph("4. Spécification des besoins", st_h2))
    P("L'analyse du fonctionnement actuel et les échanges avec les agents nous ont permis "
      "de formaliser les besoins sous deux catégories complémentaires.")
    E.append(Paragraph("4.1 Besoins fonctionnels", st_h3))
    BUL("<b>Authentification</b> : connexion par login/mot de passe, session sécurisée par "
        "jeton JWT, profil et permissions effectives renvoyés à l'application.")
    BUL("<b>Gestion des documents</b> : création, consultation, modification et archivage "
        "de trois familles de documents — courriers administratifs entrants, dossiers "
        "judiciaires, courriers sortants — avec pièces jointes.")
    BUL("<b>Transferts inter-services</b> : envoi à un service destinataire (un ou plusieurs "
        "utilisateurs), acceptation, ou refus avec motif obligatoire et retour à "
        "l'expéditeur.")
    BUL("<b>Notifications</b> : information en temps réel des destinataires et suivi des "
        "actions à traiter.")
    BUL("<b>Espace de travail</b> : par document — informations détaillées, notes "
        "internes, historique complet des mouvements, fichiers attachés.")
    BUL("<b>Suivi du workflow</b> : progression du dossier dans les six étapes du circuit, "
        "registre des transactions reconstituant la chaîne de responsabilité.")
    BUL("<b>Recherche et filtres</b> : recherche multicritère (référence, objet, dates, "
        "statut, service), corbeille avec restauration, retraits d'archives avec autorité "
        "habilitée.")
    BUL("<b>Import/Export</b> : registres exportables vers Excel et Word, import Excel de "
        "courriers existants.")
    BUL("<b>Administration</b> : gestion des utilisateurs (archivage/restauration), des "
        "services, de la matrice des permissions, des équipements et des listes "
        "dynamiques.")
    E.append(Paragraph("4.2 Besoins non fonctionnels", st_h3))
    BUL("<b>Sécurité</b> : mots de passe jamais stockés en clair (BCrypt), vérification "
        "systématique des permissions côté serveur sur chaque endpoint, réponses 403 "
        "documentées.")
    BUL("<b>Traçabilité</b> : aucune suppression destructive dans le circuit ; chaque "
        "action est horodatée et attribuable à un utilisateur.")
    BUL("<b>Fiabilité</b> : opérations de transfert atomiques (transaction SQL avec "
        "rollback), validation des données côté client et côté serveur.")
    BUL("<b>Ergonomie</b> : interface responsive, bilingue français/arabe avec support "
        "RTL complet, thème clair/sombre, retours visuels sur chaque action.")
    BUL("<b>Maintenabilité</b> : typage statique de bout en bout (TypeScript ↔ C#), "
        "séparation en couches, migrations de base versionnées.")
    BUL("<b>Extensibilité</b> : permissions et listes modifiables à chaud sans "
        "redéploiement ; ajout d'un service métier sans modification du code.")
    BUL("<b>Performance</b> : pagination et filtrage côté serveur pour les registres "
        "volumineux, temps de réponse interactif en usage local.")

    E.append(Paragraph("5. Solution proposée", st_h2))
    P("Pour répondre à ces besoins, nous avons conçu et développé une <b>application web "
      "full-stack de gestion des dossiers judiciaires</b> qui digitalise l'intégralité du "
      "circuit documentaire du tribunal. L'application permet l'enregistrement des courriers "
      "administratifs entrants, la création des dossiers judiciaires, la gestion du courrier "
      "sortant (normal et demandes/réclamations), le transfert électronique des documents "
      "entre services avec accusé de réception (acceptation ou refus motivé), le suivi "
      "d'avancement dans le workflow, la recherche multicritère, l'import/export Excel et "
      "Word, ainsi qu'un back-office d'administration complet (utilisateurs, services, "
      "permissions, équipements, listes dynamiques).")

    E.append(Paragraph("5.1 Objectifs stratégiques de l'application", st_h3))
    BUL("Centraliser tous les documents du tribunal dans une base de données unique et "
        "sécurisée.")
    BUL("Garantir la traçabilité totale : chaque création, modification, transfert, "
        "acceptation, refus ou archivage est horodaté et attribué à un utilisateur.")
    BUL("Rendre visible, à tout moment, la position exacte d'un dossier dans le circuit "
        "(workflow en 6 étapes avec pourcentage d'avancement).")
    BUL("Appliquer le principe du moindre privilège : chaque service ne voit et ne fait que "
        "ce que ses permissions lui autorisent (RBAC dynamique).")
    BUL("Accélérer les échanges : transfert instantané avec notification et accusé de "
        "réception (accepter/refuser avec motif).")
    BUL("Faciliter le reporting : tableau de bord avec statistiques, charge par service, "
        "activité récente, exports Excel et Word en un clic.")
    BUL("Servir les utilisateurs dans leur langue de travail : interface intégralement "
        "bilingue français/arabe avec mise en page RTL.")

    E.append(Paragraph("5.2 Fonctionnalités clés réalisées", st_h3))
    P("L'application livrée à l'issue du stage comprend notamment :")
    BUL("<b>Gestion documentaire complète</b> : courriers administratifs entrants, dossiers "
        "judiciaires (circuit classique ou exception : rectification d'erreur matérielle, "
        "assistance judiciaire, compétence du premier président), courrier sortant normal et "
        "demandes/réclamations.")
    BUL("<b>Circulation des documents</b> : transfert vers un service cible avec sélection "
        "d'un ou de plusieurs utilisateurs destinataires (création d'une transaction par "
        "destinataire), modes « transaction unique », « diffusion » (plusieurs services) et "
        "« archivage direct », option « doit revenir » pour les retours.")
    BUL("<b>Notifications et accusés de réception</b> : le service destinataire accepte ou "
        "refuse chaque transfert, avec motif obligatoire en cas de refus ; les documents à "
        "retourner sont signalés.")
    BUL("<b>Espace de travail (Workspace)</b> : fiche détaillée par document avec "
        "informations complètes, ajout de notes, chronologie des mouvements, historique des "
        "modifications et transfert direct depuis la fiche.")
    BUL("<b>Corbeille et archivage</b> : suppression logique (soft-delete) des documents "
        "avec restauration, archivage unitaire ou par lot, gestion des retraits de dossiers "
        "depuis les archives avec autorité habilitée.")
    BUL("<b>Recherche avancée</b> : recherche par référence, titre/objet, source, service ; "
        "filtres par statut, type et période.")
    BUL("<b>Import/Export</b> : export Excel et Word de tous les registres ; import Excel "
        "avec mappage interactif des colonnes et aperçu des données.")
    BUL("<b>Administration (RBAC)</b> : gestion des utilisateurs (création, modification, "
        "archivage, restauration, suppression définitive sécurisée), gestion des services "
        "RBAC (soft-delete avec restauration), gestion dynamique de la matrice des "
        "permissions, services historiques, gestion des équipements et des listes "
        "dynamiques (valeurs FR/AR).")
    BUL("<b>Expérience utilisateur</b> : tableau de bord analytique (statistiques circulaires, "
        "activité récente, charge par service), thème clair/sombre persistant, interface "
        "bilingue FR/AR avec support RTL complet, design responsive Tailwind CSS.")
    BUL("<b>Qualité</b> : 103 tests unitaires backend (xUnit), 62 tests end-to-end Cypress "
        "sur le frontend et un audit de permissions automatisé de 46 vérifications.")

    E.append(Paragraph("5.3 Architecture technique (synthèse)", st_h3))
    P("L'application suit une architecture web 3-tiers classique :")
    TABLECAP("Tableau 1.1 : Architecture technique de l'application (3 tiers)")
    archi = Table([
        [Paragraph("<b>Tier</b>", st_tbl_b), Paragraph("<b>Technologies</b>", st_tbl_b),
         Paragraph("<b>Rôle</b>", st_tbl_b)],
        [Paragraph("Présentation", st_tbl),
         Paragraph("Next.js 16, React 19, TypeScript, Tailwind CSS 4", st_tbl),
         Paragraph("SPA bilingue FR/AR, composants modulaires, hooks, contexte "
                   "(AuthContext, ThemeContext)", st_tbl)],
        [Paragraph("Métier / API", st_tbl),
         Paragraph("ASP.NET Core 10, C#, EF Core 10", st_tbl),
         Paragraph("API REST (22 contrôleurs), middleware JWT + permissions, services "
                   "métier (transferts, workspace, permissions, seeder)", st_tbl)],
        [Paragraph("Données", st_tbl),
         Paragraph("SQL Server (LocalDB), BCrypt.Net", st_tbl),
         Paragraph("18 tables EF Core (documents, transactions, RBAC…), migrations, "
                   "seed automatique", st_tbl)],
    ], colWidths=[3.2 * cm, 6.3 * cm, 7.2 * cm])
    archi.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    E.append(archi)
    SP(4)
    P("Flux d'une requête : Navigateur → Next.js (port 3000) → API ASP.NET (port 5200) → "
      "middleware d'authentification JWT → middleware de validation des permissions → "
      "contrôleur → service métier → EF Core → SQL Server.")
    FIG("fig02_architecture.png",
        "Figure 2 : Architecture générale de l'application (3 tiers)", 15.5 * cm)

    E.append(Paragraph("5.4 Bénéfices attendus pour l'institution", st_h3))
    BUL("Réduction drastique du temps de localisation d'un dossier (recherche instantanée "
        "au lieu d'une fouille manuelle des registres).")
    BUL("Fiabilisation des données : plus de doubles saisies, moins d'erreurs humaines.")
    BUL("Meilleure répartition de la charge de travail grâce au suivi du volume de dossiers "
        "par service.")
    BUL("Sécurité renforcée : authentification obligatoire, mots de passe hachés (BCrypt), "
        "permissions vérifiées côté serveur sur chaque endpoint.")
    BUL("Aide à la décision : statistiques en temps réel et exports pour les rapports "
        "hiérarchiques.")
    BUL("Préservation de l'historique : aucune suppression destructive des données du "
        "workflow, tout est archivable et restaurable.")

    E.append(Paragraph("6. Démarche méthodologique et organisation du travail", st_h2))
    P("Le projet a suivi une démarche inspirée du <b>cycle en V</b>, adaptée au calendrier "
      "du stage : chaque phase de conception a sa phase de validation correspondante. La "
      "spécification des besoins (§4) a été validée avec le maître de stage avant toute "
      "implémentation ; les diagrammes UML du chapitre 3 ont servi de contrat de "
      "développement ; chaque module livré a été confronté à ses tests (chapitre 4, §10) "
      "puis présenté aux agents pour recette fonctionnelle.")
    BUL("<b>Analyse de l'existant</b> : observation des services, entretiens avec les "
        "agents, relevé des irritants du circuit papier.")
    BUL("<b>Spécification</b> : rédaction des besoins fonctionnels et non fonctionnels, "
        "priorisation avec le maître de stage.")
    BUL("<b>Conception</b> : cas d'utilisation, modèle de données, scénarios de séquence "
        "— validés avant codage.")
    BUL("<b>Développement incrémental</b> : livraisons par module (authentification, "
        "documents, transferts, RBAC, imports, administration), chacune testée avant la "
        "suivante.")
    BUL("<b>Tests et recette</b> : suite xUnit en continu, scénarios Cypress sur "
        "l'application démarrée, audit des permissions, démonstration aux agents.")
    P("Le travail en binôme a été organisé autour d'un noyau commun — analyse, "
      "modélisation, choix d'architecture — suivi d'un développement parallèle par modules "
      "avec revue croisée du code avant chaque fusion. Cette organisation, rendue possible "
      "par le versionnage Git, a permis d'avancer rapidement tout en maintenant une "
      "qualité homogène : chaque ligne de code a été relue par l'autre membre du binôme.", st_body_indent)

    E.append(Paragraph("7. Conclusion", st_h2))
    P("Ce chapitre a présenté le cadre général du projet : la Cour d'Appel Administrative, "
      "son organisation en services et les difficultés concrètes liées à la gestion papier "
      "des dossiers. La spécification des besoins a formalisé les attentes des utilisateurs "
      "et les contraintes de qualité, et la solution proposée — une application web "
      "full-stack avec un système RBAC dynamique et une interface bilingue — répond point "
      "par point à la problématique identifiée. Le chapitre suivant détaille les outils et "
      "technologies qui ont permis de la réaliser.")
    PB()

    # =========================================================== CHAPITRE 2 =====
    E.append(Paragraph("Chapitre 2 : Les besoins logiciels et technologies", st_h1))
    E.append(Paragraph("1. Introduction", st_h2))
    P("Ce chapitre présente l'environnement du projet. Nous décrivons d'abord les outils "
      "utilisés au quotidien — développement, modélisation, versionnage, tests — puis les "
      "technologies constituant le socle de l'application. Pour chacune, nous précisons son "
      "rôle concret dans le projet et les raisons du choix, avant de les confronter aux "
      "alternatives envisagées (§3.7).")

    E.append(Paragraph("2. Outils utilisés", st_h2))
    E.append(Paragraph("2.1 Visual Studio 2022 et Visual Studio Code", st_h3))
    P("Le backend a été développé sous <b>Visual Studio 2022</b>, dont l'apport dépasse la "
      "simple édition de code : le débogueur intégré permet de poser des points d'arrêt "
      "dans les middlewares et les contrôleurs pour suivre, requête par requête, la "
      "résolution des permissions ; la console du Gestionnaire de package sert à générer "
      "et appliquer les migrations Entity Framework ; enfin l'explorateur de tests lance "
      "les 103 tests xUnit et affiche leurs résultats en temps réel. Le frontend a quant à "
      "lui été développé sous <b>Visual Studio Code</b>, dont le terminal intégré "
      "centralise le serveur de développement Next.js, l'exécution de Cypress et les "
      "opérations Git ; les extensions ESLint et Prettier garantissent un style de code "
      "homogène entre les deux membres du binôme.")

    E.append(Paragraph("2.2 Outils de modélisation UML (StarUML, Enterprise Architect)", st_h3))
    P("La conception s'est appuyée sur des outils de modélisation UML. La démarche a "
      "consisté à modéliser avant de coder : les diagrammes de cas d'utilisation ont "
      "d'abord fixé le périmètre fonctionnel avec le maître de stage, le diagramme de "
      "classes a servi de contrat pour les entités Entity Framework, et les diagrammes de "
      "séquence ont précisé les échanges frontend/API avant l'écriture des contrôleurs. "
      "Cette étape a évité des remaniements coûteux : les choix structurants (héritage des "
      "documents, table des transactions, matrice de permissions) n'ont pas été remis en "
      "cause pendant le développement. Les diagrammes présentés au chapitre 3 reprennent "
      "ce modèle.")
    P("Les diagrammes de ce chapitre présentent le modèle validé ; les captures d'écran "
      "des outils de modélisation ne sont pas reproduites ici, l'essentiel étant le "
      "résultat exploitable plutôt que l'outil.", st_cap)

    E.append(Paragraph("2.3 Git & GitHub (gestion de versions)", st_h3))
    P("Le code source est versionné avec <b>Git</b> et hébergé sur <b>GitHub</b>. Le "
      "travail en binôme — Ayoub AGROUKH et Ikrame OUDGHIRI — impose une discipline de "
      "partage : chaque fonctionnalité est développée sur une branche dédiée, puis "
      "fusionnée vers la branche principale après revue croisée du code, ce qui limite "
      "les risques de régression. Les commits réguliers offrent en outre une traçabilité "
      "des choix techniques : chaque évolution (ajout d'une permission, correction d'un "
      "workflow) reste datée et attribuable. Le dépôt regroupe le backend, le frontend, "
      "les scripts d'audit des permissions et la documentation (README, matrice des "
      "permissions). L'historique complet des contributions est consultable en ligne ; "
      "il peut être présenté en soutenance si le jury souhaite le parcours de "
      "développement.")

    E.append(Paragraph("2.4 Cypress (tests end-to-end)", st_h3))
    P("<b>Cypress 15</b> automatise les tests de bout en bout : il pilote un vrai "
      "navigateur, observe l'application exactement comme le ferait un utilisateur et "
      "vérifie le résultat visible à l'écran. Ce niveau de test complète les tests "
      "unitaires du backend : là où un test xUnit valide une règle métier isolée, un "
      "scénario Cypress valide une chaîne complète — formulaire saisi, requête HTTP "
      "émise, réponse traitée, interface mise à jour. Les 62 scénarios du projet couvrent "
      "la connexion, la création de documents, les transferts, la recherche, les exports "
      "et surtout le comportement dynamique des permissions : un bouton doit apparaître "
      "ou disparaître selon les droits réellement accordés à l'utilisateur connecté.")

    E.append(Paragraph("3. Technologies et langages", st_h2))
    P("La stack du projet est typée de bout en bout : TypeScript côté interface, C# côté "
      "serveur, et des schémas de données générés automatiquement entre les deux. Ce choix "
      "n'était pas anodin : chaque technologie a été retenue pour des raisons précises, "
      "détaillées ci-dessous, puis confrontée aux alternatives au §3.7.")

    E.append(Paragraph("3.1 TypeScript et Next.js 16 / React 19", st_h3))
    P("Le frontend est une <b>Single Page Application</b> développée en <b>TypeScript</b> "
      "avec <b>Next.js 16</b> (React 19) et le App Router. TypeScript est exploité à deux "
      "niveaux. D'une part, les types des données échangées avec l'API sont générés "
      "automatiquement depuis la spécification OpenAPI du backend (openapi-typescript) : "
      "toute évolution du contrat d'API provoque une erreur de compilation côté interface "
      "plutôt qu'un bug silencieux en production. D'autre part, les composants React "
      "eux-mêmes sont typés (props, états), ce qui rend les refactorings sûrs. L'état "
      "global d'authentification (token JWT en mémoire, profil, permissions effectives) "
      "est géré par un <b>AuthContext</b>, et l'apparence par un <b>ThemeContext</b> "
      "(thème clair/sombre persistant). Tous les appels HTTP passent par un client "
      "<font face='Courier'>api</font> centralisé qui pose l'URL de base, l'en-tête "
      "Authorization et la gestion uniforme des erreurs : un seul endroit à modifier si "
      "la politique de sécurité évolue.")

    E.append(Paragraph("3.2 C# avec ASP.NET Core 10", st_h3))
    P("Le backend est une <b>API REST</b> développée en <b>C#</b> avec <b>ASP.NET Core "
      "10</b>. Ses 22 contrôleurs couvrent l'authentification, les trois familles de "
      "documents, les transferts et transactions, les notifications, la gestion RBAC, les "
      "imports Excel, l'upload de fichiers, les équipements et les listes dynamiques. "
      "ASP.NET Core apporte trois garanties décisives pour un contexte judiciaire : un "
      "pipeline de middlewares où s'insèrent l'authentification JWT et notre contrôle "
      "d'accès personnalisé ; une injection de dépendances native qui découple les "
      "services (TransactionService, WorkspaceService, PermissionValidationService…) et "
      "les rend testables unitairement ; et un gestionnaire d'exceptions global qui "
      "renvoie des erreurs JSON homogènes sans jamais exposer la pile d'exécution au "
      "client. Le typage fort de C# écarte en outre une classe entière d'erreurs, "
      "détectées à la compilation plutôt qu'à l'exécution.")

    E.append(Paragraph("3.3 Entity Framework Core 10 et SQL Server", st_h3))
    P("L'accès aux données est assuré par <b>Entity Framework Core 10</b> en approche "
      "code-first : les entités C# (Document, CourrierAdministratif, CourrierSortant, "
      "DossierJuridique, ActionJuridique, Transaction, Utilisateur, ainsi que les tables "
      "RBAC : Service, Permission, ServicePermission, AdminPermissionOverride, "
      "HistoricalService, DocumentAccess…) font foi, et les migrations génèrent le schéma "
      "<b>SQL Server</b>. Deux avantages concrets : le modèle de données évolue avec le "
      "code sous contrôle de versions (une migration par évolution, rejouable sur toute "
      "installation) ; et les requêtes restent écrites en LINQ, vérifiées à la "
      "compilation, EF se chargeant de leur traduction SQL et de la protection contre "
      "l'injection par paramétrage automatique. Un service de seed crée au démarrage "
      "l'administrateur, les 9 services métier, les permissions, leur matrice "
      "d'affectation et des comptes de démonstration : un environnement de test complet "
      "en une seule exécution.")

    E.append(Paragraph("3.4 JWT et BCrypt (sécurité)", st_h3))
    P("L'authentification repose sur des <b>tokens JWT</b> : à la connexion, le serveur "
      "signe un token portant l'identité de l'utilisateur ; chaque requête suivante le "
      "présente dans l'en-tête Authorization et un middleware le valide (signature, "
      "expiration — avec un skew horaire nul, un token expiré est rejeté immédiatement). "
      "Cette architecture sans état convient particulièrement à une SPA : aucune session "
      "à maintenir côté serveur, et un mécanisme unique protège l'ensemble des 114 "
      "endpoints. Les mots de passe sont hachés avec <b>BCrypt.Net</b>, qui intègre un "
      "salt aléatoire par mot de passe et un coût de calcul volontairement lent : même en "
      "cas de fuite de la base, les mots de passe restent inexploitables par force brute. "
      "L'autorisation, décrite en détail au chapitre 3, s'appuie sur un attribut "
      "<font face='Courier'>[RequirePermission]</font> qui déclare la permission attendue "
      "par chaque endpoint, et sur un middleware qui la vérifie exclusivement côté "
      "serveur — jamais à partir d'une donnée fournie par le client.")

    E.append(Paragraph("3.5 Tailwind CSS 4", st_h3))
    P("Le style est réalisé avec <b>Tailwind CSS 4</b> : classes utilitaires composées "
      "directement dans le JSX, thème clair/sombre piloté par la classe "
      "<font face='Courier'>dark</font>, et support de l'arabe droite-à-gauche grâce aux "
      "propriétés logiques (text-start, ms/me) qui inversent automatiquement espacements "
      "et alignements selon la direction de la langue. L'intérêt face à une feuille de "
      "style classique : deux écrans utilisant les mêmes classes ont nécessairement le "
      "même rendu, et une évolution de la charte graphique se fait en modifiant la "
      "configuration plutôt que des centaines de règles CSS.")

    E.append(Paragraph("3.6 HTML / CSS", st_h3))
    P("HTML et CSS restent le socle du rendu web : structure sémantique des composants "
      "React (formulaires, tableaux, dialogues), et styles dédiés à l'impression des "
      "registres — un besoin réel du Bureau d'ordre, qui doit produire des registres "
      "papier conformes — ainsi qu'aux particularités typographiques de l'arabe.")

    E.append(Paragraph("3.7 Analyse critique : technologies retenues et alternatives", st_h3))
    P("Le tableau suivant justifie les choix structurants du projet face aux alternatives "
      "envisagées pendant l'étude de l'existant :")
    TABLECAP("Tableau 2.1 : Analyse critique — technologies retenues et alternatives")
    techrows = [
        [Paragraph("<b>Besoin</b>", st_tbl_b), Paragraph("<b>Choix retenu</b>", st_tbl_b),
         Paragraph("<b>Alternatives envisagées</b>", st_tbl_b), Paragraph("<b>Justification</b>", st_tbl_b)],
        [Paragraph("Framework frontend", st_tbl),
         Paragraph("Next.js 16 / React 19", st_tbl),
         Paragraph("Angular, Vue.js", st_tbl),
         Paragraph("Écosystème riche (tableaux, modales, i18n), TypeScript natif, App Router", st_tbl)],
        [Paragraph("Backend", st_tbl),
         Paragraph("ASP.NET Core 10 (C#)", st_tbl),
         Paragraph("Node.js/Express, Spring Boot", st_tbl),
         Paragraph("Typage fort, pipeline de middlewares, EF Core intégré, tests xUnit outillés", st_tbl)],
        [Paragraph("Base de données", st_tbl),
         Paragraph("SQL Server", st_tbl),
         Paragraph("PostgreSQL, MongoDB", st_tbl),
         Paragraph("Support EF Core de première classe, intégration Windows du tribunal, transactions fiables (rollback)", st_tbl)],
        [Paragraph("Accès aux données", st_tbl),
         Paragraph("EF Core (code-first)", st_tbl),
         Paragraph("Dapper, ADO.NET brut", st_tbl),
         Paragraph("Migrations versionnées, LINQ vérifié à la compilation, anti-injection par paramétrage", st_tbl)],
        [Paragraph("Authentification", st_tbl),
         Paragraph("JWT + BCrypt", st_tbl),
         Paragraph("Sessions cookies, ASP.NET Identity", st_tbl),
         Paragraph("Sans état, adapté à une SPA, vérification à chaque requête ; BCrypt résiste à la force brute", st_tbl)],
        [Paragraph("Contrôle d'accès", st_tbl),
         Paragraph("RBAC dynamique (matrice service × permission)", st_tbl),
         Paragraph("Rôles figés en base de code", st_tbl),
         Paragraph("Modifiable à chaud par l'administrateur sans redéploiement, overrides fins par permission", st_tbl)],
        [Paragraph("Tests E2E", st_tbl),
         Paragraph("Cypress 15", st_tbl),
         Paragraph("Selenium, Playwright", st_tbl),
         Paragraph("Exécution rapide, débogage visuel, assertions sur l'interface réelle", st_tbl)],
    ]
    techt = Table(techrows, colWidths=[2.9 * cm, 3.4 * cm, 4.1 * cm, 5.7 * cm])
    techt.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    E.append(techt)
    SP(6)
    P("Deux limites assumées méritent d'être signalées. D'abord, les permissions sont "
      "relues en base à chaque requête protégée : cela garantit l'application immédiate "
      "des changements (aucune révocation oubliée), au prix de quelques requêtes "
      "supplémentaires — un cache mémoire avec invalidation serait la piste d'optimisation "
      "naturelle si la charge augmentait. Ensuite, l'envoi des notifications est "
      "synchrone : un traitement en file d'arrière-plan (file de messages) deviendrait "
      "pertinent à plus grande échelle.")

    E.append(Paragraph("4. Conclusion", st_h2))
    P("L'environnement technique du projet combine des outils éprouvés (Visual Studio, "
      "Git, Cypress) et une pile web moderne : Next.js/React en TypeScript pour le "
      "frontend, ASP.NET Core avec EF Core et SQL Server pour le backend. Au-delà de la "
      "liste des outils, ce chapitre a montré que chaque choix répond à une contrainte "
      "précise — sûreté du typage pour prévenir les régressions, contrôle d'accès "
      "exclusivement serveur pour la confidentialité des dossiers, tests automatisés pour "
      "travailler à deux en confiance. Le chapitre suivant présente la conception "
      "détaillée du système.")
    PB()

    # =========================================================== CHAPITRE 3 =====
    E.append(Paragraph("Chapitre 3 : Conception du projet", st_h1))
    E.append(Paragraph("1. Introduction", st_h2))
    P("Ce chapitre présente la conception du système. Nous décrivons d'abord les acteurs et "
      "les diagrammes de cas d'utilisation, puis nous détaillons onze cas d'utilisation "
      "sous forme de fiches textuelles normalisées (acteur, pré-condition, scénario nominal "
      "pas à pas, alternatives, post-condition). Nous présentons ensuite le modèle de "
      "données (diagramme de classes), les scénarios dynamiques (diagrammes de séquence) et "
      "le workflow global (diagramme d'activité).")

    E.append(Paragraph("2. Diagramme de cas d'utilisation", st_h2))
    P("Le système compte quatre acteurs principaux :")
    BUL("<b>Administrateur</b> : gère les utilisateurs, les services, la matrice des "
        "permissions, les services historiques, les équipements et les listes dynamiques ; "
        "il dispose d'un calque d'override : 20 permissions lui sont désactivées par défaut "
        "pour l'empêcher d'effectuer des opérations métier courantes (séparation des "
        "responsabilités).")
    BUL("<b>Agent de service (Bureau d'ordre, Ouverture, Secrétariat, Séances, "
        "Délivrance…)</b> : crée ses documents (courrier administratif, dossier juridique, "
        "courrier sortant), transfère les documents vers le service suivant, accepte ou "
        "refuse les transferts reçus, consulte son espace de travail et exporte ses registres.")
    BUL("<b>Service Archives</b> : archive définitivement les dossiers clôturés, gère la "
        "corbeille, restaure les documents supprimés et traite les retraits de dossiers "
        "(avec autorité habilitée et motif).")
    BUL("<b>Utilisateur non authentifié</b> : accède uniquement à la page de connexion.")
    P("Les figures 3, 4 et 5 présentent les diagrammes de cas d'utilisation pour les trois "
      "acteurs authentifiés. Chaque cas d'utilisation métier inclut (relation "
      "«include») l'authentification préalable, et le transfert inclut la notification du "
      "destinataire.")
    FIG("fig03_uc_admin.png",
        "Figure 3 : Diagramme de cas d'utilisation — Administrateur", 15.5 * cm)
    FIG("fig04_uc_agent.png",
        "Figure 4 : Diagramme de cas d'utilisation — Agent de service", 15.5 * cm)
    FIG("fig05_uc_archive.png",
        "Figure 5 : Diagramme de cas d'utilisation — Service Archives", 14.5 * cm)

    E.append(Paragraph("3. Description textuelle des cas d'utilisation (fiches détaillées)", st_h2))
    P("Les fiches qui suivent décrivent, pour chaque cas d'utilisation majeur, l'acteur "
      "concerné, la permission RBAC requise, la pré-condition, le scénario nominal détaillé "
      "pas à pas (avec les endpoints API impliqués), les alternatives et la post-condition.")

    E.append(Paragraph("UC-01 — S'authentifier", st_h3))
    UC_SHEET(
        "01", "S'authentifier",
        "Tout utilisateur disposant d'un compte actif (agent de service ou administrateur).",
        "L'utilisateur dispose d'un compte actif créé par l'administrateur ; le backend est "
        "démarré et la base contient le compte (seed ou création manuelle).",
        [
            "L'utilisateur ouvre l'application : la page d'authentification s'affiche (bilingue FR/AR).",
            "Il saisit son login et son mot de passe puis clique sur « Se connecter ».",
            "Le frontend envoie <font face='Courier'>POST /api/Auth/login</font> avec les identifiants.",
            "Le backend recherche l'utilisateur et vérifie le mot de passe avec BCrypt.Verify().",
            "En cas de succès : émission d'un token JWT signé et chargement des permissions du service (via /api/auth/me).",
            "Le frontend stocke le token et les permissions dans AuthContext (en mémoire).",
            "Le tableau de bord s'affiche ; seuls les menus autorisés par les permissions sont visibles.",
        ],
        "<b>A1 — Identifiants invalides :</b> le backend renvoie 401 ; un message d'erreur "
        "bilingue est affiché, aucun token n'est émis.<br/>"
        "<b>A2 — Compte archivé :</b> la connexion est refusée (compte IsActive = false).<br/>"
        "<b>A3 — Token expiré :</b> toute requête ultérieure renvoie 401 et l'utilisateur "
        "est redirigé vers la page de connexion (skew horaire nul).",
        "L'utilisateur est authentifié ; son token JWT et ses permissions sont chargés en "
        "mémoire ; les éléments d'interface sont filtrés selon ses droits.")

    E.append(Paragraph("UC-02 — Créer un courrier administratif entrant", st_h3))
    UC_SHEET(
        "02", "Créer un courrier administratif entrant",
        "Agent du service habilité (ex. Bureau d'ordre) — permission "
        "<font face='Courier'>creer_courrier_admin</font>.",
        "L'agent est authentifié et sa permission de création est activée pour son service.",
        [
            "L'agent ouvre la vue « Courrier Administratif » puis le formulaire d'ajout (AdminForm).",
            "Il saisit : numéro d'ordre, numéro de référence, expéditeur, objet/sujet, dates d'arrivée et du message, année de numérotation.",
            "Il précise le type de circuit, le caractère transmissible et l'état du document.",
            "Il joint optionnellement un fichier (PDF/Word/Excel) via <font face='Courier'>POST /api/FileUpload</font>.",
            "Il valide : le frontend envoie <font face='Courier'>POST /api/CourrierAdmin</font>.",
            "Le backend vérifie l'unicité du numéro de bureau d'ordre, enregistre le document avec le statut « Nouveau » et le service actuel du créateur, puis journalise l'action.",
            "Le registre se rafraîchit et le nouveau courrier apparaît en tête de liste.",
        ],
        "<b>A1 — Numéro déjà existant :</b> le backend renvoie une erreur métier « Ce numéro "
        "d'ordre existe déjà » et aucune écriture n'est effectuée.<br/>"
        "<b>A2 — Données invalides :</b> les champs obligatoires manquants sont signalés côté "
        "formulaire.<br/>"
        "<b>A3 — Permission désactivée :</b> le middleware renvoie 403 et le bouton d'ajout "
        "est masqué dans l'interface.",
        "Le courrier administratif est enregistré, visible dans le registre et prêt à être "
        "transféré vers le service suivant.")

    E.append(Paragraph("UC-03 — Créer un dossier juridique", st_h3))
    UC_SHEET(
        "03", "Créer un dossier juridique",
        "Agent du service d'ouverture des dossiers — permission "
        "<font face='Courier'>creer_courrier_juridique</font>.",
        "L'agent est authentifié ; le courrier entrant (ou la demande) qui fonde le dossier "
        "est connu.",
        [
            "L'agent ouvre la vue « Dossier Juridique » et le formulaire (JuridiqueForm).",
            "Il saisit le numéro de bureau d'ordre, l'objet, le demandeur, le numéro de première instance et le dossier parent éventuel.",
            "Il choisit le circuit : « classique » (maktab_dabt ou kitaba_khasa) ou « exception » avec motif (islah / mousaada / ikhtissas).",
            "Il valide : <font face='Courier'>POST /api/CourrierJuridique</font> crée le dossier avec l'étape de séance initiale.",
            "Le système initialise le workflow du dossier (étape 1/6) et journalise une ActionJuridique d'enregistrement.",
            "L'agent peut ensuite attribuer le numéro de dossier Cour d'Appel puis transférer au service suivant.",
        ],
        "<b>A1 — Référence dupliquée :</b> erreur métier, création refusée.<br/>"
        "<b>A2 — Circuit exceptionnel :</b> le motif d'exception devient obligatoire et est "
        "conservé dans le dossier (MotifException).",
        "Le dossier juridique existe avec son circuit de traitement ; il est localisable "
        "dans le workflow et traçable via ses actions.")

    E.append(Paragraph("UC-04 — Créer un courrier sortant", st_h3))
    UC_SHEET(
        "04", "Créer un courrier sortant",
        "Agent habilité — permission <font face='Courier'>creer_modifier</font> (CourrierSortantController).",
        "L'agent est authentifié et son service dispose de la permission de création du sortant.",
        [
            "L'agent ouvre la vue « Courrier Sortant » (normal ou demandes/réclamations) et le formulaire (SortantForm).",
            "Il saisit le destinataire externe, le sujet, le tribunal d'origine et le tribunal de destination.",
            "Il renseigne la date et le numéro d'envoi ; le courrier est créé au statut « Brouillon ».",
            "Le statut évolue ensuite manuellement : « En attente d'envoi » → « Envoyé », ou « Annulé ».",
            "Chaque transition met à jour le registre des sortants (SortantTable) avec filtres par statut.",
        ],
        "<b>A1 — Type non renseigné :</b> le type (normal / demande) est obligatoire à "
        "l'enregistrement.<br/>"
        "<b>A2 — Annulation :</b> le courrier passe au statut « Annulé » et reste traçable "
        "(pas de suppression physique).",
        "Le courrier sortant est enregistré dans le registre avec son cycle de statuts ; il "
        "peut être exporté ou transféré selon les permissions.")

    E.append(Paragraph("UC-05 — Transférer un document", st_h3))
    UC_SHEET(
        "05", "Transférer un document",
        "Agent du service détenteur du document — permissions "
        "<font face='Courier'>transferer</font> ou <font face='Courier'>transferer_juridique</font>.",
        "Le document existe, son service actuel est celui de l'agent, et la permission de "
        "transfert est activée.",
        [
            "Depuis le registre ou l'espace de travail, l'agent clique sur « Transférer » (TransferModal).",
            "Il choisit le service destinataire parmi les services RBAC actifs.",
            "Il coche un ou plusieurs utilisateurs destinataires (une transaction sera créée par destinataire).",
            "Il sélectionne le mode de traitement : transaction unique, diffusion (plusieurs services) ou archivage direct.",
            "Il active optionnellement « doit revenir » (le document devra être retourné à l'expéditeur) et saisit un commentaire.",
            "Le frontend envoie <font face='Courier'>POST /api/Transfer</font> avec targetUserIds[].",
            "Le middleware valide le JWT puis la permission [RequirePermission(transferer)].",
            "Le TransactionService sauvegarde le statut précédent (StatutPrecedent), crée une transaction par destinataire et met à jour le service actuel du document.",
            "Les destinataires reçoivent une notification ; le registre et le workflow se rafraîchissent.",
        ],
        "<b>A1 — Permission manquante :</b> 403 renvoyée par le middleware ; le bouton est "
        "de toute façon masqué côté UI.<br/>"
        "<b>A2 — Service cible archivé :</b> le service n'apparaît pas dans la liste "
        "(seuls les services actifs sont proposés).<br/>"
        "<b>A3 — Destination historique :</b> si le service historique n'a pas "
        "d'utilisateurs, la transaction est auto-acceptée (trace conservée).",
        "Le document appartient au service destinataire ; une transaction en attente existe "
        "pour chaque destinataire choisi ; l'historique est mis à jour.")

    E.append(Paragraph("UC-06 — Accepter un transfert", st_h3))
    UC_SHEET(
        "06", "Accepter un transfert",
        "Agent du service destinataire — permission <font face='Courier'>accepter</font> "
        "(TransactionsController).",
        "Une transaction « En attente » adressée au service de l'agent existe (notification reçue).",
        [
            "L'agent ouvre la page Notifications : les demandes en attente sont listées avec compteur dans l'en-tête.",
            "Il ouvre le document proposé pour l'examiner (fiche détaillée, fichier joint).",
            "Il clique sur « Accepter » : <font face='Courier'>PUT /api/Transactions/{id}/accepter</font>.",
            "Le backend passe la transaction à « Acceptée », confirme le service actuel du document et avance l'étape du workflow.",
            "L'expéditeur voit l'accusé de réception ; la transaction apparaît dans le registre des transactions.",
        ],
        "<b>A1 — Transaction déjà traitée :</b> erreur métier (état incohérent impossible).<br/>"
        "<b>A2 — Document à retourner :</b> si l'option « doit revenir » est active, "
        "l'acceptation programme le retour au service expéditeur après traitement.",
        "Le document est officiellement pris en charge par le service destinataire ; la "
        "traçabilité est complète (qui, quand, quel service).")

    E.append(Paragraph("UC-07 — Refuser un transfert", st_h3))
    UC_SHEET(
        "07", "Refuser un transfert",
        "Agent du service destinataire — permission <font face='Courier'>refuser</font> "
        "(TransactionsController).",
        "Une transaction « En attente » adressée au service de l'agent existe.",
        [
            "Dans les Notifications, l'agent examine le document proposé.",
            "Il clique sur « Refuser » : le système exige la saisie d'un motif de refus (champ obligatoire).",
            "Il saisit le motif et confirme : <font face='Courier'>PUT /api/Transactions/{id}/refuser</font> avec MotifRefus.",
            "Le backend passe la transaction à « Refusée », enregistre le motif et restitue le document dans son état précédent (rollback via StatutPrecedent).",
            "L'expéditeur est informé du refus et du motif ; le document retourne dans son service d'origine.",
        ],
        "<b>A1 — Motif vide :</b> la validation bloque l'opération (« Veuillez saisir un "
        "motif de refus »).<br/>"
        "<b>A2 — Transaction déjà traitée :</b> erreur métier.",
        "La transaction est clôturée en « Refusée » avec motif ; le document est revenu à "
        "son état et son service précédents, sans perte d'information.")

    E.append(Paragraph("UC-08 — Gérer les utilisateurs", st_h3))
    UC_SHEET(
        "08", "Gérer les utilisateurs",
        "Administrateur — permission <font face='Courier'>gerer_utilisateurs</font> "
        "(UsersController).",
        "L'administrateur est authentifié avec la permission de gestion des utilisateurs.",
        [
            "L'administrateur ouvre Administration → Gestion des utilisateurs (GestionUtilisateurs).",
            "Pour créer : il saisit nom, login, mot de passe et service RBAC d'affectation ; l'utilisateur héritera des permissions activées de ce service.",
            "Pour modifier : il édite le compte (le mot de passe reste inchangé si le champ est vide).",
            "Pour archiver : la suppression est logique (IsActive=false, DeletedAt horodaté) ; le compte disparaît des listes actives.",
            "Depuis « Voir les utilisateurs archivés », il peut restaurer un compte ou le supprimer définitivement après double confirmation.",
            "Chaque opération appelle les endpoints REST correspondants et rafraîchit la liste filtrable (recherche nom/login, filtre par service).",
        ],
        "<b>A1 — Login déjà utilisé :</b> la création est refusée avec message.<br/>"
        "<b>A2 — Accès refusé (401/403) :</b> un message invite à se reconnecter (session "
        "expirée ou permission retirée).<br/>"
        "<b>A3 — Export :</b> la liste courante peut être exportée en Excel/Word selon les "
        "permissions.",
        "Le référentiel des comptes est à jour ; chaque utilisateur actif est rattaché à un "
        "service et hérite de ses permissions ; les archivages restent réversibles.")

    E.append(Paragraph("UC-09 — Gérer les services et la matrice des permissions", st_h3))
    UC_SHEET(
        "09", "Gérer les services et la matrice des permissions",
        "Administrateur — permissions <font face='Courier'>gerer_services</font> et "
        "<font face='Courier'>gerer_permissions</font>.",
        "L'administrateur est authentifié avec les permissions d'administration correspondantes.",
        [
            "Administration → Gestion des services : création d'un service (nom, code unique, description), modification, archivage (soft-delete) et restauration.",
            "La suppression définitive est bloquée par le backend tant que des utilisateurs sont affectés au service (garde de sécurité).",
            "Administration → Gestion des permissions : la matrice services × permissions (clés en 5 catégories) s'affiche.",
            "Pour chaque service, l'administrateur active ou désactive chaque permission (creer_modifier, transferer, accepter, export_excel…).",
            "L'enregistrement met à jour ServicePermissions ; l'effet est immédiat côté API (403) et côté UI (masquage des boutons et des pages).",
            "Il ajuste séparément les 20 overrides administrateur (AdminPermissionOverride) qui restreignent le compte admin.",
            "La cohérence peut être vérifiée par l'audit : bash scripts/permission-audit.sh (46 vérifications).",
        ],
        "<b>A1 — Code service dupliqué :</b> la création échoue (contrainte d'unicité en "
        "base).<br/>"
        "<b>A2 — Service avec utilisateurs :</b> la suppression définitive renvoie 400 avec "
        "message explicite.<br/>"
        "<b>A3 — Matrice non régénérée :</b> PERMISSION_MATRIX.md peut être régénérée par "
        "scan du code (generate-permission-matrix.sh).",
        "La matrice des droits reflète exactement l'organisation du tribunal ; chaque "
        "service ne dispose que des capacités voulues, côté serveur comme côté interface.")

    E.append(Paragraph("UC-10 — Archiver, restaurer et gérer la corbeille", st_h3))
    UC_SHEET(
        "10", "Archiver, restaurer et gérer la corbeille",
        "Agent habilité (permissions <font face='Courier'>archiver</font>, "
        "<font face='Courier'>restaurer</font>, <font face='Courier'>voir_corbeille</font>, "
        "<font face='Courier'>supprimer</font>) ; retraits : <font face='Courier'>retrait_archive</font>.",
        "Le document existe et l'utilisateur dispose des permissions correspondantes.",
        [
            "Archivage unitaire : depuis le registre, « Archiver » appelle <font face='Courier'>PATCH /api/Documents/{id}/archive</font>.",
            "Archivage par lot : sélection multiple dans le registre puis <font face='Courier'>POST /api/Documents/archive-batch</font>.",
            "Suppression logique : le document passe en corbeille (EstSupprime=true) via <font face='Courier'>PATCH /api/Documents/{id}/supprimer</font> ; suppression par lot disponible.",
            "La corbeille (voir_corbeille) liste les documents supprimés ; « Restaurer » appelle <font face='Courier'>PATCH /api/Documents/{id}/restaurer</font>.",
            "Retrait d'archive : le service Archives enregistre la sortie d'un dossier (autorité habilitée : chef du greffe, conseiller rapporteur, premier président ; date et motif) via RetraitController.",
            "Toutes les opérations sont journalisées et réversibles (aucune perte définitive non autorisée).",
        ],
        "<b>A1 — Permission manquante :</b> actions masquées côté UI et 403 côté API.<br/>"
        "<b>A2 — Document déjà supprimé :</b> l'opération de suppression est ignorée "
        "(idempotence).<br/>"
        "<b>A3 — Restauration refusée :</b> si le document a été définitivement supprimé "
        "par un administrateur, la restauration est impossible.",
        "Les dossiers clôturés sont archivés proprement ; les suppressions restent "
        "réversibles via la corbeille ; les retraits d'archives sont tracés avec leur "
        "autorité habilitée.")

    E.append(Paragraph("UC-11 — Exporter / Importer (Excel, Word)", st_h3))
    UC_SHEET(
        "11", "Exporter / Importer (Excel, Word)",
        "Agent habilité — permissions <font face='Courier'>export_excel</font> et "
        "<font face='Courier'>export_word</font> ; import via ExcelImportController.",
        "Le registre à exporter contient des données ; les permissions d'export sont activées.",
        [
            "L'agent clique sur « Export Excel » ou « Export Word » depuis le registre courant (ExportButtons).",
            "Le frontend génère le fichier avec les colonnes normalisées (titre, référence, type, date, source, service, statut, destinataire) et déclenche le téléchargement.",
            "Pour l'import : l'agent télécharge d'abord le modèle Excel (chargerModele).",
            "Il remplit le modèle puis l'importe ; l'assistant ImportMappingModal s'ouvre.",
            "Il mappe chaque colonne du fichier sur le champ de la base correspondant et prévisualise les données (aperçu avant validation).",
            "À la validation, <font face='Courier'>POST /api/ExcelImport</font> crée les documents en lot et renvoie le compte-rendu (créés / ignorés / erreurs).",
        ],
        "<b>A1 — Registre vide :</b> message « Aucune donnée à exporter ».<br/>"
        "<b>A2 — Colonnes obligatoires manquantes :</b> rapport d'erreurs ligne par ligne, "
        "aucun document partiel créé.<br/>"
        "<b>A3 — Permission d'export désactivée :</b> les boutons d'export sont masqués.",
        "Les registres sont exportables pour l'archivage papier et le reporting ; les "
        "saisies en masse sont possibles avec contrôle de cohérence avant écriture.")

    E.append(Paragraph("4. Diagramme de classes", st_h2))
    P("Le modèle de données s'articule autour de la classe <b>Document</b> "
      "(numéro de référence, objet, date de création, service actuel, statut, fichier joint, "
      "drapeau de suppression logique) dont héritent trois entités :")
    BUL("<b>CourrierAdministratif</b> : numéro d'ordre, expéditeur, date de réception, type "
        "de circuit, transmissible.")
    BUL("<b>DossierJuridique</b> : numéro de dossier judiciaire, type de circuit (classique/"
        "exception), motif d'exception (islah, mousaada, ikhtissas), demandeur, date "
        "d'entrée, étape des séances, circuit (maktab_dabt / kitaba_khasa), transactions "
        "d'audience et de délivrance, autorité de retrait.")
    BUL("<b>CourrierSortant</b> : destinataire externe, type (normal/demande), date et "
        "numéro d'envoi, tribunaux d'origine et de destination.")
    P("Chaque mouvement entre services est matérialisé par une <b>Transaction</b> (service "
      "origine/destination, date, remarques, statut en attente/acceptée/refusée, commentaire, "
      "motif de refus, drapeau « doit revenir », utilisateur cible, statut précédent du "
      "document pour le rollback, code de service historique). Les <b>ActionJuridique</b> "
      "journalisent les actions sur les dossiers judiciaires (service, type d'action, "
      "statut, utilisateur, date, données JSON). Les notes (DocumentNote) et l'historique "
      "des modifications (DocumentModification) complètent la traçabilité.")
    P("Le socle RBAC comprend : <b>Utilisateur</b> (login, hachage BCrypt, nom, service, "
      "soft-delete) relié à <b>Service</b> (code unique, nom, description, soft-delete) ; "
      "<b>Permission</b> (clé unique, libellés FR/AR, catégorie) ; <b>ServicePermission</b> "
      "(activation d'une permission pour un service, contrainte d'unicité) ; "
      "<b>AdminPermissionOverride</b> (permissions désactivées pour l'admin) ; "
      "<b>HistoricalService</b> (entités d'historique sans connexion, transferts auto-acceptés) "
      "et <b>DocumentAccess</b> (droits d'accès par document/service).")
    FIG("fig06_classes.png",
        "Figure 6 : Diagramme de classes — modèle de données (simplifié)", 16.4 * cm)

    E.append(Paragraph("5. Diagrammes de séquence", st_h2))
    P("Les diagrammes de séquence montrent, dans l'ordre chronologique, les messages "
      "échangés entre les composants pour un scénario donné. Nous en retenons deux qui "
      "traversent toutes les couches de l'application : l'authentification (la sécurité) "
      "et le transfert de document (le cœur du métier).")
    E.append(Paragraph("5.1 Séquence — Authentification d'un utilisateur", st_h3))
    P("Ce scénario illustre la coopération entre les couches présentation, service et "
      "sécurité. Déroulement nominal :")
    BUL("<b>1.</b> L'utilisateur saisit son login et son mot de passe ; le formulaire "
        "transmet les identifiants à <font face='Courier'>POST /api/Auth/login</font>.")
    BUL("<b>2.</b> AuthController recherche l'utilisateur par login et vérifie le mot de "
        "passe avec <font face='Courier'>BCrypt.Verify</font> — le sel étant intégré au "
        "hachage stocké, aucune table de correspondance n'est nécessaire.")
    BUL("<b>3.</b> En cas de succès, le serveur construit un JWT signé portant "
        "l'identifiant de l'utilisateur et sa durée de vie ; le profil est renvoyé et les "
        "permissions effectives sont récupérées via <font face='Courier'>GET /api/auth/me" 
        "</font>.")
    BUL("<b>4.</b> Le frontend place le token dans AuthContext (en mémoire, jamais en "
        "localStorage) et construit la navigation selon les permissions reçues.")
    P("<b>Scénarios alternatifs :</b> identifiants invalides → réponse 401 et message "
      "d'erreur générique (qui ne précise pas si c'est le login ou le mot de passe qui "
      "échoue, pour ne pas aider un attaquant) ; compte archivé → connexion refusée. La "
      "figure 7 montre les messages échangés entre les participants.")
    SP(4)
    CODE("// Program.cs — validation stricte du token (extrait)\n"
         "options.TokenValidationParameters = new TokenValidationParameters\n"
         "{\n"
         "    ValidateLifetime = true,\n"
         "    ValidateIssuerSigningKey = true,\n"
         "    IssuerSigningKey = new SymmetricSecurityKey(...),\n"
         "    ClockSkew = TimeSpan.Zero   // token expiré = rejet immédiat\n"
         "};")
    FIG("fig07_seq_auth.png",
        "Figure 7 : Diagramme de séquence — Authentification (JWT)", 16.0 * cm)
    E.append(Paragraph("5.2 Séquence — Transfert d'un document", st_h3))
    P("C'est le scénario cœur du système : il met en jeu l'ensemble des mécanismes — "
      "authentification, autorisation, transactionnalité et notification. Déroulement :")
    BUL("<b>1.</b> L'agent ouvre la modale de transfert et choisit le service "
        "destinataire, un ou plusieurs utilisateurs, le mode d'envoi et un commentaire "
        "facultatif.")
    BUL("<b>2.</b> La requête <font face='Courier'>POST /api/Transfer</font> franchit "
        "successivement le middleware JWT (validation de la signature et de "
        "l'expiration), puis le middleware de permissions, qui lit "
        "<font face='Courier'>[RequirePermission(transferer)]</font> sur l'endpoint et "
        "interroge la matrice RBAC (permissions du service + overrides administrateur).")
    BUL("<b>3.</b> TransactionService ouvre une transaction SQL : pour chaque "
        "destinataire, il crée une Transaction (émetteur, destinataire, horodatage, "
        "statut), sauvegarde le statut précédent du document dans StatutPrecedent, met à "
        "jour le service actuel et déclenche les notifications. Toute erreur annule "
        "l'ensemble (rollback) : un document n'est jamais « à moitié transféré ».")
    BUL("<b>4.</b> Le destinataire est notifié ; il accepte (le document entre dans son "
        "workspace) ou refuse via <font face='Courier'>POST /api/Transactions</font> — le "
        "motif de refus est obligatoire et le document revient à son émetteur grâce au "
        "statut sauvegardé.")
    P("<b>Choix de conception :</b> la traçabilité est obtenue en conservant "
      "l'intégralité des transactions (jamais supprimées) : le registre reconstitue la "
      "chaîne de responsabilité complète, exigence essentielle dans un cadre judiciaire. "
      "Le motif de refus obligatoire transforme chaque retour en information exploitable, "
      "plutôt qu'en simple échec silencieux. La figure 8 détaille les messages échangés.")
    SP(4)
    CODE("// Middleware/PermissionValidationMiddleware.cs (extrait)\n"
         "var permissionAttribute = context.GetEndpoint()\n"
         "                             ?.Metadata.GetMetadata<RequirePermissionAttribute>();\n"
         "if (permissionAttribute != null)\n"
         "{\n"
         "    var result = await permissionValidationService\n"
         "        .ValidatePermissionAsync(userId, permissionAttribute.Permission, context);\n"
         "    if (!result.IsAllowed)\n"
         "    {\n"
         "        context.Response.StatusCode = StatusCodes.Status403Forbidden;\n"
         "        await context.Response.WriteAsJsonAsync(new { error = result.Reason });\n"
         "        return;\n"
         "    }\n"
         "}\n"
         "await _next(context);")
    FIG("fig08_seq_transfer.png",
        "Figure 8 : Diagramme de séquence — Transfert d'un document", 16.0 * cm)

    E.append(Paragraph("6. Diagramme d'activité (Workflow Bureau d'ordre → Archives)", st_h2))
    P("Le cycle de vie d'un dossier suit six étapes matérialisées dans l'interface par une "
      "barre de progression : 1) <b>Bureau d'ordre</b> : enregistrement du courrier entrant "
      "et numérotation ; 2) <b>Ouverture des dossiers</b> : création du dossier judiciaire, "
      "attribution du numéro et du circuit ; 3) <b>Secrétariat particulier</b> : préparation "
      "de l'audience, conseiller rapporteur ; 4) <b>Séances & audiences</b> : transactions "
      "d'audience (enquête, commissaire du roi, expertise, conseiller) ; 5) <b>Délivrance & "
      "clôture</b> : signification, règlement des dépens, remise des copies ; 6) "
      "<b>Archivage définitif</b> : dépôt final aux archives, retraits possibles avec "
      "autorité habilitée. À chaque étape, le transfert est soumis à acceptation ; un refus "
      "renvoie le dossier à l'étape précédente (rollback automatique via StatutPrecedent).")
    FIG("fig09_activity.png",
        "Figure 9 : Diagramme d'activité — workflow Bureau d'ordre → Archives", 13.5 * cm)

    E.append(Paragraph("7. Conclusion", st_h2))
    P("La conception UML a permis de valider le modèle métier (documents, transactions, "
      "RBAC) et les scénarios clés avant l'implémentation. Les fiches détaillées des onze "
      "cas d'utilisation précisent, pour chaque fonctionnalité, la permission requise, le "
      "déroulement nominal et les alternatives — garantissant ainsi la cohérence entre le "
      "besoin métier, l'API et l'interface. Le modèle retenu garantit la traçabilité "
      "complète des mouvements et un contrôle d'accès fin par service. Le chapitre suivant "
      "présente l'application réalisée, écran par écran.")
    PB()

    # =========================================================== CHAPITRE 4 =====
    E.append(Paragraph("Chapitre 4 : Présentation du projet réalisé", st_h1))
    E.append(Paragraph("1. Introduction", st_h2))
    P("Ce chapitre présente le produit final : les interfaces de l'application, écran par "
      "écran, puis la stratégie de tests qui garantit sa fiabilité. Les captures d'écran "
      "proposées sont à insérer par vos soins aux emplacements indiqués.")

    E.append(Paragraph("2. Page d'authentification", st_h2))
    P("Première porte d'entrée de l'application, la page de connexion propose la saisie du "
      "login et du mot de passe, avec bascule instantanée entre les langues française et "
      "arabe. Après vérification des identifiants par le backend, l'utilisateur est dirigé "
      "vers le tableau de bord ; ses permissions déterminent les menus visibles dans la "
      "barre latérale.")
    SHOT(10, "Page d'authentification — champs login/mot de passe, bascule FR/AR visible")

    E.append(Paragraph("3. Tableau de bord principal", st_h2))
    P("Le tableau de bord synthétise l'activité du service : statistiques circulaires "
      "(documents par statut : nouveau, en cours, en instance, clôturé, archivé), cartes "
      "d'activité cliquables (entrants, sortants, transactions, archives), flux récent "
      "(créations, transferts, archivages avec horodatage), charge par service (barres de "
      "progression par service), barre de recherche globale, parcours du dossier sélectionné "
      "(workflow en 6 étapes avec avancement en pourcentage), et les deux registres "
      "(courriers généraux et courriers sortants) avec filtres, sélection multiple et "
      "actions (voir, transférer, supprimer, exporter, importer Excel).")
    SHOT(11, "Tableau de bord — statistiques par statut, flux récent, charge par service, barre de workflow")

    E.append(Paragraph("4. Gestion des courriers (administratifs et judiciaires)", st_h2))
    E.append(Paragraph("4.1 Formulaire d'ajout / modification", st_h3))
    P("Trois formulaires dédiés : <b>AdminForm</b> pour le courrier administratif entrant "
      "(numéro d'ordre, expéditeur, dates d'arrivée et du message, numéro interne, année de "
      "numérotation, transmissible, état, fichier PDF/Word/Excel, notes) ; <b>JuridiqueForm</b> "
      "pour le dossier judiciaire (numéro de bureau d'ordre, objet, demandeur, dossier "
      "principal/parent, numéro de première instance, circuit classique ou exception avec "
      "motif) ; <b>SortantForm</b> pour le courrier sortant (destinataire externe, type "
      "normal ou demande/réclamation, date et numéro d'envoi, tribunaux d'origine et de "
      "destination). Chaque formulaire valide les champs obligatoires et détecte les doublons "
      "de références.")
    E.append(Paragraph("4.2 Tableau de registre", st_h3))
    P("Chaque catégorie dispose d'un registre tabulaire (GeneralTable / SortantTable) avec "
      "tri, filtres par statut, recherche instantanée, sélection multiple pour les actions "
      "de masse (archiver, transférer), pagination, et boutons d'export Excel/Word. Le "
      "registre des sortants offre en plus les transitions de statut : brouillon → en "
      "attente d'envoi → envoyé, ou annulé.")
    SHOT("12 à 14", "Formulaire de création d'un courrier administratif, d'un dossier judiciaire et tableau de registre avec filtres et actions")

    E.append(Paragraph("5. Mes entités et espace de travail (Workspace)", st_h2))
    P("La vue « Mes entités » regroupe les documents et procédures actuelles de "
      "l'utilisateur, ainsi que ses dossiers en cours. La modale <b>WorkspaceModal</b> "
      "ouvre un espace de travail complet sur un document : onglet <b>Informations</b> "
      "(tous les champs, fichier joint téléchargeable avec prévisualisation PDF/Word via "
      "pdf.js et mammoth.js), onglet <b>Notes</b> (ajout de notes horodatées), onglet "
      "<b>Historique</b> (chronologie des mouvements entre services, modifications "
      "enregistrées, avancement du workflow) et panneau de transfert direct (service "
      "destinataire, utilisateur, commentaire). La modale DetailModal affiche une lecture "
      "rapide avec édition inline des champs autorisés.")
    SHOT(15, "Espace de travail — onglets informations, notes, historique, fichiers")

    E.append(Paragraph("6. Transferts et transactions", st_h2))
    E.append(Paragraph("6.1 Transfert d'un document (multi-utilisateurs)", st_h3))
    P("La modale de transfert permet de choisir le service destinataire puis de cocher un "
      "ou plusieurs utilisateurs de ce service (checkboxes) ; chaque utilisateur coché "
      "génère sa propre transaction, ce qui permet un suivi individuel des accusés de "
      "réception. Les modes de traitement — transaction unique, diffusion vers plusieurs "
      "services, archivage direct — et l'option « doit revenir » couvrent tous les cas "
      "d'usage du bureau d'ordre.")
    E.append(Paragraph("6.2 Notifications", st_h3))
    P("La page Notifications liste les demandes en attente : pour chaque transfert reçu, "
      "l'agent peut ouvrir le document, l'accepter ou le refuser avec motif obligatoire. Les "
      "documents à retourner (doitRevenir) sont signalés. Un compteur de demandes en "
      "attente est affiché en permanence dans l'en-tête.")
    E.append(Paragraph("6.3 Registre des transactions", st_h3))
    P("Le registre des transactions historise tous les mouvements : document concerné, "
      "service d'origine, service de destination, utilisateurs, date, statut (en attente, "
      "acceptée, refusée), commentaire et motif de refus éventuel. Ce registre constitue la "
      "piste d'audit complète de la circulation des dossiers.")
    SHOT("16 à 18", "Modale de transfert multi-utilisateurs, page des notifications avec accepter/refuser, registre des transactions")

    E.append(Paragraph("7. Administration : utilisateurs, services, permissions, équipements", st_h2))
    E.append(Paragraph("7.1 Gestion des utilisateurs (archivage / restauration)", st_h3))
    P("Le panneau GestionUtilisateurs liste les comptes avec recherche par nom/login et "
      "filtre par service. L'administrateur crée un compte (nom, login, mot de passe, "
      "service RBAC), le modifie (mot de passe optionnel à l'édition), l'archive "
      "(soft-delete), le restaure depuis la vue « Utilisateurs archivés », ou le supprime "
      "définitivement après double confirmation.")
    E.append(Paragraph("7.2 Gestion des services (soft-delete)", st_h3))
    P("Le panneau GestionServices gère les services RBAC (nom, code unique, description, "
      "nombre d'utilisateurs). La suppression est une archive logique (IsActive=false) : le "
      "service disparaît des listes mais son historique est conservé ; la restauration est "
      "immédiate ; la suppression définitive est bloquée tant que des utilisateurs sont "
      "affectés au service.")
    E.append(Paragraph("7.3 Gestion des permissions (matrice RBAC)", st_h3))
    P("Le panneau GestionPermissions affiche la matrice complète services × permissions "
      "(18 clés réparties en catégories : documents, juridique, notifications, recherche, "
      "administration). L'administrateur active/désactive chaque permission par service ; "
      "les changements prennent effet immédiatement côté API (403) et côté interface "
      "(masquage des boutons et menus). Les 20 overrides administrateur sont ajustables "
      "séparément.")
    E.append(Paragraph("7.4 Gestion des équipements et des listes dynamiques", st_h3))
    P("GestionEquipements inventorie le matériel (numéro d'inventaire unique, code, type, "
      "état, service, bureau) avec un cycle charger/décharger horodaté. GestionListes gère "
      "les listes de valeurs dynamiques (code, libellés FR/AR, ordre, activation) utilisées "
      "dans les formulaires. Les services historiques (GestionServicesHistoriques) définissent "
      "des entités d'historique sans connexion : les transferts qui leur sont adressés sont "
      "auto-acceptés, ce qui permet de conserver la trace de services externalisés ou "
      "supprimés.")
    SHOT("19 à 22", "Gestion des utilisateurs (archivage/restauration), services (soft-delete), matrice des permissions, équipements")

    E.append(Paragraph("8. Recherche avancée, corbeille et archives", st_h2))
    P("La recherche de dossiers interroge le système par référence, titre/objet, source ou "
      "service, avec filtres par période. La corbeille (voir_corbeille) liste les documents "
      "supprimés logiquement, avec restauration en un clic ; l'archivage peut être unitaire "
      "ou par lot. Le module de retrait d'archive (RetraitController) enregistre chaque "
      "sortie de dossier : autorité habilitée (chef du greffe, conseiller rapporteur, "
      "premier président), date et motif.")
    SHOT("23 et 24", "Recherche avancée multicritère et corbeille avec restauration")

    E.append(Paragraph("9. Interface bilingue et thème sombre", st_h2))
    P("Toute l'interface est disponible en français et en arabe grâce au dictionnaire de "
      "traductions centralisé (lib/translations.ts, ~500 clés) ; le passage à l'arabe "
      "inverse la mise en page (RTL) et traduit instantanément les libellés, statuts et "
      "services. Le thème clair/sombre est mémorisé entre les sessions. Les libellés des "
      "services respectent la nomenclature du tribunal (Bureau d'ordre / مكتب الضبط, "
      "Séances & audiences / الجلسات والإجراءات, etc.).")
    SHOT(25, "Interface en arabe (mode RTL) et thème sombre — même écran en double affichage")

    E.append(Paragraph("10. Tests et validation", st_h2))
    P("La stratégie de test suit le principe de la pyramide de tests : un socle large de "
      "tests unitaires rapides et précis (backend), complété par des tests de bout en "
      "bout qui valident les parcours utilisateurs réels (frontend), et renforcé par un "
      "audit systématique de la sécurité. Chaque niveau détecte une classe de défauts "
      "différente : un test unitaire en échec isole la règle fautive en quelques "
      "secondes, tandis qu'un échec E2E demande d'abord d'identifier la couche "
      "responsable.")
    E.append(Paragraph("10.1 Tests unitaires xUnit (backend)", st_h3))
    P("Le projet <font face='Courier'>WebApplication1.Tests</font> contient <b>103 tests "
      "xUnit</b> organisés par composant testé. Ils couvrent en priorité les règles où "
      "l'erreur coûterait le plus cher :")
    BUL("<b>Middleware de permissions</b> : requête non authentifiée → 401 ; permission "
        "absente de la matrice du service → 403 ; override administrateur désactivé → "
        "403 ; permission accordée → requête traitée.")
    BUL("<b>TransactionService</b> : acceptation d'un transfert, refus avec motif "
        "obligatoire, rollback intégral en cas d'erreur, transfert multi-destinataires "
        "créant bien une transaction par destinataire.")
    BUL("<b>SeederService</b> : création idempotente de l'administrateur, des 9 services, "
        "des 18 permissions et des 20 overrides (relancer le seed ne duplique rien).")
    BUL("<b>WorkspaceService, DocumentAccessService, mappers</b> : isolement des documents "
        "par service, calcul des droits d'accès, transformations de données.")
    P("Concrètement, ces tests ont permis de refondre sereinement le pipeline de "
      "permissions — remplacement d'un paramètre d'URL fourni par le client par la "
      "lecture de l'attribut côté serveur : la suite complète a confirmé en quelques "
      "secondes qu'aucun comportement de sécurité n'avait régressé.")
    E.append(Paragraph("10.2 Tests end-to-end Cypress (frontend)", st_h3))
    P("Les spécifications Cypress (<b>62 scénarios</b> : 35 dans app.cy.ts, 27 dans "
      "permission-toggle.cy.ts) simulent un utilisateur réel sur l'application démarrée : "
      "connexion, navigation, création de documents, transferts avec acceptation et "
      "refus, recherche, exports. Leur valeur ajoutée principale concerne le couple "
      "permissions/interface : elles vérifient qu'après modification de la matrice par "
      "l'administrateur, les menus, boutons et pages s'ajustent immédiatement pour "
      "l'utilisateur concerné — un écart entre les droits serveur et ce que l'interface "
      "laisse croire serait précisément le type de faille que ce niveau de test révèle.")
    E.append(Paragraph("10.3 Audit automatique des permissions", st_h3))
    P("Le script <font face='Courier'>scripts/permission-audit.sh</font> exécute <b>46 "
      "vérifications</b> contre l'API en cours d'exécution : pour chaque permission, il "
      "valide que les endpoints protégés renvoient 200 quand la permission est activée "
      "et 403 quand elle est désactivée. Ce double contrôle (tests unitaires + audit "
      "boîte noire) est délibéré : il protège contre la dérive silencieuse de la matrice "
      "au fil des évolutions. La matrice de référence est documentée dans "
      "PERMISSION_MATRIX.md et régénérable par scan du code "
      "(generate-permission-matrix.sh) : la documentation ne peut pas diverger du code.")
    p = Paragraph("<b>Synthèse des tests</b>", ParagraphStyle("t", parent=st_tbl_b, spaceAfter=4))
    E.append(p)
    TABLECAP("Tableau 4.1 : Synthèse des suites de tests")
    tests = Table([
        [Paragraph("<b>Suite de tests</b>", st_tbl_b), Paragraph("<b>Nb</b>", st_tbl_b),
         Paragraph("<b>Commande</b>", st_tbl_b)],
        [Paragraph("Tests unitaires backend (xUnit)", st_tbl), Paragraph("103", st_tbl),
         Paragraph("dotnet test", st_tbl)],
        [Paragraph("Cypress E2E — app.cy.ts", st_tbl), Paragraph("35", st_tbl),
         Paragraph("npx cypress run", st_tbl)],
        [Paragraph("Cypress E2E — permission-toggle.cy.ts", st_tbl), Paragraph("27", st_tbl),
         Paragraph("npx cypress run", st_tbl)],
        [Paragraph("Audit des permissions (script bash)", st_tbl), Paragraph("46", st_tbl),
         Paragraph("bash scripts/permission-audit.sh", st_tbl)],
        [Paragraph("Régénération de la matrice documentée (scan code)", st_tbl), Paragraph("22 ctrl.", st_tbl),
         Paragraph("bash scripts/generate-permission-matrix.sh", st_tbl)],
    ], colWidths=[7.5 * cm, 1.5 * cm, 7.7 * cm])
    tests.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    E.append(tests)
    SP(4)
    P("Cette tripartition reflète un principe éprouvé de l'ingénierie logicielle : on ne "
      "démontre pas la sécurité d'un système par ses seuls tests d'interface. Ici, la "
      "règle métier est prouvée unitairement, le parcours utilisateur est validé de bout "
      "en bout, et la politique de sécurité est auditée de l'extérieur, comme le ferait "
      "un attaquant.")

    E.append(Paragraph("11. Difficultés rencontrées et solutions apportées", st_h2))
    P("Comme tout projet réel, le développement a été jalonné de difficultés techniques et "
      "organisationnelles. Nous présentons les principales, avec les solutions mises en "
      "œuvre — ce bilan fait partie intégrante de l'apprentissage du stage.")
    diffs = [
        ("Contrôle d'accès contournable",
         "La première version vérifiait la permission à partir d'un paramètre fourni par le "
         "client (requête ?permission=…), qu'il suffisait d'omettre pour contourner la "
         "règle.",
         "Remplacement complet par la lecture de l'attribut [RequirePermission] posé sur "
         "l'endpoint, côté serveur uniquement ; suite des 103 tests unitaires rejouée pour "
         "garantir l'absence de régression, puis audit boîte noire (46 vérifications)."),
        ("Séparation des responsabilités de l'administrateur",
         "Un compte administrateur tout-puissant pouvait créer, transférer et clôturer des "
         "dossiers — un risque métier dans un contexte judiciaire.",
         "Introduction des AdminPermissionOverrides : 20 permissions métier sont désactivées "
         "par défaut pour l'administrateur, qui conserve la gestion du système mais n'effectue "
         "plus les opérations courantes des agents."),
        ("Cohérence des données lors des transferts",
         "Un transfert touchait plusieurs tables (transaction, statut, service courant) ; une "
         "erreur intermédiaire laissait le document dans un état incohérent.",
         "Encapsulation dans une transaction SQL avec rollback intégral : soit toutes les "
         "écritures aboutissent, soit aucune. StatutPrecedent sauvegardé pour permettre le "
         "retour arrière en cas de refus."),
        ("Synchronisation interface / permissions",
         "Modifier la matrice des permissions n'était pas toujours reflété immédiatement côté "
         "client, créant un décalage entre ce que l'interface laissait croire et les droits "
         "réels.",
         "Rechargement systématique des permissions effectives à chaque session et après "
         "modification ; scénarios Cypress dédiés (permission-toggle.cy.ts, 27 tests) qui "
         "verrouillent ce comportement."),
        ("Données historiques et services renommés",
         "Renommer un service métier cassait les documents s'y rapportant (clés obsolètes).",
         "Mécanisme de services historiques (HistoricalService) : les références passées "
         "restent lisibles et attribuables, les nouveaux documents pointant vers le service "
         "à jour."),
        ("Travail en binôme sur un même dépôt",
         "Deux développeurs sur les mêmes modules : risque de conflits et d'écrasements.",
         "Branches par fonctionnalité, revue croisée systématique avant fusion, découpage en "
         "modules faiblement couplés (l'un sur le RBAC backend, l'autre sur les vues "
         "documentaires, par exemple)."),
    ]
    for titre, prob, sol in diffs:
        d_rows = [
            [Paragraph(f"<b>Difficulté : {titre}</b>", st_tbl_b)],
            [Paragraph(f"<b>Constat :</b> {prob}", st_tbl)],
            [Paragraph(f"<b>Solution :</b> {sol}", st_tbl)],
        ]
        dt = Table(d_rows, colWidths=[16.1 * cm])
        dt.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.grey),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        E.append(dt)
        SP(5)
    PB()

    # ------------------------------------------------------------- conclusion --
    E.append(Paragraph("Conclusion générale et perspectives", st_h1))
    P("Ce projet de fin d'études nous a conduit, à travers un stage au sein de la Cour "
      "d'Appel Administrative, de l'analyse d'un processus entièrement manuel à la "
      "livraison d'une application web full-stack opérationnelle. Le besoin était clair : "
      "les dossiers judiciaires circulaient sur papier, sans traçabilité fiable ni contrôle "
      "d'accès fin, et chaque question simple — « où est le dossier ? qui l'a traité ? » — "
      "exigeait des recherches fastidieuses dans les registres.", st_body_indent)
    P("La solution réalisée digitalise l'intégralité du circuit documentaire : enregistrement "
      "des courriers administratifs, création des dossiers judiciaires, gestion du courrier "
      "sortant, transferts inter-services avec accusé de réception (acceptation ou refus "
      "motivé), workflow visible en six étapes, notifications, espace de travail avec notes "
      "et historique, corbeille avec restauration, recherche multicritère, import/export "
      "Excel et Word, et un back-office d'administration complet. Le tout est sécurisé par "
      "une authentification JWT, des mots de passe BCrypt et un système RBAC dynamique de "
      "18 permissions appliquées à la fois côté serveur et côté interface, avec un calque "
      "d'override pour l'administrateur. L'interface bilingue français/arabe avec support "
      "RTL s'aligne sur les pratiques réelles du tribunal.", st_body_indent)
    P("La démarche de qualité — 103 tests unitaires, 62 tests end-to-end Cypress et un "
      "audit automatisé de 46 vérifications de permissions — confère au système un niveau "
      "de fiabilité adapté à un environnement institutionnel.", st_body_indent)
    P("<b>Perspectives d'évolution :</b>", st_body_indent)
    BUL("Notifications par e-mail et tableau de bord consolidé pour la direction.")
    BUL("Signature électronique des documents et horodatage certifié.")
    BUL("Application mobile pour les agents en déplacement (tabligh, expertise).")
    BUL("Statistiques avancées et exports décisionnels (délais moyens par étape, "
        "productivité par service).")
    BUL("Intégration avec d'autres systèmes du ministère de la Justice (annuaire des "
        "juridictions, référentiels nationaux).")
    BUL("Déploiement sur serveur d'infrastructure mutualisée avec sauvegardes automatisées "
        "et haute disponibilité.")
    PB()

    # ------------------------------------------------------------- webographie --
    E.append(Paragraph("Webographie", st_h1))
    refs = [
        "[1] Documentation officielle Next.js — <u>https://nextjs.org/docs</u>",
        "[2] Documentation officielle React — <u>https://react.dev</u>",
        "[3] Documentation TypeScript — <u>https://www.typescriptlang.org/docs</u>",
        "[4] Documentation ASP.NET Core — <u>https://learn.microsoft.com/aspnet/core</u>",
        "[5] Entity Framework Core — <u>https://learn.microsoft.com/ef/core</u>",
        "[6] SQL Server documentation — <u>https://learn.microsoft.com/sql</u>",
        "[7] JWT (Json Web Tokens) — <u>https://jwt.io/introduction</u>",
        "[8] BCrypt.Net-Next — <u>https://github.com/BcryptNet/bcrypt.net</u>",
        "[9] Tailwind CSS — <u>https://tailwindcss.com/docs</u>",
        "[10] Cypress — End to end testing — <u>https://docs.cypress.io</u>",
        "[11] xUnit.net — <u>https://xunit.net</u>",
        "[12] Git & GitHub — <u>https://git-scm.com/doc</u> — <u>https://docs.github.com</u>",
        "[13] OpenAPI / openapi-typescript — <u>https://github.com/drwpow/openapi-typescript</u>",
        "[14] StarUML — modélisation UML — <u>https://staruml.io</u>",
    ]
    for r in refs:
        P(r, st_small)
    PB()

    # ================================================================== ANNEXE A
    E.append(Paragraph("Annexe A : Inventaire des endpoints API et permissions RBAC", st_h1))
    E.append(Paragraph("A.1 Sécurisation des endpoints", st_h2))
    P("Chaque endpoint de l'API est protégé en deux couches : l'authentification JWT "
      "(middleware UseAuthentication) puis la validation de la permission déclarée par "
      "l'attribut <font face='Courier'>[RequirePermission(\"clé\")]</font> "
      "(PermissionValidationMiddleware). Dans le tableau A.2, la mention "
      "<b>—</b> indique un endpoint accessible à tout utilisateur authentifié (JWT valide, "
      "sans permission spécifique) ; les clés marquées <b>(*)</b> sont des permissions "
      "étendues au-delà des 18 clés principales du tableau A.1.")

    E.append(Paragraph("A.2 Tableau des endpoints par contrôleur", st_h2))
    TABLECAP("Tableau A.1 : Endpoints de l'API et permissions requises (par contrôleur)")
    endpoint_rows = [
        ("AuthController", "POST /api/Auth/login · GET /api/Auth/me", "—"),
        ("UsersController", "GET /api/Users · GET /{id} · POST · PUT /{id} · DELETE /{id} (soft) · POST /{id}/restore · DELETE /{id}/permanent", "gerer_utilisateurs"),
        ("UsersController", "GET /by-service/{code} · GET /actifs", "—"),
        ("DocumentsController", "GET /api/Documents · GET /reminders", "—"),
        ("DocumentsController", "PATCH /{id}/supprimer · POST /supprimer-batch · DELETE /{id}/permanent · POST /permanent-delete-batch", "supprimer"),
        ("DocumentsController", "PATCH /{id}/restaurer", "restaurer"),
        ("DocumentsController", "GET /corbeille", "voir_corbeille"),
        ("DocumentsController", "PATCH /{id}/archive · POST /archive-batch", "archiver"),
        ("CourrierAdminController", "GET /api/CourrierAdmin · GET /{id}", "—"),
        ("CourrierAdminController", "POST · PUT /{id}", "creer_courrier_admin"),
        ("CourrierAdminController", "DELETE /{id}", "supprimer"),
        ("CourrierJuridiqueController", "GET /api/CourrierJuridique · GET /{id}", "—"),
        ("CourrierJuridiqueController", "POST · PUT /{id}", "creer_courrier_juridique"),
        ("CourrierJuridiqueController", "DELETE /{id}", "supprimer"),
        ("CourrierSortantController", "GET /api/CourrierSortant · GET /{id}", "—"),
        ("CourrierSortantController", "POST · PUT /{id}", "creer_modifier"),
        ("CourrierSortantController", "DELETE /{id}", "supprimer"),
        ("TransferController", "POST /api/Transfer (multi-destinataires)", "transferer"),
        ("TransactionsController", "GET /pending · /all · /stats · /stats-by-service · /count-pending · /doit-revenir · /history/{id}", "—"),
        ("TransactionsController", "PUT /{id}/accepter", "accepter"),
        ("TransactionsController", "PUT /{id}/refuser", "refuser"),
        ("TransactionsController", "PUT /{id}/annuler-transition", "annuler_transfert (*)"),
        ("TransactionJuridiqueController", "POST /api/juridique/{dossierId}/TransactionJuridique", "transferer_juridique"),
        ("ActionsJuridiquesController", "POST /api/ActionsJuridiques", "transferer_juridique"),
        ("ActionsJuridiquesController", "GET /{dossierId}", "—"),
        ("RetraitController", "GET /api/Retrait · GET /document/{id}", "—"),
        ("RetraitController", "POST · PATCH /{id}/annuler · PATCH /{id}/retourner · DELETE /{id}", "retrait_archive"),
        ("RbacServicesController", "GET /api/rbac/services", "—"),
        ("RbacServicesController", "POST · PUT /{id} · DELETE /{id} (soft) · POST /{id}/restore · DELETE /{id}/permanent", "gerer_services"),
        ("ServicesController (legacy)", "GET /api/Services · GET /{id}", "—"),
        ("ServicesController (legacy)", "POST · PUT /{id} · DELETE /{id}", "gerer_services"),
        ("RbacPermissionsController", "GET /api/rbac/permissions · /service/{id} · /mine · GET /admin", "—"),
        ("RbacPermissionsController", "PUT /service/{serviceId} · GET /matrix · PUT /admin", "gerer_permissions"),
        ("HistoricalServicesController", "GET/POST /api/historical-services · GET/PUT/DELETE /{id}", "gerer_services"),
        ("WorkspaceController", "GET /api/Workspace/document/{id}", "voir_workspace (*)"),
        ("WorkspaceController", "PUT /document/{id}", "creer_modifier"),
        ("WorkspaceController", "POST /document/{id}/access · DELETE /document/{id}/access/{code} · POST /document/backfill-acl", "gerer_permissions"),
        ("WorkspaceController", "GET /document/{id}/notes", "—"),
        ("WorkspaceController", "POST /document/{id}/notes · PUT /notes/{id} · DELETE /notes/{id}", "ajouter_notes"),
        ("WorkspaceController", "GET /document/{id}/modifications", "voir_historique (*)"),
        ("EquipmentController", "GET /api/Equipment · GET /{id}", "—"),
        ("EquipmentController", "POST · PUT /{id} · PUT /{id}/toggle-charge · DELETE /{id}", "gerer_equipements"),
        ("ListItemsController", "GET /api/ListItems · GET /{listName}", "—"),
        ("ListItemsController", "POST · PUT /{id} · DELETE /{id}", "gerer_listes"),
        ("SubstitutesController", "GET /user/{id} · GET /history/{id}", "—"),
        ("SubstitutesController", "POST · DELETE /{id}", "gerer_substituts (*)"),
        ("FileUploadController", "POST /api/FileUpload · POST /{documentId} · GET /{name} · GET /preview/{name}", "—"),
        ("FileUploadController", "GET /download/{name}", "telecharger_fichiers (*)"),
        ("ExcelImportController", "POST /api/ExcelImport", "—"),
        ("SeedController", "POST /api/Seed/run · POST /api/Seed/user", "rôle Admin (JWT)"),
    ]
    DATA_TABLE(["Contrôleur", "Endpoints", "Permission requise"],
               endpoint_rows, [4.3 * cm, 8.6 * cm, 3.8 * cm],
               style=st_tbl_sm, style_b=st_tbl_smb)
    SP(6)

    E.append(Paragraph("A.3 Clés de permissions principales (matrice RBAC)", st_h2))
    TABLECAP("Tableau A.2 : Clés de permissions RBAC (18 permissions dynamiques)")
    perm_rows = [
        ("accepter", "TransactionsController", "Notifications"),
        ("ajouter_notes", "WorkspaceController", "Documents"),
        ("archiver", "DocumentsController", "Documents"),
        ("creer_courrier_admin", "CourrierAdminController", "Documents"),
        ("creer_courrier_juridique", "CourrierJuridiqueController", "Documents"),
        ("creer_modifier", "CourrierSortantController, WorkspaceController", "Documents"),
        ("gerer_equipements", "EquipmentController", "Administration"),
        ("gerer_listes", "ListItemsController", "Administration"),
        ("gerer_permissions", "RbacPermissionsController, WorkspaceController", "Administration"),
        ("gerer_services", "RbacServicesController, HistoricalServicesController, ServicesController", "Administration"),
        ("gerer_utilisateurs", "UsersController", "Administration"),
        ("refuser", "TransactionsController", "Notifications"),
        ("restaurer", "DocumentsController", "Documents"),
        ("retrait_archive", "RetraitController", "Juridique"),
        ("supprimer", "Documents, CourrierAdmin, CourrierJuridique, CourrierSortant", "Documents"),
        ("transferer", "TransferController", "Documents"),
        ("transferer_juridique", "ActionsJuridiquesController, TransactionJuridiqueController", "Juridique"),
        ("voir_corbeille", "DocumentsController", "Recherche"),
    ]
    DATA_TABLE(["Clé de permission", "Contrôleurs backend", "Catégorie"],
               perm_rows, [4.6 * cm, 9.0 * cm, 3.1 * cm],
               style=st_tbl_sm, style_b=st_tbl_smb)
    PB()

    # ================================================================== ANNEXE B
    E.append(Paragraph("Annexe B : Modèle de données physique (EF Core)", st_h1))
    E.append(Paragraph("B.1 Diagramme Entité-Association", st_h2))
    P("Le diagramme ci-dessous présente les principales tables générées par Entity "
      "Framework Core (approche code-first) avec leurs clés primaires (PK), clés "
      "étrangères (FK) et cardinalités. La hiérarchie Document → CourrierAdministratif / "
      "DossierJuridique / CourrierSortant est mappée par héritage ; les contraintes "
      "d'unicité (Code service, Key permission, couple ServiceId + PermissionKey, couple "
      "DocumentId + ServiceCode) sont matérialisées en base par des index uniques.")
    FIG("fig10_er.png",
        "Figure B.1 : Diagramme Entité-Association EF Core avec cardinalités", 16.4 * cm)

    E.append(Paragraph("B.2 Comptes créés par le seed au démarrage", st_h2))
    TABLECAP("Tableau B.1 : Comptes de démonstration créés par le SeederService")
    P("Le SeederService exécuté au démarrage (et relançable via "
      "<font face='Courier'>POST /api/Seed/run</font>) crée, de manière idempotente, "
      "l'administrateur, les 9 services RBAC, les permissions, la matrice "
      "service × permissions, les 20 overrides administrateur, les services historiques "
      "et les comptes de démonstration suivants :")
    seed_rows = [
        ("admin", "admin123", "Administrateur", "—"),
        ("bureauordre", "bureauordre123", "Bureau d'ordre", "Saisie des courriers, transferts"),
        ("fathmilafat", "fathmilafat123", "Ouverture des dossiers", "Création des dossiers juridiques"),
        ("secretarait", "secretarait123", "Secrétariat général", "Suivi des dossiers"),
        ("seances", "seances123", "Séances & Procédures", "Transactions d'audience"),
        ("khibra", "khibra123", "Expertise judiciaire", "Gestion des expertises"),
        ("taslimnosakh", "taslim123", "Délivrance des copies", "Signification, dépens, copies"),
        ("tasfiya", "tasfiya123", "Règlement des dépens", "Tasfiyat sawa2ir"),
        ("archive", "archive123", "Archive", "Archivage, retraits"),
        ("atabligh", "atabligh123", "Notification", "Bureau de notification"),
    ]
    DATA_TABLE(["Login", "Mot de passe", "Service RBAC", "Rôle fonctionnel"],
               seed_rows, [3.4 * cm, 3.6 * cm, 4.8 * cm, 4.9 * cm],
               style=st_tbl_sm, style_b=st_tbl_smb)
    SP(4)
    P("Ces comptes de démonstration sont destinés aux tests et à la formation des agents ; "
      "en production, les mots de passe par défaut doivent impérativement être modifiés "
      "(hachage BCrypt en base).", st_small)


# ---------------------------------------------------------------- main -------
def main():
    """Converge the TOC: render repeatedly until collected page numbers are
    stable (the TOC's own row count shifts pages, so 2-3 passes are needed)."""
    global TOC_DATA
    TOC_DATA = []
    tmp = OUT.replace(".pdf", "_pass.pdf")
    for i in range(5):
        build_story()
        out = OUT if i >= 1 else tmp
        d = RapportDoc(out)
        d.build(list(E))
        entries = list(d._toc_entries)
        if entries == TOC_DATA:
            print(f"TOC converged after {i + 1} passes ({len(entries)} entries)")
            break
        TOC_DATA = entries
    if os.path.exists(tmp):
        os.remove(tmp)
    print("OK ->", OUT)
    print(f"TOC entries: {len(TOC_DATA)}")


if __name__ == "__main__":
    main()
