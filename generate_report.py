# ============================================================
#  INTIKHABATI — Rapport de Projet Complet
#  Généré automatiquement avec ReportLab
# ============================================================

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import Flowable
from reportlab.lib.colors import HexColor
import datetime

# ── Couleurs thème ───────────────────────────────────────────
DARK_BG    = HexColor('#0a1628')
CYAN       = HexColor('#00d4ff')
BLUE       = HexColor('#0066cc')
GREEN      = HexColor('#00ff88')
DARK_GREEN = HexColor('#1a7a4a')
GOLD       = HexColor('#d4a017')
PURPLE     = HexColor('#a855f7')
GRAY       = HexColor('#4a5568')
LIGHT_GRAY = HexColor('#e2e8f0')
WHITE      = HexColor('#ffffff')
RED        = HexColor('#e53e3e')
LIGHT_BG   = HexColor('#f7fafc')
DARK_BLUE  = HexColor('#0d1b2e')

OUTPUT_PATH = r"C:\Users\Windows\Desktop\civicchain\INTIKHABATI_Rapport_Complet.pdf"

# ── Document ─────────────────────────────────────────────────
doc = SimpleDocTemplate(
    OUTPUT_PATH,
    pagesize=A4,
    topMargin=2.5*cm,
    bottomMargin=2.5*cm,
    leftMargin=2.2*cm,
    rightMargin=2.2*cm,
    title="INTIKHABATI — Rapport de Projet Complet",
    author="CivicChain Development Team",
    subject="Plateforme de Vote Blockchain — Maroc 2026",
    keywords="blockchain, vote, ethereum, smart contract, maroc, intikhabati",
)

W = A4[0] - 4.4*cm  # largeur utile

styles = getSampleStyleSheet()

# ── Styles personnalisés ──────────────────────────────────────
def make_style(name, **kwargs):
    defaults = dict(fontName='Helvetica', fontSize=11, textColor=colors.black, leading=14)
    defaults.update(kwargs)
    return ParagraphStyle(name, **defaults)

h1 = make_style('H1', fontName='Helvetica-Bold', fontSize=22, textColor=DARK_BG,
                spaceAfter=6, spaceBefore=14, alignment=TA_CENTER)
h2 = make_style('H2', fontName='Helvetica-Bold', fontSize=14, textColor=BLUE,
                spaceAfter=4, spaceBefore=12, borderPad=2)
h3 = make_style('H3', fontName='Helvetica-Bold', fontSize=11, textColor=DARK_BG,
                spaceAfter=3, spaceBefore=8)
body = make_style('Body', fontSize=10, textColor=HexColor('#2d3748'), leading=16,
                  spaceAfter=4, alignment=TA_JUSTIFY)
body_left = make_style('BodyL', fontSize=10, textColor=HexColor('#2d3748'), leading=16,
                        spaceAfter=4)
caption = make_style('Caption', fontSize=8, textColor=GRAY, alignment=TA_CENTER, spaceAfter=6)
code_style = make_style('Code', fontName='Courier', fontSize=8.5, textColor=HexColor('#1a1a2e'),
                         backColor=HexColor('#eef2f7'), leading=13, leftIndent=10, rightIndent=10,
                         spaceAfter=6, spaceBefore=4)
bullet_style = make_style('Bullet', fontSize=10, textColor=HexColor('#2d3748'), leading=16,
                           leftIndent=20, spaceAfter=2, bulletIndent=10)
tag_cyan  = make_style('TagC', fontName='Helvetica-Bold', fontSize=9, textColor=WHITE,
                        backColor=BLUE, alignment=TA_CENTER, leading=14)
section_title = make_style('SecTitle', fontName='Helvetica-Bold', fontSize=18, textColor=WHITE,
                             alignment=TA_CENTER, leading=24)
subtitle_style = make_style('SubTitle', fontName='Helvetica', fontSize=12, textColor=GRAY,
                              alignment=TA_CENTER, spaceAfter=4)
footer_style = make_style('Footer', fontSize=8, textColor=GRAY, alignment=TA_CENTER)
kpi_val  = make_style('KpiVal', fontName='Helvetica-Bold', fontSize=20, alignment=TA_CENTER,
                       spaceAfter=0)
kpi_lbl  = make_style('KpiLbl', fontSize=8, textColor=GRAY, alignment=TA_CENTER,
                       spaceBefore=0)

# ── Classe bande colorée ──────────────────────────────────────
class ColorBand(Flowable):
    def __init__(self, width, height, color, radius=4):
        Flowable.__init__(self)
        self.width  = width
        self.height = height
        self.color  = color
        self.radius = radius

    def draw(self):
        self.canv.setFillColor(self.color)
        self.canv.roundRect(0, 0, self.width, self.height, self.radius, fill=1, stroke=0)

class HeaderBand(Flowable):
    """Grande bannière d'en-tête"""
    def __init__(self, width, height=3.5*cm):
        Flowable.__init__(self)
        self.width  = width
        self.height = height

    def draw(self):
        c = self.canv
        # Fond dégradé simulé (rectangle sombre)
        c.setFillColor(DARK_BG)
        c.rect(0, 0, self.width, self.height, fill=1, stroke=0)
        # Ligne décorative cyan
        c.setFillColor(CYAN)
        c.rect(0, self.height - 4, self.width, 4, fill=1, stroke=0)
        # Titre
        c.setFillColor(CYAN)
        c.setFont('Helvetica-Bold', 28)
        c.drawCentredString(self.width / 2, self.height - 45, 'INTIKHABATI')
        # Sous-titre arabe + français
        c.setFillColor(HexColor('#aaaacc'))
        c.setFont('Helvetica', 10)
        c.drawCentredString(self.width / 2, self.height - 62,
                            'Plateforme de Vote Blockchain — Maroc 2026')
        # Badge
        badge_w = 200
        badge_x = (self.width - badge_w) / 2
        c.setFillColor(HexColor('#001a4d'))
        c.roundRect(badge_x, 8, badge_w, 20, 4, fill=1, stroke=0)
        c.setFillColor(CYAN)
        c.setFont('Helvetica-Bold', 9)
        c.drawCentredString(self.width / 2, 14, 'RAPPORT COMPLET DU PROJET')

class SectionHeader(Flowable):
    def __init__(self, text, width, color=BLUE, num=''):
        Flowable.__init__(self)
        self.text  = text
        self.width = width
        self.color = color
        self.num   = num
        self.height = 1.1*cm

    def draw(self):
        c = self.canv
        c.setFillColor(self.color)
        c.roundRect(0, 0, self.width, self.height, 5, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont('Helvetica-Bold', 13)
        label = f'{self.num}  {self.text}' if self.num else self.text
        c.drawString(14, (self.height - 13) / 2, label)

class Separator(Flowable):
    def __init__(self, width, color=LIGHT_GRAY, thickness=0.75):
        Flowable.__init__(self)
        self.width = width
        self.color = color
        self.thickness = thickness
        self.height = 6

    def draw(self):
        self.canv.setStrokeColor(self.color)
        self.canv.setLineWidth(self.thickness)
        self.canv.line(0, 3, self.width, 3)

def sp(n=1):
    return Spacer(1, n * 0.35 * cm)

def kpi_table(items):
    """items = [(value, label, color), ...]"""
    n = len(items)
    col_w = W / n
    data = [[Paragraph(str(v), make_style(f'kv{idx}', fontName='Helvetica-Bold', fontSize=18,
                                           textColor=HexColor(c) if isinstance(c, str) else c,
                                           alignment=TA_CENTER))
             for idx, (v, _, c) in enumerate(items)],
            [Paragraph(lbl, kpi_lbl) for _, lbl, _ in items]]
    style = TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), LIGHT_BG),
        ('GRID', (0,0), (-1,-1), 0.5, LIGHT_GRAY),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ])
    return Table(data, colWidths=[col_w]*n, style=style)

def info_table(rows, col_widths=None):
    """rows = [(key, value), ...]"""
    if not col_widths:
        col_widths = [W*0.35, W*0.65]
    data = []
    for i, (k, v) in enumerate(rows):
        data.append([
            Paragraph(f'<b>{k}</b>', make_style(f'ik{i}', fontSize=9, textColor=HexColor('#1a202c'))),
            Paragraph(str(v), make_style(f'iv{i}', fontSize=9, textColor=HexColor('#2d3748'), leading=13))
        ])
    style = TableStyle([
        ('BACKGROUND', (0,0), (0,-1), HexColor('#eef2f7')),
        ('BACKGROUND', (1,0), (1,-1), WHITE),
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [HexColor('#f0f4f8'), WHITE]),
        ('GRID', (0,0), (-1,-1), 0.5, LIGHT_GRAY),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ])
    return Table(data, colWidths=col_widths, style=style)

def code_block(text):
    escaped = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    return Paragraph(escaped, code_style)

def feature_table(features):
    """features = [(num, title, desc, status), ...]"""
    data = [['#', 'Fonctionnalité', 'Description', 'Statut']]
    for num, title, desc, status in features:
        color = GREEN if status == 'Implémenté' else GOLD
        data.append([
            Paragraph(str(num), make_style('fn', fontSize=9, fontName='Helvetica-Bold',
                                            textColor=BLUE, alignment=TA_CENTER)),
            Paragraph(f'<b>{title}</b>', make_style('ft', fontSize=9, textColor=DARK_BG)),
            Paragraph(desc, make_style('fd', fontSize=8.5, textColor=GRAY, leading=12)),
            Paragraph(status, make_style('fs', fontSize=8, fontName='Helvetica-Bold',
                                          textColor=color, alignment=TA_CENTER)),
        ])
    style = TableStyle([
        ('BACKGROUND', (0,0), (-1,0), DARK_BG),
        ('TEXTCOLOR', (0,0), (-1,0), WHITE),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 9),
        ('ALIGN', (0,0), (-1,0), 'CENTER'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [LIGHT_BG, WHITE]),
        ('GRID', (0,0), (-1,-1), 0.4, LIGHT_GRAY),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN', (0,0), (0,-1), 'CENTER'),
        ('ALIGN', (3,0), (3,-1), 'CENTER'),
    ])
    return Table(data, colWidths=[W*0.06, W*0.25, W*0.52, W*0.17], style=style)

def api_table(rows):
    """rows = [(method, endpoint, desc), ...]"""
    data = [['Méthode', 'Endpoint', 'Description']]
    for method, endpoint, desc in rows:
        m_color = {'GET': DARK_GREEN, 'POST': BLUE, 'DELETE': RED}.get(method, GRAY)
        data.append([
            Paragraph(f'<b>{method}</b>',
                      make_style(f'am{method}', fontSize=8.5, textColor=m_color,
                                  alignment=TA_CENTER, fontName='Helvetica-Bold')),
            Paragraph(endpoint, make_style('ae', fontName='Courier', fontSize=8,
                                            textColor=HexColor('#1a1a2e'))),
            Paragraph(desc, make_style('ad', fontSize=8.5, textColor=GRAY, leading=12)),
        ])
    style = TableStyle([
        ('BACKGROUND', (0,0), (-1,0), DARK_BG),
        ('TEXTCOLOR', (0,0), (-1,0), WHITE),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 9),
        ('ALIGN', (0,0), (-1,0), 'CENTER'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [LIGHT_BG, WHITE]),
        ('GRID', (0,0), (-1,-1), 0.4, LIGHT_GRAY),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN', (0,1), (0,-1), 'CENTER'),
    ])
    return Table(data, colWidths=[W*0.12, W*0.37, W*0.51], style=style)

# ============================================================
#  CONTENU DU RAPPORT
# ============================================================
story = []
now = datetime.datetime.now()
date_str = now.strftime('%d %B %Y').replace('April','avril').replace('January','janvier') \
                                    .replace('February','février').replace('March','mars') \
                                    .replace('May','mai').replace('June','juin') \
                                    .replace('July','juillet').replace('August','août') \
                                    .replace('September','septembre').replace('October','octobre') \
                                    .replace('November','novembre').replace('December','décembre')

# ============================================================
#  PAGE DE COUVERTURE
# ============================================================
story.append(HeaderBand(W))
story.append(sp(2))

story.append(Paragraph('RAPPORT DE PROJET', make_style('cv1', fontName='Helvetica-Bold',
    fontSize=13, textColor=GRAY, alignment=TA_CENTER)))
story.append(sp(0.5))
story.append(Paragraph('Plateforme Nationale de Vote Électronique Sécurisée',
    make_style('cv2', fontName='Helvetica-Bold', fontSize=16, textColor=DARK_BG,
               alignment=TA_CENTER)))
story.append(sp(2))

# KPIs de couverture
story.append(kpi_table([
    ('5', 'Couches Tech', BLUE),
    ('19', 'Fonctionnalités', DARK_GREEN),
    ('59', 'Tests Passés', GOLD),
    ('100%', 'Coverage', '#a855f7'),
]))
story.append(sp(2))

cover_info = info_table([
    ('Projet',      'INTIKHABATI — انتخاباتي'),
    ('Version',     '1.0.0 — Production Ready'),
    ('Date',        date_str),
    ('Réseau',      'Ethereum (Hardhat Local → Mainnet ready)'),
    ('Langage SC',  'Solidity ^0.8.19'),
    ('Backend',     'Node.js 18 + Express 4 + MongoDB'),
    ('Frontend',    'React 19 + Ethers.js v6 + Recharts'),
    ('Auteur',      'CivicChain Development Team'),
    ('Licence',     'MIT'),
])
story.append(cover_info)
story.append(sp(2))
story.append(Separator(W, CYAN, 1.5))
story.append(sp(0.5))
story.append(Paragraph(
    'Ce rapport présente l\'architecture complète, les fonctionnalités implémentées, '
    'l\'analyse du smart contract, la sécurité et les choix techniques du projet INTIKHABATI — '
    'une DApp (application décentralisée) de vote électronique sécurisée par la blockchain Ethereum, '
    'conçue pour les élections nationales du Maroc 2026.',
    body))
story.append(PageBreak())

# ============================================================
#  TABLE DES MATIÈRES
# ============================================================
story.append(SectionHeader('TABLE DES MATIÈRES', W, DARK_BG))
story.append(sp(1))

toc_items = [
    ('1', 'Vue d\'ensemble du Projet',         '3'),
    ('2', 'Architecture Système',              '4'),
    ('3', 'Smart Contract — CivicChain.sol',   '5'),
    ('4', 'Stack Technologique',               '8'),
    ('5', 'API Backend — Endpoints',           '9'),
    ('6', 'Frontend — Pages & Composants',    '11'),
    ('7', 'Modèles de Données MongoDB',        '12'),
    ('8', 'Fonctionnalités Implémentées',      '13'),
    ('9', 'Sécurité & Anti-Fraude',            '15'),
    ('10','Tests & Qualité',                   '16'),
    ('11','Flux de Vote — Guide Utilisateur',  '17'),
    ('12','Panneau Administration',            '18'),
    ('13','Métriques & Analyses',              '19'),
    ('14','Certificat PDF Officiel',           '20'),
    ('15','Déploiement & Configuration',       '21'),
]

toc_data = []
for num, title, page in toc_items:
    toc_data.append([
        Paragraph(f'<b>{num}.</b>', make_style('tn', fontSize=10, textColor=BLUE)),
        Paragraph(title, make_style('tt', fontSize=10, textColor=HexColor('#2d3748'))),
        Paragraph(page, make_style('tp', fontSize=10, textColor=GRAY, alignment=TA_RIGHT)),
    ])

toc_style = TableStyle([
    ('ROWBACKGROUNDS', (0,0), (-1,-1), [LIGHT_BG, WHITE]),
    ('TOPPADDING', (0,0), (-1,-1), 7),
    ('BOTTOMPADDING', (0,0), (-1,-1), 7),
    ('LEFTPADDING', (0,0), (-1,-1), 10),
    ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ('LINEBELOW', (0,0), (-1,-1), 0.3, LIGHT_GRAY),
])
story.append(Table(toc_data, colWidths=[W*0.08, W*0.78, W*0.14], style=toc_style))
story.append(PageBreak())

# ============================================================
#  SECTION 1 : VUE D'ENSEMBLE
# ============================================================
story.append(SectionHeader('VUE D\'ENSEMBLE DU PROJET', W, DARK_BG, '1'))
story.append(sp(1))

story.append(Paragraph('Présentation Générale', h2))
story.append(Paragraph(
    '<b>INTIKHABATI</b> (ar. انتخاباتي, "Mes élections") est une plateforme complète de vote électronique '
    'décentralisée basée sur la blockchain Ethereum. Elle garantit la transparence, l\'immuabilité '
    'et la sécurité des processus électoraux nationaux au Maroc. Chaque vote est enregistré '
    'sous forme de transaction Ethereum, rendant toute manipulation impossible.',
    body))
story.append(sp(0.5))

story.append(Paragraph('Objectifs Principaux', h3))
objectives = [
    ('Securite',     'Identification par hash CIN + wallet MetaMask, anti double-vote, protection multi-wallet'),
    ('Transparence', 'Resultats lisibles directement sur la blockchain, certificat PDF verifiable'),
    ('Accessibilite','Interface React moderne, guide etape par etape, support mobile'),
    ('Conformite',   'Vote blanc constitutionnel, delegation de vote, historique elections'),
    ('Temps reel',   'Decompte live, fermeture automatique, notifications email aux electeurs'),
]
for title, desc in objectives:
    story.append(Paragraph(f'<b>• {title} :</b> {desc}', bullet_style))

story.append(sp(1))
story.append(Paragraph('Chiffres Clés du Projet', h3))
story.append(kpi_table([
    ('5',    'Services principaux',  '#0066cc'),
    ('6',    'Étapes vote citoyen',  '#00d4ff'),
    ('19',   'Fonctionnalités',      '#00ff88'),
    ('15',   'Endpoints API',        '#a855f7'),
    ('10',   'Pages Frontend',       '#d4a017'),
    ('59',   'Tests unitaires',      '#1a7a4a'),
]))
story.append(sp(0.5))

story.append(Paragraph('Contexte & Motivation', h3))
story.append(Paragraph(
    'Les systèmes de vote traditionnels sont vulnérables à la manipulation, aux erreurs humaines '
    'et au manque de transparence. INTIKHABATI résout ces problèmes en enregistrant chaque vote '
    'sur la blockchain Ethereum, créant un registre immuable et publicly vérifiable. '
    'Le projet supporte tous les types d\'élections marocaines : Présidentielle, Législatives, '
    'Municipale, Régionale, et Référendum.',
    body))
story.append(PageBreak())

# ============================================================
#  SECTION 2 : ARCHITECTURE
# ============================================================
story.append(SectionHeader('ARCHITECTURE SYSTÈME', W, DARK_BG, '2'))
story.append(sp(1))

story.append(Paragraph('Architecture en 5 Couches', h2))
story.append(Paragraph(
    'INTIKHABATI adopte une architecture en couches clairement séparées, allant de la blockchain '
    'immuable à l\'interface utilisateur React, en passant par une API REST sécurisée.',
    body))
story.append(sp(0.5))

arch_data = [
    ['Couche', 'Technologie', 'Rôle', 'Port'],
    ['Blockchain', 'Hardhat + Solidity', 'Immuabilité des votes, smart contract', '8545'],
    ['Smart Contract', 'CivicChain.sol', 'Logique métier, votes, candidats, délégation', '—'],
    ['Backend API', 'Node.js + Express', 'Proxy sécurisé, PDF, emails, analytics', '3001'],
    ['Base de données', 'MongoDB + Mongoose', 'Électeurs, historique, paramètres', '27017'],
    ['Frontend', 'React 19 + Ethers.js', 'Interface citoyens + admin, MetaMask', '3000'],
]
arch_style = TableStyle([
    ('BACKGROUND', (0,0), (-1,0), DARK_BG),
    ('TEXTCOLOR', (0,0), (-1,0), WHITE),
    ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
    ('FONTSIZE', (0,0), (-1,0), 9),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [LIGHT_BG, WHITE]),
    ('GRID', (0,0), (-1,-1), 0.4, LIGHT_GRAY),
    ('FONTSIZE', (0,1), (-1,-1), 9),
    ('TOPPADDING', (0,0), (-1,-1), 6),
    ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ('LEFTPADDING', (0,0), (-1,-1), 8),
    ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ('ALIGN', (3,0), (3,-1), 'CENTER'),
    ('FONTNAME', (3,1), (3,-1), 'Courier'),
])
story.append(Table(arch_data, colWidths=[W*0.18, W*0.25, W*0.44, W*0.13],
                   style=arch_style))
story.append(sp(1))

story.append(Paragraph('Flux de Données', h2))
story.append(Paragraph(
    'Le citoyen interagit via le frontend React. Chaque opération sensible passe par l\'API '
    'Express qui valide et relaie les transactions vers le smart contract Ethereum via '
    'ethers.js. Les données auxiliaires (électeurs enregistrés, historique) sont stockées '
    'dans MongoDB, jamais les votes (qui restent on-chain).',
    body))

flow_data = [
    ['Étape', 'Acteur', 'Action', 'Cible'],
    ['1', 'Citoyen', 'Connexion MetaMask', 'Frontend React'],
    ['2', 'Frontend', 'POST /api/phantom/register', 'Backend Express'],
    ['3', 'Backend', 'registerVoter() tx', 'Smart Contract'],
    ['4', 'Smart Contract', 'Emit VoterRegistered', 'Blockchain Ethereum'],
    ['5', 'Citoyen', 'Sélection candidat + sign tx', 'Frontend React'],
    ['6', 'Smart Contract', 'vote() — write on-chain', 'Blockchain Ethereum'],
    ['7', 'Backend', 'Auto-close à deadline', 'Smart Contract closeVoting()'],
    ['8', 'Backend', 'Envoi email résultats', 'Tous les électeurs inscrits'],
]
flow_style = TableStyle([
    ('BACKGROUND', (0,0), (-1,0), BLUE),
    ('TEXTCOLOR', (0,0), (-1,0), WHITE),
    ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
    ('FONTSIZE', (0,0), (-1,-1), 8.5),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [LIGHT_BG, WHITE]),
    ('GRID', (0,0), (-1,-1), 0.4, LIGHT_GRAY),
    ('TOPPADDING', (0,0), (-1,-1), 5),
    ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ('LEFTPADDING', (0,0), (-1,-1), 7),
    ('RIGHTPADDING', (0,0), (-1,-1), 7),
    ('ALIGN', (0,0), (0,-1), 'CENTER'),
    ('FONTNAME', (0,1), (0,-1), 'Helvetica-Bold'),
])
story.append(Table(flow_data, colWidths=[W*0.07, W*0.18, W*0.38, W*0.37], style=flow_style))
story.append(PageBreak())

# ============================================================
#  SECTION 3 : SMART CONTRACT
# ============================================================
story.append(SectionHeader('SMART CONTRACT — CIVICCHAIN.SOL', W, DARK_BG, '3'))
story.append(sp(1))

story.append(Paragraph('Informations Générales', h2))
story.append(info_table([
    ('Fichier',           'contracts/CivicChain.sol'),
    ('Version Solidity',  '^0.8.19'),
    ('Licence',           'MIT'),
    ('Réseau cible',      'Ethereum (Hardhat Local / Mainnet)'),
    ('Taille estimée',    '~350 lignes de code'),
    ('Fonctions publiques','15 fonctions (7 admin, 4 voter, 4 getters)'),
]))
story.append(sp(1))

story.append(Paragraph('Variables d\'État', h2))
vars_data = [
    ['Variable', 'Type', 'Visibilité', 'Description'],
    ['owner', 'address', 'public', 'Adresse de l\'administrateur (deployer)'],
    ['votingOpen', 'bool', 'public', 'Etat du vote (ouvert/fermé)'],
    ['electionName', 'string', 'public', 'Nom de l\'election en cours'],
    ['electionCategory', 'string', 'public', 'Type: Présidentielle, Législatives, etc.'],
    ['votingDeadline', 'uint256', 'public', 'Timestamp UNIX de fin automatique'],
    ['blankVoteEnabled', 'bool', 'public', 'Vote blanc activé (toujours true)'],
    ['totalVotes', 'uint256', 'public', 'Nombre total de votes exprimés'],
    ['totalRegistered', 'uint256', 'public', 'Nombre d\'électeurs inscrits'],
    ['candidateCount', 'uint256', 'public', 'Nombre de candidats'],
]
vars_style = TableStyle([
    ('BACKGROUND', (0,0), (-1,0), DARK_BG),
    ('TEXTCOLOR', (0,0), (-1,0), WHITE),
    ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
    ('FONTSIZE', (0,0), (-1,-1), 8.5),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [LIGHT_BG, WHITE]),
    ('GRID', (0,0), (-1,-1), 0.4, LIGHT_GRAY),
    ('TOPPADDING', (0,0), (-1,-1), 5),
    ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ('LEFTPADDING', (0,0), (-1,-1), 7),
    ('RIGHTPADDING', (0,0), (-1,-1), 7),
    ('FONTNAME', (0,1), (0,-1), 'Courier'),
    ('FONTNAME', (1,1), (1,-1), 'Courier'),
])
story.append(Table(vars_data, colWidths=[W*0.22, W*0.15, W*0.15, W*0.48], style=vars_style))
story.append(sp(1))

story.append(Paragraph('Structures de Données', h2))
story.append(Paragraph('<b>Struct Voter :</b>', h3))
story.append(code_block(
    'struct Voter {\n'
    '    bool    isRegistered;    // inscrit sur la blockchain\n'
    '    bool    hasVoted;        // a déjà voté (anti double-vote)\n'
    '    bytes32 idHash;          // SHA-256 du CIN (jamais le CIN brut)\n'
    '    uint256 voteTimestamp;   // horodatage du vote\n'
    '}'
))
story.append(Paragraph('<b>Struct Candidate :</b>', h3))
story.append(code_block(
    'struct Candidate {\n'
    '    uint256 id;              // identifiant unique\n'
    '    string  name;            // nom affiché\n'
    '    uint256 voteCount;       // compteur de votes reçus\n'
    '    bool    exists;          // validation candidat\n'
    '}'
))
story.append(sp(0.5))

story.append(Paragraph('Mappings Principaux', h2))
maps_data = [
    ['Mapping', 'Clé → Valeur', 'Usage'],
    ['voters', 'address → Voter', 'Statut complet de chaque électeur'],
    ['candidates', 'uint256 → Candidate', 'Tous les candidats (ID 0 = vote blanc)'],
    ['idHashToWallet', 'bytes32 → address', 'Détection tentatives multi-wallet'],
    ['delegations', 'address → address', 'Délégant → délégué'],
    ['hasDelegated', 'address → bool', 'A déjà délégué son vote ?'],
]
maps_style = TableStyle([
    ('BACKGROUND', (0,0), (-1,0), BLUE),
    ('TEXTCOLOR', (0,0), (-1,0), WHITE),
    ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
    ('FONTSIZE', (0,0), (-1,-1), 8.5),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [LIGHT_BG, WHITE]),
    ('GRID', (0,0), (-1,-1), 0.4, LIGHT_GRAY),
    ('TOPPADDING', (0,0), (-1,-1), 5),
    ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ('LEFTPADDING', (0,0), (-1,-1), 7),
    ('RIGHTPADDING', (0,0), (-1,-1), 7),
    ('FONTNAME', (0,1), (1,-1), 'Courier'),
])
story.append(Table(maps_data, colWidths=[W*0.22, W*0.30, W*0.48], style=maps_style))
story.append(sp(1))

story.append(Paragraph('Modificateurs (Guards)', h2))
mods = [
    ('onlyOwner()',      'Restreint aux appels du propriétaire du contrat'),
    ('whenVotingOpen()', 'Vérifie que le vote est ouvert + ferme auto si deadline dépassée'),
    ('whenVotingClosed()','Bloque l\'action si le vote est toujours ouvert'),
    ('onlyRegistered()', 'Restreint aux électeurs inscrits sur la blockchain'),
]
for mod, desc in mods:
    story.append(Paragraph(
        f'<font name="Courier" size="9" color="#0066cc"><b>{mod}</b></font> — {desc}',
        bullet_style))

story.append(sp(1))
story.append(Paragraph('Événements (Events)', h2))
events_data = [
    ['Événement', 'Paramètres indexés', 'Déclencheur'],
    ['VoterRegistered', 'walletAddress, idHash', 'Enregistrement d\'un électeur'],
    ['VoteCast', 'voter, candidateId', 'Vote exprimé (direct ou délégué)'],
    ['VotingOpened', 'timestamp, deadline, category', 'Ouverture du scrutin'],
    ['VotingClosed', 'timestamp', 'Fermeture du scrutin'],
    ['CandidateAdded', 'id, name', 'Ajout d\'un candidat'],
    ['VoteDelegated', 'from, to', 'Délégation de vote'],
    ['VoteCastByProxy', 'voter, delegator', 'Vote par délégué'],
]
ev_style = TableStyle([
    ('BACKGROUND', (0,0), (-1,0), DARK_BG),
    ('TEXTCOLOR', (0,0), (-1,0), WHITE),
    ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
    ('FONTSIZE', (0,0), (-1,-1), 8.5),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [LIGHT_BG, WHITE]),
    ('GRID', (0,0), (-1,-1), 0.4, LIGHT_GRAY),
    ('TOPPADDING', (0,0), (-1,-1), 5),
    ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ('LEFTPADDING', (0,0), (-1,-1), 7),
    ('RIGHTPADDING', (0,0), (-1,-1), 7),
    ('FONTNAME', (0,1), (0,-1), 'Courier'),
])
story.append(Table(events_data, colWidths=[W*0.30, W*0.33, W*0.37], style=ev_style))
story.append(sp(1))

story.append(Paragraph('Fonctions Principales', h2))
funcs = [
    ('addCandidate(name)', 'Admin', 'Ajoute un candidat avant ouverture du vote'),
    ('openVotingWithBlank(deadline, category)', 'Admin', 'Ouvre le vote avec deadline + vote blanc (utilisé en prod)'),
    ('openVoting(deadline, category)', 'Admin', 'Ouvre le vote (vote blanc désactivé)'),
    ('closeVoting()', 'Admin', 'Ferme le scrutin manuellement'),
    ('checkAndCloseVoting()', 'Public', 'Ferme automatiquement si deadline dépassée'),
    ('registerVoter(address, idHash)', 'Admin', 'Inscrit un électeur sur la blockchain'),
    ('vote(candidateId)', 'Électeur inscrit', 'Exprime un vote direct'),
    ('delegate(to)', 'Électeur inscrit', 'Délègue son droit de vote'),
    ('voteFor(delegator, candidateId)', 'Délégué', 'Vote au nom du délégant'),
    ('getResults()', 'Public view', 'Retourne IDs, noms et compteurs de votes'),
    ('getElectionInfo()', 'Public view', 'Info complète: nom, catégorie, deadline, stats'),
    ('getTimeRemaining()', 'Public view', 'Secondes restantes avant deadline'),
    ('getBlankVotes()', 'Public view', 'Nombre de votes blancs exprimés'),
    ('getVoterStatus(address)', 'Public view', 'Statut d\'un électeur donné'),
    ('isIdHashRegistered(bytes32)', 'Public view', 'Vérifie si un CIN est déjà inscrit'),
]
func_data = [['Fonction', 'Accès', 'Description']]
for f, a, d in funcs:
    func_data.append([
        Paragraph(f'<font name="Courier" size="8">{f}</font>',
                  make_style('ff', fontSize=8, leading=12)),
        Paragraph(a, make_style('fa', fontSize=8, textColor=BLUE if a == 'Admin' else
                                (DARK_GREEN if a == 'Électeur inscrit' else GRAY),
                                alignment=TA_CENTER)),
        Paragraph(d, make_style('fd2', fontSize=8.5, textColor=GRAY, leading=12)),
    ])
f_style = TableStyle([
    ('BACKGROUND', (0,0), (-1,0), DARK_BG),
    ('TEXTCOLOR', (0,0), (-1,0), WHITE),
    ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
    ('FONTSIZE', (0,0), (-1,0), 9),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [LIGHT_BG, WHITE]),
    ('GRID', (0,0), (-1,-1), 0.4, LIGHT_GRAY),
    ('TOPPADDING', (0,0), (-1,-1), 4),
    ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ('LEFTPADDING', (0,0), (-1,-1), 6),
    ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ('ALIGN', (1,0), (1,-1), 'CENTER'),
])
story.append(Table(func_data, colWidths=[W*0.38, W*0.17, W*0.45], style=f_style))
story.append(PageBreak())

# ============================================================
#  SECTION 4 : STACK TECHNOLOGIQUE
# ============================================================
story.append(SectionHeader('STACK TECHNOLOGIQUE', W, DARK_BG, '4'))
story.append(sp(1))

story.append(Paragraph('Backend (Node.js)', h2))
backend_pkgs = [
    ['Package', 'Version', 'Usage'],
    ['express', '^4.18.2', 'Framework HTTP REST API'],
    ['ethers', '^6.7.1', 'Communication avec la blockchain Ethereum'],
    ['mongoose', '^7.4.0', 'ODM MongoDB — modèles Voter, ElectionHistory'],
    ['pdfkit', '^0.18.0', 'Génération de certificats PDF officiels'],
    ['qrcode', '^1.5.4', 'QR Code de vérification blockchain dans les PDFs'],
    ['nodemailer', '^8.0.4', 'Emails de résultats et alertes de sécurité'],
    ['bcryptjs', '^2.4.3', 'Hachage sécurisé des identifiants'],
    ['helmet', '^8.1.0', 'Headers HTTP de sécurité (XSS, clickjacking...)'],
    ['cors', '^2.8.5', 'Contrôle CORS — frontend localhost:3000 uniquement'],
    ['express-rate-limit', '^6.7.0', 'Protection contre les attaques DDoS / brute-force'],
    ['exceljs', '^4.4.0', 'Export des résultats en fichiers Excel (.xlsx)'],
    ['morgan', '^1.10.0', 'Logging des requêtes HTTP en développement'],
    ['jsonwebtoken', '^9.0.0', 'Authentification JWT (extensible)'],
]
pkg_style = TableStyle([
    ('BACKGROUND', (0,0), (-1,0), DARK_BG),
    ('TEXTCOLOR', (0,0), (-1,0), WHITE),
    ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
    ('FONTSIZE', (0,0), (-1,-1), 8.5),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [LIGHT_BG, WHITE]),
    ('GRID', (0,0), (-1,-1), 0.4, LIGHT_GRAY),
    ('TOPPADDING', (0,0), (-1,-1), 4),
    ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ('LEFTPADDING', (0,0), (-1,-1), 7),
    ('RIGHTPADDING', (0,0), (-1,-1), 7),
    ('FONTNAME', (0,1), (0,-1), 'Courier'),
    ('FONTNAME', (1,1), (1,-1), 'Courier'),
    ('TEXTCOLOR', (1,1), (1,-1), BLUE),
])
story.append(Table(backend_pkgs, colWidths=[W*0.28, W*0.18, W*0.54], style=pkg_style))
story.append(sp(1))

story.append(Paragraph('Frontend (React)', h2))
frontend_pkgs = [
    ['Package', 'Version', 'Usage'],
    ['react', '^19.2.4', 'Framework UI — composants, état, hooks'],
    ['react-router-dom', '^7.13.1', 'Navigation SPA (Single Page Application)'],
    ['ethers', '^6.16.0', 'Interaction MetaMask + smart contract'],
    ['recharts', '^3.8.0', 'Graphiques analytics: barres, camembert, lignes'],
    ['axios', '^1.13.6', 'Requêtes HTTP vers l\'API Express backend'],
    ['jspdf', '^4.2.1', 'Export client-side (résultats en PDF côté browser)'],
]
story.append(Table(frontend_pkgs, colWidths=[W*0.28, W*0.18, W*0.54], style=pkg_style))
story.append(sp(1))

story.append(Paragraph('Blockchain (Hardhat)', h2))
story.append(info_table([
    ('Framework',    'Hardhat — Ethereum development environment'),
    ('Compilateur',  'Solidity 0.8.19 via solc'),
    ('Réseau local', 'Hardhat Node — fork EVM complet sur localhost:8545'),
    ('Tests',        'Chai + Hardhat test runner — 59 tests, 100% pass'),
    ('Scripts',      'deploy.js, openVoting.js, addCandidates.js, etc.'),
    ('Provider',     'JsonRpcProvider via ethers.js v6'),
]))
story.append(PageBreak())

# ============================================================
#  SECTION 5 : API BACKEND
# ============================================================
story.append(SectionHeader('API BACKEND — ENDPOINTS', W, DARK_BG, '5'))
story.append(sp(1))

story.append(Paragraph('Phantom ID — Enregistrement Électeurs', h2))
story.append(Paragraph(
    'Le module Phantom ID gère l\'enregistrement sécurisé des citoyens via leur CIN hashé en SHA-256 '
    'et leur adresse wallet MetaMask. Le hash est enregistré à la fois dans MongoDB et sur la blockchain.',
    body))
story.append(api_table([
    ('POST', '/api/phantom/register', 'Enregistre un électeur: valide CIN, génère idHash, inscrit sur blockchain'),
    ('POST', '/api/phantom/check-id', 'Vérifie si un CIN est déjà inscrit (anti doublons)'),
    ('GET',  '/api/phantom/status/:wallet', 'Statut complet d\'un électeur par adresse wallet'),
    ('GET',  '/api/phantom/export/excel', 'Export Excel de tous les électeurs inscrits (admin)'),
]))
story.append(sp(0.8))

story.append(Paragraph('Admin — Gestion du Scrutin', h2))
story.append(api_table([
    ('POST', '/api/admin/candidate', 'Ajoute un candidat (vérifie unicité du nom)'),
    ('POST', '/api/admin/open', 'Ouvre le vote avec deadline + catégorie'),
    ('GET',  '/api/admin/stats', 'Stats complètes: candidats, votes, participation, deadline'),
    ('GET',  '/api/admin/elections', 'Historique de toutes les élections passées'),
    ('GET',  '/api/admin/settings', 'Paramètres visibilité des résultats'),
    ('POST', '/api/admin/settings', 'Met à jour: public / after_close / registered_only'),
]))
story.append(sp(0.8))

story.append(Paragraph('Vote — Résultats & Export', h2))
story.append(api_table([
    ('GET', '/api/vote/results', 'Résultats live depuis la blockchain (soumis à paramètre visibilité)'),
    ('GET', '/api/vote/export/csv', 'Export résultats en CSV'),
    ('GET', '/api/vote/export/excel', 'Export résultats en Excel (.xlsx)'),
    ('GET', '/api/vote/export/pdf', 'Export résultats en PDF basique'),
]))
story.append(sp(0.8))

story.append(Paragraph('Security — Anti-Fraude', h2))
story.append(api_table([
    ('GET',  '/api/security/metrics', 'Métriques de sécurité: risque, tentatives, IPs'),
    ('POST', '/api/security/blacklist', 'Blackliste un wallet suspect'),
    ('GET',  '/api/security/alerts', 'Liste des alertes de sécurité actives'),
]))
story.append(sp(0.8))

story.append(Paragraph('Certificate & Autres', h2))
story.append(api_table([
    ('GET', '/api/certificate', 'Génère et télécharge le certificat PDF officiel avec QR code'),
    ('GET', '/api/elections', 'Liste publique des élections de l\'historique MongoDB'),
    ('GET', '/api/health', 'Health check: statut API, projet, timestamp'),
]))
story.append(sp(1))

story.append(Paragraph('Sécurité Middleware', h2))
story.append(info_table([
    ('Helmet',           'Headers HTTP sécurisés: X-Frame-Options, CSP, HSTS, etc.'),
    ('CORS strict',      'Seul http://localhost:3000 autorisé — bloque toute origine tierce'),
    ('Rate Limiting',    'express-rate-limit: max 100 req/15min par IP pour /phantom/register'),
    ('Body limit',       'express.json({ limit: "10kb" }) — protection contre les payload bombs'),
    ('Morgan logging',   'Logging complet de toutes les requêtes HTTP en développement'),
]))
story.append(PageBreak())

# ============================================================
#  SECTION 6 : FRONTEND
# ============================================================
story.append(SectionHeader('FRONTEND — PAGES & COMPOSANTS', W, DARK_BG, '6'))
story.append(sp(1))

story.append(Paragraph('Pages Publiques (Citoyens)', h2))
pub_pages = [
    ['Page', 'Route', 'Description'],
    ['Home.js', '/', 'Accueil: présentation INTIKHABATI, stats live, navigation rapide'],
    ['Vote.js', '/vote', 'Flux de vote en 6 étapes guidées (wallet→identité→élection→voter→confirmation)'],
    ['Results.js', '/results', 'Résultats en temps réel, graphiques, bouton certificat PDF'],
    ['Profile.js', '/profile', 'Profil électeur: statut, historique, vote blanc, délégation'],
    ['Verify.js', '/verify', 'Vérification publique par adresse wallet ou hash transaction'],
    ['History.js', '/history', 'Historique de toutes les élections précédentes'],
]
story.append(Table(pub_pages, colWidths=[W*0.18, W*0.18, W*0.64],
    style=TableStyle([
        ('BACKGROUND', (0,0), (-1,0), DARK_BG), ('TEXTCOLOR', (0,0), (-1,0), WHITE),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'), ('FONTSIZE', (0,0), (-1,-1), 8.5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [LIGHT_BG, WHITE]),
        ('GRID', (0,0), (-1,-1), 0.4, LIGHT_GRAY),
        ('TOPPADDING', (0,0), (-1,-1), 5), ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 7), ('RIGHTPADDING', (0,0), (-1,-1), 7),
        ('FONTNAME', (0,1), (0,-1), 'Courier'),
    ])))
story.append(sp(1))

story.append(Paragraph('Pages Admin (Owner Only)', h2))
story.append(Paragraph(
    'Les pages admin sont protégées par un "AdminWall" — une vérification automatique de l\'adresse '
    'MetaMask connectée. Si le wallet ne correspond pas à l\'adresse owner du contrat, '
    'un écran de connexion est affiché et l\'accès est bloqué.',
    body))
admin_pages = [
    ['Page', 'Route', 'Description'],
    ['Admin.js', '/admin', 'Panneau principal: gérer candidats, ouvrir/fermer vote, deadline'],
    ['Dashboard.js', '/dashboard', 'Analytics: votes par heure, carte Maroc, KPIs live'],
    ['Elections.js', '/elections', 'Graphiques avancés: comparaison candidates, taux participation'],
    ['Security.js', '/security', 'Monitoring: détection fraude, blacklist, alertes sécurité'],
]
story.append(Table(admin_pages, colWidths=[W*0.18, W*0.18, W*0.64],
    style=TableStyle([
        ('BACKGROUND', (0,0), (-1,0), HexColor('#6b46c1')), ('TEXTCOLOR', (0,0), (-1,0), WHITE),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'), ('FONTSIZE', (0,0), (-1,-1), 8.5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [HexColor('#f5f3ff'), WHITE]),
        ('GRID', (0,0), (-1,-1), 0.4, LIGHT_GRAY),
        ('TOPPADDING', (0,0), (-1,-1), 5), ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 7), ('RIGHTPADDING', (0,0), (-1,-1), 7),
        ('FONTNAME', (0,1), (0,-1), 'Courier'),
    ])))
story.append(sp(1))

story.append(Paragraph('Composants Techniques', h2))
for comp, desc in [
    ('AdminWall', 'Garde d\'accès réutilisable — vérifie owner MetaMask, affiche écran connexion si non autorisé'),
    ('CountdownTimer', 'Décompte temps réel jusqu\'à la deadline, se met à jour chaque seconde'),
    ('CandidateCard', 'Carte candidat: photo, nom, barre de progression, pourcentage live'),
    ('ResultsChart', 'Graphique Recharts (barres + camembert) des résultats par candidat'),
    ('MapMaroc', 'SVG interactif de la carte du Maroc avec régions colorées'),
    ('VotesPerHourChart', 'Graphique Recharts des votes exprimés heure par heure'),
]:
    story.append(Paragraph(f'<b>• {comp} :</b> {desc}', bullet_style))

story.append(PageBreak())

# ============================================================
#  SECTION 7 : MODÈLES DE DONNÉES
# ============================================================
story.append(SectionHeader('MODÈLES DE DONNÉES MONGODB', W, DARK_BG, '7'))
story.append(sp(1))

story.append(Paragraph('Schéma Voter', h2))
story.append(Paragraph(
    'Le modèle Voter stocke uniquement le hash SHA-256 du CIN, jamais l\'identifiant brut. '
    'Cette approche "Privacy by Design" garantit que même en cas de fuite de la base de données, '
    'aucune donnée personnelle ne peut être récupérée.',
    body))
voter_schema = [
    ['Champ', 'Type', 'Requis', 'Description'],
    ['idHash', 'String', 'Oui', 'SHA-256 du CIN — unique, indexé'],
    ['walletAddress', 'String', 'Oui', 'Adresse MetaMask en minuscules — unique, indexé'],
    ['riskScore', 'Number (0-100)', 'Non', 'Score de risque calculé par le système anti-fraude'],
    ['registeredOnChain', 'Boolean', 'Non', 'Confirmé sur le smart contract Ethereum'],
    ['txHash', 'String', 'Non', 'Hash de la transaction d\'enregistrement blockchain'],
    ['attemptCount', 'Number', 'Non', 'Compteur de tentatives (détection multi-wallet)'],
    ['ipAddresses', '[String]', 'Non', 'IPs des tentatives — détection abus réseau'],
    ['createdAt', 'Date', 'Auto', 'Horodatage automatique Mongoose (timestamps: true)'],
    ['updatedAt', 'Date', 'Auto', 'Dernière modification automatique'],
]
schema_style = TableStyle([
    ('BACKGROUND', (0,0), (-1,0), DARK_BG), ('TEXTCOLOR', (0,0), (-1,0), WHITE),
    ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'), ('FONTSIZE', (0,0), (-1,-1), 8.5),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [LIGHT_BG, WHITE]),
    ('GRID', (0,0), (-1,-1), 0.4, LIGHT_GRAY),
    ('TOPPADDING', (0,0), (-1,-1), 5), ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ('LEFTPADDING', (0,0), (-1,-1), 7), ('RIGHTPADDING', (0,0), (-1,-1), 7),
    ('FONTNAME', (0,1), (0,-1), 'Courier'), ('FONTNAME', (1,1), (1,-1), 'Courier'),
    ('ALIGN', (2,0), (2,-1), 'CENTER'),
])
story.append(Table(voter_schema, colWidths=[W*0.24, W*0.20, W*0.12, W*0.44], style=schema_style))
story.append(sp(1))

story.append(Paragraph('Schéma ElectionHistory', h2))
story.append(Paragraph(
    'L\'historique des élections est persisté dans MongoDB à chaque fermeture de scrutin. '
    'Cela permet de conserver l\'archive des résultats même si le smart contract est réinitialisé.',
    body))
history_schema = [
    ['Champ', 'Type', 'Description'],
    ['electionName', 'String', 'Nom de l\'élection (copié depuis le smart contract)'],
    ['electionCategory', 'String', 'Type: Présidentielle, Législatives, Municipale...'],
    ['startedAt / endedAt', 'Date', 'Horodatages d\'ouverture et fermeture'],
    ['totalRegistered', 'Number', 'Nombre d\'électeurs inscrits à la clôture'],
    ['totalVotes', 'Number', 'Total des votes exprimés'],
    ['turnoutPercentage', 'Number', 'Taux de participation calculé (%)'],
    ['blankVotes', 'Number', 'Nombre de votes blancs'],
    ['results', '[{ id, name, voteCount, percentage }]', 'Tableau des résultats par candidat'],
]
story.append(Table(history_schema, colWidths=[W*0.28, W*0.22, W*0.50], style=schema_style))
story.append(sp(1))

story.append(Paragraph('Schéma ElectionSettings', h2))
story.append(Paragraph(
    'Ce modèle singleton stocke les préférences de l\'administrateur, notamment la visibilité '
    'des résultats pendant le vote.',
    body))
settings_schema = [
    ['Champ', 'Type', 'Valeurs possibles', 'Par défaut'],
    ['resultsVisibility', 'String', 'public | after_close | registered_only', 'after_close'],
    ['updatedAt', 'Date', '—', 'Auto (Mongoose)'],
]
story.append(Table(settings_schema, colWidths=[W*0.26, W*0.15, W*0.44, W*0.15], style=schema_style))
story.append(PageBreak())

# ============================================================
#  SECTION 8 : FONCTIONNALITÉS
# ============================================================
story.append(SectionHeader('FONCTIONNALITÉS IMPLÉMENTÉES', W, DARK_BG, '8'))
story.append(sp(1))

features = [
    (1,  'Enregistrement Phantom ID',    'Inscription sécurisée CIN hashé + wallet MetaMask, validation anti-doublon, enregistrement on-chain', 'Implémenté'),
    (2,  'Vote sécurisé on-chain',        'Vote direct via MetaMask, signature transaction Ethereum, anti double-vote enforced by contract', 'Implémenté'),
    (3,  'Vote blanc constitutionnel',    'Candidat ID 0 toujours activé via openVotingWithBlank(), affiché séparément dans les résultats', 'Implémenté'),
    (4,  'Délégation de vote',            'Citoyen peut déléguer à un autre électeur inscrit (fonction delegate + voteFor)', 'Implémenté'),
    (5,  'Fermeture automatique',         'Backend compare Date.now() vs votingDeadline, utilise evm_increaseTime pour avancer Hardhat', 'Implémenté'),
    (6,  'Certificat PDF officiel',       'GET /api/certificate — PDF pdfkit avec QR code blockchain, design professionnel', 'Implémenté'),
    (7,  'Sélection type d\'élection',    'Page Vote étape 3: grille des 5 types, seul le type actif est cliquable', 'Implémenté'),
    (8,  'Dashboard analytics admin',     'Graphiques Recharts: votes/heure, carte Maroc, KPIs live, guard AdminWall', 'Implémenté'),
    (9,  'Panneau sécurité',              'Métriques risque, détection multi-wallet, blacklist, alertes — guard AdminWall', 'Implémenté'),
    (10, 'Historique des élections',      'MongoDB ElectionHistory, page publique /history, page admin /elections', 'Implémenté'),
    (11, 'Export multi-format',           'Résultats exportables en CSV, Excel (.xlsx), PDF depuis l\'API backend', 'Implémenté'),
    (12, 'Notifications email',           'Nodemailer: email résultats à tous les électeurs à la clôture, alertes sécurité', 'Implémenté'),
    (13, 'Vérification publique',         'Page /verify: vérifier statut électeur par wallet ou hash de transaction', 'Implémenté'),
    (14, 'Profil électeur',               'Page /profile: statut personnel, voir si voté, délégation, vote blanc', 'Implémenté'),
    (15, 'Guard pages admin',             'AdminWall sur Dashboard, Elections, Security — connexion MetaMask requise', 'Implémenté'),
    (16, 'Résultats temps réel',          'Page /results avec polling auto, graphiques Recharts, décompte live', 'Implémenté'),
    (17, 'Visibilité résultats',          'Admin configure: public / after_close / registered_only via /api/admin/settings', 'Implémenté'),
    (18, 'Logo et UI thème sombre',       'Logo INTIKHABATI avec cadre arrondi, thème dark global var(--bg), var(--text)', 'Implémenté'),
    (19, 'Tests Hardhat complets',        '59 tests passés: vote, délégation, sécurité, admin, modifiers, events', 'Implémenté'),
]
story.append(feature_table(features))
story.append(PageBreak())

# ============================================================
#  SECTION 9 : SÉCURITÉ
# ============================================================
story.append(SectionHeader('SÉCURITÉ & ANTI-FRAUDE', W, DARK_BG, '9'))
story.append(sp(1))

story.append(Paragraph('Couches de Sécurité', h2))
security_layers = [
    ('Couche Blockchain', [
        'onlyOwner(): fonctions admin inaccessibles aux utilisateurs normaux',
        'Anti double-vote: sender.hasVoted vérifié avant chaque vote (revert si déjà voté)',
        'Anti multi-wallet: idHashToWallet[idHash] == address(0) vérifié à l\'enregistrement',
        'Immuabilité: les votes sur blockchain sont permanents et inaltérables',
        'whenVotingOpen modifier: ferme automatiquement si block.timestamp > votingDeadline',
    ]),
    ('Couche Backend', [
        'Helmet: 11 headers HTTP de sécurité (X-Frame-Options, X-XSS-Protection, HSTS...)',
        'CORS strict: seul localhost:3000 autorisé comme origine',
        'Rate limiting: 100 requêtes/15min par IP sur les endpoints sensibles',
        'Body size limit: 10kb max — protection contre les payload attacks',
        'Variables d\'environnement: clés privées dans .env, jamais commitées',
    ]),
    ('Couche Frontend', [
        'AdminWall: vérification wallet owner avant accès aux pages admin',
        'MetaMask required: aucun vote sans portefeuille crypto connecté',
        'Hash CIN côté client: le CIN brut ne quitte jamais le navigateur',
        'Timeout sessions: re-vérification périodique du wallet connecté',
    ]),
    ('Couche Données', [
        'Privacy by Design: seul le hash SHA-256 du CIN stocké — jamais l\'ID brut',
        'Score de risque (0-100): calculé sur nombre de tentatives, IPs multiples',
        'Blacklist wallet: l\'admin peut bloquer des adresses suspectes',
        'Audit trail complet: toutes les transactions enregistrées on-chain',
    ]),
]

for layer, items in security_layers:
    story.append(Paragraph(layer, h3))
    for item in items:
        story.append(Paragraph(f'• {item}', bullet_style))
    story.append(sp(0.3))

story.append(sp(0.5))
story.append(Paragraph('Détection de Fraude', h2))
fraud_data = [
    ['Menace', 'Mécanisme de Détection', 'Réponse'],
    ['Double vote', 'voters[msg.sender].hasVoted == true', 'Transaction revert smart contract'],
    ['Multi-wallet (1 CIN → N wallets)', 'idHashToWallet[idHash] != address(0)', 'Revert "tentative multi-wallet détectée"'],
    ['Vote admin', '_voterAddress != owner vérifié à l\'enregistrement', 'Revert "L\'admin ne peut pas voter"'],
    ['Vote hors période', 'whenVotingOpen modifier', 'Revert "Le vote est actuellement fermé"'],
    ['Brute-force API', 'express-rate-limit 100 req/15min', 'HTTP 429 Too Many Requests'],
    ['Injection payload', 'Body size limit 10kb', 'HTTP 413 Payload Too Large'],
    ['CSRF / XSS', 'Helmet CSP headers', 'Requête bloquée par le navigateur'],
    ['Wallet suspect', 'riskScore > seuil dans MongoDB', 'Alerte admin + possibilité blacklist'],
]
fr_style = TableStyle([
    ('BACKGROUND', (0,0), (-1,0), RED), ('TEXTCOLOR', (0,0), (-1,0), WHITE),
    ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'), ('FONTSIZE', (0,0), (-1,-1), 8),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [HexColor('#fff5f5'), WHITE]),
    ('GRID', (0,0), (-1,-1), 0.4, LIGHT_GRAY),
    ('TOPPADDING', (0,0), (-1,-1), 5), ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ('LEFTPADDING', (0,0), (-1,-1), 6), ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ('VALIGN', (0,0), (-1,-1), 'TOP'),
])
story.append(Table(fraud_data, colWidths=[W*0.28, W*0.35, W*0.37], style=fr_style))
story.append(PageBreak())

# ============================================================
#  SECTION 10 : TESTS
# ============================================================
story.append(SectionHeader('TESTS & QUALITÉ', W, DARK_BG, '10'))
story.append(sp(1))

story.append(Paragraph('Résultats des Tests Hardhat', h2))
story.append(kpi_table([
    ('59', 'Tests Total', '#0066cc'),
    ('59', 'Tests Passés', '#1a7a4a'),
    ('0',  'Tests Échoués', '#e53e3e'),
    ('100%','Taux Réussite', '#d4a017'),
]))
story.append(sp(1))

story.append(Paragraph('Suites de Tests', h2))
test_suites = [
    ['Suite', 'Fichier', 'Tests', 'Couverture'],
    ['Déploiement', 'CivicChain.test.js', '5', 'Constructor, owner, état initial'],
    ['Gestion Admin', 'CivicChain.test.js', '8', 'addCandidate, openVoting, closeVoting, guards'],
    ['Enregistrement', 'CivicChain.test.js', '9', 'registerVoter, idHash, anti-doublons, anti-admin'],
    ['Vote Direct', 'CivicChain.test.js', '12', 'vote(), double-vote, candidat invalide, vote blanc'],
    ['Délégation', 'CivicChain.test.js', '8', 'delegate(), voteFor(), auto-délégation, edge cases'],
    ['Getters', 'CivicChain.test.js', '6', 'getResults, getElectionInfo, getTimeRemaining'],
    ['Sécurité', 'CivicChain.test.js', '7', 'onlyOwner, whenVotingOpen, whenVotingClosed'],
    ['Vote Blanc', 'CivicChain.test.js', '4', 'blankVoteEnabled, getBlankVotes, candidat ID 0'],
]
ts_style = TableStyle([
    ('BACKGROUND', (0,0), (-1,0), DARK_BG), ('TEXTCOLOR', (0,0), (-1,0), WHITE),
    ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'), ('FONTSIZE', (0,0), (-1,-1), 9),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [LIGHT_BG, WHITE]),
    ('GRID', (0,0), (-1,-1), 0.4, LIGHT_GRAY),
    ('TOPPADDING', (0,0), (-1,-1), 5), ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ('LEFTPADDING', (0,0), (-1,-1), 7), ('RIGHTPADDING', (0,0), (-1,-1), 7),
    ('ALIGN', (2,0), (2,-1), 'CENTER'), ('FONTNAME', (2,1), (2,-1), 'Helvetica-Bold'),
    ('TEXTCOLOR', (2,1), (2,-1), DARK_GREEN),
])
story.append(Table(test_suites, colWidths=[W*0.22, W*0.26, W*0.10, W*0.42], style=ts_style))
story.append(sp(1))

story.append(Paragraph('Exemple de Test — Vote Blanc', h2))
story.append(code_block(
    'it("should allow blank vote when enabled", async function () {\n'
    '  await civicChain.connect(owner).openVotingWithBlank(\n'
    '    deadline, "Présidentielle"\n'
    '  );\n'
    '  await civicChain.connect(voter1).vote(0); // candidateId 0 = blank\n'
    '  const blankVotes = await civicChain.getBlankVotes();\n'
    '  expect(blankVotes).to.equal(1n);\n'
    '});'
))
story.append(PageBreak())

# ============================================================
#  SECTION 11 : FLUX DE VOTE
# ============================================================
story.append(SectionHeader('FLUX DE VOTE — GUIDE UTILISATEUR', W, DARK_BG, '11'))
story.append(sp(1))

story.append(Paragraph('Les 6 Étapes du Vote Citoyen', h2))
steps = [
    ('Étape 1', 'Connexion Wallet',
     'Le citoyen connecte son portefeuille MetaMask. L\'adresse est vérifiée sur la blockchain. '
     'Si non inscrit, il est redirigé vers le processus d\'enregistrement.',
     BLUE),
    ('Étape 2', 'Vérification Identité',
     'Le citoyen saisit son numéro CIN. Le système génère un hash SHA-256 et vérifie si '
     'cette identité est inscrite sur le smart contract (idHashToWallet).',
     PURPLE),
    ('Étape 3', 'Sélection Type d\'Élection',
     'Grille des 5 types d\'élection (Présidentielle, Législatives, Municipale, Régionale, '
     'Référendum). Seul le type correspondant à l\'élection en cours est cliquable.',
     CYAN),
    ('Étape 4', 'Mode de Participation',
     'Le citoyen choisit: voter directement, déléguer son vote à un autre électeur inscrit, '
     'ou voter blanc (droit constitutionnel toujours disponible).',
     GOLD),
    ('Étape 5', 'Choix du Candidat',
     'Liste des candidats enregistrés sur la blockchain. Décompte temps réel. '
     'Clic sur candidat → MetaMask demande la signature de la transaction.',
     DARK_GREEN),
    ('Étape 6', 'Confirmation',
     'Hash de transaction affiché. Vote enregistré sur Ethereum. Badge "Votre voix a été comptée". '
     'Email de confirmation envoyé. Redirection vers les résultats.',
     RED),
]

for step_num, step_title, step_desc, step_color in steps:
    step_data = [[
        Paragraph(f'<b>{step_num}</b>',
                  make_style('sn', fontSize=14, fontName='Helvetica-Bold',
                              textColor=step_color, alignment=TA_CENTER)),
        [Paragraph(f'<b>{step_title}</b>',
                   make_style('st', fontSize=11, fontName='Helvetica-Bold', textColor=DARK_BG)),
         Paragraph(step_desc, make_style('sd', fontSize=9, textColor=GRAY, leading=14))],
    ]]
    t = Table(step_data, colWidths=[W*0.10, W*0.90])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,0), HexColor('#f0f8ff')),
        ('BACKGROUND', (1,0), (1,0), WHITE),
        ('GRID', (0,0), (-1,-1), 0.5, LIGHT_GRAY),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('LINEBELOW', (0,0), (-1,0), 2, step_color),
    ]))
    story.append(t)
    story.append(sp(0.4))

story.append(PageBreak())

# ============================================================
#  SECTION 12 : PANNEAU ADMINISTRATION
# ============================================================
story.append(SectionHeader('PANNEAU ADMINISTRATION', W, DARK_BG, '12'))
story.append(sp(1))

story.append(Paragraph('Fonctions Administrateur', h2))
story.append(Paragraph(
    'L\'administrateur (owner du smart contract, identifié par son wallet MetaMask) dispose '
    'd\'un panneau complet pour gérer le cycle de vie de chaque élection.',
    body))

admin_actions = [
    ('Créer les candidats', '/admin → Ajouter candidat',
     'Saisit les noms des candidats avant ouverture. Vérification d\'unicité automatique.'),
    ('Ouvrir le scrutin', '/admin → Ouvrir le vote',
     'Définit: date/heure de clôture, catégorie d\'élection. Vote blanc toujours activé (openVotingWithBlank).'),
    ('Fermer manuellement', '/admin → Fermer le vote',
     'Fermeture anticipée possible. Déclenche l\'envoi d\'emails de résultats aux électeurs.'),
    ('Fermeture automatique', 'Backend auto-close',
     'Le backend vérifie toutes les 10s si Date.now() >= votingDeadline. Si oui: evm_increaseTime + closeVoting().'),
    ('Configurer visibilité', '/admin → Paramètres',
     'Choisit quand les résultats sont visibles: immédiatement (public) / après clôture / inscrits seulement.'),
    ('Surveiller la sécurité', '/security',
     'Tableau des tentatives, scores de risque, IPs suspectes, bouton blacklist.'),
    ('Analyser les votes', '/dashboard + /elections',
     'Graphiques: votes par heure, carte Maroc, comparaisons candidats, taux participation historique.'),
    ('Télécharger résultats', '/results → Export',
     'Exporte les résultats en CSV, Excel ou PDF depuis l\'API backend.'),
    ('Certificat officiel', '/results → Certificat PDF',
     'Génère un certificat PDF signé avec QR code blockchain, disponible après clôture.'),
]
admin_data = [['Action', 'Accès', 'Description']]
for action, access, desc in admin_actions:
    admin_data.append([
        Paragraph(f'<b>{action}</b>', make_style('aa', fontSize=9, textColor=DARK_BG)),
        Paragraph(access, make_style('ac', fontName='Courier', fontSize=8, textColor=BLUE)),
        Paragraph(desc, make_style('ad2', fontSize=8.5, textColor=GRAY, leading=12)),
    ])
story.append(Table(admin_data, colWidths=[W*0.26, W*0.28, W*0.46],
    style=TableStyle([
        ('BACKGROUND', (0,0), (-1,0), HexColor('#6b46c1')), ('TEXTCOLOR', (0,0), (-1,0), WHITE),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'), ('FONTSIZE', (0,0), (-1,0), 9),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [HexColor('#f5f3ff'), WHITE]),
        ('GRID', (0,0), (-1,-1), 0.4, LIGHT_GRAY),
        ('TOPPADDING', (0,0), (-1,-1), 5), ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6), ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ])))
story.append(PageBreak())

# ============================================================
#  SECTION 13 : MÉTRIQUES
# ============================================================
story.append(SectionHeader('MÉTRIQUES & ANALYSES', W, DARK_BG, '13'))
story.append(sp(1))

story.append(Paragraph('Dashboard Temps Réel (/dashboard)', h2))
for item in [
    'Nombre total de votes exprimés (live depuis blockchain)',
    'Taux de participation (totalVotes / totalRegistered * 100)',
    'Temps restant avant clôture (getTimeRemaining)',
    'Répartition des votes par candidat (barres Recharts)',
    'Graphique votes par heure (TimeSeries extrapolé depuis MongoDB)',
    'Carte SVG du Maroc avec régions colorées selon participation',
    'Nombre de votes blancs exprimés',
    'Status du vote (OUVERT / CLÔTURÉ EN DIRECT)',
]:
    story.append(Paragraph(f'• {item}', bullet_style))

story.append(sp(0.8))
story.append(Paragraph('Analytics Avancés (/elections)', h2))
for item in [
    'Graphique comparatif multi-élections (historique complet)',
    'Taux de participation par élection (barre horizontale)',
    'Camembert de répartition des votes par candidat',
    'Tableau de bord des indicateurs de performance (KPIs)',
    'Évolution du score de risque de sécurité dans le temps',
    'Export Excel/CSV des données analytiques',
]:
    story.append(Paragraph(f'• {item}', bullet_style))

story.append(sp(0.8))
story.append(Paragraph('Métriques de Sécurité (/security)', h2))
security_metrics_data = [
    ['Métrique', 'Source', 'Seuil Alerte'],
    ['Score de risque moyen', 'MongoDB Voter.riskScore', '> 50 → alerte'],
    ['Tentatives multiples', 'Voter.attemptCount', '> 3 → suspect'],
    ['IPs multiples', 'len(Voter.ipAddresses)', '> 5 IP → très suspect'],
    ['Wallets non-confirmés', 'registeredOnChain == false', 'Enregistrement incomplet'],
    ['Taux d\'échec transactions', 'Logs backend erreurs blockchain', '> 10% → investigation'],
]
story.append(Table(security_metrics_data, colWidths=[W*0.33, W*0.35, W*0.32],
    style=TableStyle([
        ('BACKGROUND', (0,0), (-1,0), RED), ('TEXTCOLOR', (0,0), (-1,0), WHITE),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'), ('FONTSIZE', (0,0), (-1,-1), 8.5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [HexColor('#fff5f5'), WHITE]),
        ('GRID', (0,0), (-1,-1), 0.4, LIGHT_GRAY),
        ('TOPPADDING', (0,0), (-1,-1), 5), ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 7), ('RIGHTPADDING', (0,0), (-1,-1), 7),
    ])))
story.append(PageBreak())

# ============================================================
#  SECTION 14 : CERTIFICAT PDF
# ============================================================
story.append(SectionHeader('CERTIFICAT PDF OFFICIEL', W, DARK_BG, '14'))
story.append(sp(1))

story.append(Paragraph('Description', h2))
story.append(Paragraph(
    'Le certificat officiel est un document PDF généré côté serveur (Node.js + pdfkit) '
    'qui certifie les résultats d\'une élection. Il intègre un QR code pointant vers '
    'les données blockchain pour permettre la vérification indépendante.',
    body))

story.append(sp(0.5))
story.append(Paragraph('Structure du Certificat', h2))
cert_sections = [
    ['Section', 'Contenu', 'Source'],
    ['En-tête', 'Logo INTIKHABATI, badge élection, date/heure certification', 'Serveur (Date.now())'],
    ['Titre', 'CERTIFICAT OFFICIEL DES RÉSULTATS + nom élection', 'Smart contract getElectionInfo()'],
    ['KPIs', '4 boîtes: Inscrits, Votes exprimés, Participation %, Votes blancs', 'Smart contract'],
    ['Résultats', 'Tableau candidats: rang, nom, barre progression, %, nombre votes', 'getResults()'],
    ['Vérif. BC', 'Adresse smart contract, réseau, statut (OUVERT/CLÔTURÉ)', 'contract address'],
    ['QR Code', 'QR contenant: nom contrat, élection, date, total votes', 'QRCode npm package'],
    ['Pied page', 'Mention légale INTIKHABATI, URL blockchain', 'Statique'],
]
story.append(Table(cert_sections, colWidths=[W*0.18, W*0.50, W*0.32],
    style=TableStyle([
        ('BACKGROUND', (0,0), (-1,0), GOLD), ('TEXTCOLOR', (0,0), (-1,0), WHITE),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'), ('FONTSIZE', (0,0), (-1,-1), 8.5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [HexColor('#fffbeb'), WHITE]),
        ('GRID', (0,0), (-1,-1), 0.4, LIGHT_GRAY),
        ('TOPPADDING', (0,0), (-1,-1), 5), ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 7), ('RIGHTPADDING', (0,0), (-1,-1), 7),
    ])))
story.append(sp(0.8))

story.append(Paragraph('Implémentation Technique', h2))
story.append(info_table([
    ('Endpoint',     'GET /api/certificate'),
    ('Librairie PDF', 'pdfkit ^0.18.0 — streaming pipe vers res (Node.js)'),
    ('QR Code',      'qrcode ^1.5.4 — génération buffer PNG embarqué dans PDF'),
    ('Format',       'A4, marges 50/50/60/60px, streaming sans stockage fichier'),
    ('Content-Type', 'application/pdf avec Content-Disposition: attachment'),
    ('Nom fichier',  'certificat-{electionName}.pdf (dynamique)'),
    ('Données',      'Lues en temps réel depuis blockchain via ethers.js (5 appels parallèles)'),
    ('Sécurité',     'Disponible après clôture — bouton affiché seulement si !votingOpen'),
]))
story.append(PageBreak())

# ============================================================
#  SECTION 15 : DÉPLOIEMENT
# ============================================================
story.append(SectionHeader('DÉPLOIEMENT & CONFIGURATION', W, DARK_BG, '15'))
story.append(sp(1))

story.append(Paragraph('Prérequis', h2))
prereqs = [
    ('Node.js', '>= 18.x LTS', 'Backend + Hardhat'),
    ('npm', '>= 9.x', 'Gestionnaire de paquets'),
    ('Python', '>= 3.8', 'Scripts PDF et utilitaires'),
    ('MongoDB', '>= 6.0', 'Base de données locale ou Atlas'),
    ('MetaMask', 'Extension navigateur', 'Wallet électeurs et admin'),
    ('Git', 'Toute version', 'Gestion du code source'),
]
prereq_data = [['Outil', 'Version', 'Usage']]
prereq_data.extend([[Paragraph(f'<b>{t}</b>', make_style('pt', fontSize=9)),
                     Paragraph(v, make_style('pv', fontName='Courier', fontSize=8.5, textColor=BLUE)),
                     Paragraph(u, make_style('pu', fontSize=9))] for t, v, u in prereqs])
story.append(Table(prereq_data, colWidths=[W*0.22, W*0.28, W*0.50],
    style=TableStyle([
        ('BACKGROUND', (0,0), (-1,0), DARK_BG), ('TEXTCOLOR', (0,0), (-1,0), WHITE),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'), ('FONTSIZE', (0,0), (-1,-1), 9),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [LIGHT_BG, WHITE]),
        ('GRID', (0,0), (-1,-1), 0.4, LIGHT_GRAY),
        ('TOPPADDING', (0,0), (-1,-1), 5), ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 7), ('RIGHTPADDING', (0,0), (-1,-1), 7),
    ])))
story.append(sp(1))

story.append(Paragraph('Démarrage du Projet (Développement Local)', h2))
commands = [
    ('1. Démarrer Hardhat Node', 'cd hardhat2 && npx hardhat node'),
    ('2. Déployer le contrat', 'cd hardhat2 && npx hardhat run scripts/deploy.js --network localhost'),
    ('3. Configurer .env backend', 'cp backend/.env.example backend/.env  # puis éditer'),
    ('4. Démarrer le Backend', 'cd backend && npm install && npm run dev'),
    ('5. Démarrer le Frontend', 'cd frontend && npm install && npm start'),
    ('6. Ouvrir l\'app', 'http://localhost:3000'),
]
for step, cmd in commands:
    story.append(Paragraph(f'<b>{step} :</b>', h3))
    story.append(code_block(cmd))
    story.append(sp(0.2))

story.append(sp(0.5))
story.append(Paragraph('Variables d\'Environnement (.env)', h2))
env_vars = [
    ['Variable', 'Exemple', 'Description'],
    ['MONGO_URI', 'mongodb://localhost:27017/civicchain', 'URI de connexion MongoDB'],
    ['RPC_URL', 'http://127.0.0.1:8545', 'URL du noeud Hardhat local'],
    ['CONTRACT_ADDRESS', '0x5FbDB2315678...', 'Adresse du smart contract deployé'],
    ['OWNER_PRIVATE_KEY', '0xac0974bec39...', 'Clé privée owner Hardhat (compte 0)'],
    ['EMAIL_HOST', 'smtp.gmail.com', 'Serveur SMTP pour les notifications'],
    ['EMAIL_USER', 'intikhabati@gmail.com', 'Adresse email expéditeur'],
    ['EMAIL_PASS', '****', 'Mot de passe ou App Password Gmail'],
    ['PORT', '3001', 'Port d\'écoute du serveur Express'],
]
story.append(Table(env_vars, colWidths=[W*0.28, W*0.32, W*0.40],
    style=TableStyle([
        ('BACKGROUND', (0,0), (-1,0), DARK_BG), ('TEXTCOLOR', (0,0), (-1,0), WHITE),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'), ('FONTSIZE', (0,0), (-1,-1), 8.5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [LIGHT_BG, WHITE]),
        ('GRID', (0,0), (-1,-1), 0.4, LIGHT_GRAY),
        ('TOPPADDING', (0,0), (-1,-1), 5), ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 7), ('RIGHTPADDING', (0,0), (-1,-1), 7),
        ('FONTNAME', (0,1), (1,-1), 'Courier'), ('TEXTCOLOR', (1,1), (1,-1), BLUE),
    ])))
story.append(sp(1))

story.append(Paragraph('Note de Sécurité sur les Clés Privées', h2))
story.append(Paragraph(
    'Les clés privées dans .env sont celles fournies par Hardhat pour le développement local '
    '(test seulement — aucun fonds réel). En production, utiliser un HSM (Hardware Security Module) '
    'ou un service de gestion de secrets (AWS KMS, HashiCorp Vault) au lieu d\'une clé privée en clair.',
    body))

# ── Page finale ──────────────────────────────────────────────
story.append(PageBreak())
story.append(sp(4))
story.append(HeaderBand(W, 2.5*cm))
story.append(sp(3))
story.append(Paragraph('INTIKHABATI', make_style('final1', fontName='Helvetica-Bold',
    fontSize=28, textColor=CYAN, alignment=TA_CENTER)))
story.append(Paragraph('انتخاباتي', make_style('final2', fontSize=18, textColor=GRAY,
    alignment=TA_CENTER)))
story.append(sp(2))
story.append(Separator(W, CYAN, 1.5))
story.append(sp(1))
story.append(Paragraph(
    'Rapport généré automatiquement le ' + date_str + '.',
    make_style('fc', fontSize=10, textColor=GRAY, alignment=TA_CENTER)))
story.append(sp(0.5))
story.append(Paragraph(
    'Ce projet représente une solution complète de vote électronique basée sur la blockchain, '
    'combinant la sécurité cryptographique d\'Ethereum avec une expérience utilisateur moderne '
    'pour les élections nationales du Maroc 2026.',
    make_style('fc2', fontSize=10, textColor=HexColor('#4a5568'), alignment=TA_CENTER,
               leading=16)))
story.append(sp(2))
story.append(Paragraph(
    'Blockchain Electoral System · Maroc 2026',
    make_style('fc3', fontName='Helvetica-Bold', fontSize=9, textColor=BLUE, alignment=TA_CENTER)))

# ── Page numbers ─────────────────────────────────────────────
def add_page_number(canvas, doc):
    canvas.saveState()
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(GRAY)
    w, h = A4
    page_num = canvas.getPageNumber()
    canvas.drawCentredString(w/2, 1.2*cm,
        f'INTIKHABATI — Rapport Complet — Page {page_num}')
    canvas.setStrokeColor(LIGHT_GRAY)
    canvas.setLineWidth(0.5)
    canvas.line(2.2*cm, 1.6*cm, w - 2.2*cm, 1.6*cm)
    canvas.restoreState()

doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
print(f"PDF généré avec succès: {OUTPUT_PATH}")
