# -*- coding: utf-8 -*-
"""
Cahier des charges — CivicChain / Intikhabati
Design: Marocain royal (bleu nuit + rouge impérial + or) avec zellige.
Auteurs: Ayoub LAAFAR & Kaoutar MENACERA
"""
import math
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, Color
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer,
    PageBreak, Table, TableStyle, KeepTogether, Flowable,
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib.units import cm, mm

# ═════════════════════════════════════════════════════════════
#  PALETTE — MAROC ROYAL
# ═════════════════════════════════════════════════════════════
NAVY       = HexColor("#0A1F3A")  # Bleu nuit (autorité)
IMPERIAL   = HexColor("#8B0000")  # Rouge impérial marocain
GOLD       = HexColor("#B8860B")  # Or patiné
GOLD_LIGHT = HexColor("#D4AF37")
CREAM      = HexColor("#FAF6EC")  # Parchemin
INK        = HexColor("#1A1A1A")
GRAY       = HexColor("#4A4A4A")
LIGHT_GRAY = HexColor("#8A8A8A")
ACCENT     = HexColor("#2C5F7F")  # Bleu atlas
PARCHMENT  = HexColor("#F5EFE0")

PAGE_W, PAGE_H = A4

# ═════════════════════════════════════════════════════════════
#  MOTIFS GÉOMÉTRIQUES (ZELLIGE)
# ═════════════════════════════════════════════════════════════

def draw_eight_point_star(c, cx, cy, r, color, line_width=0.8, fill=False):
    """Étoile à 8 branches — motif zellige classique (khatem)."""
    c.saveState()
    c.setStrokeColor(color)
    c.setLineWidth(line_width)
    if fill:
        c.setFillColor(color)
    pts = []
    for i in range(16):
        angle = math.pi / 8 * i - math.pi / 2
        rr = r if i % 2 == 0 else r * 0.414
        pts.append((cx + rr * math.cos(angle), cy + rr * math.sin(angle)))
    p = c.beginPath()
    p.moveTo(*pts[0])
    for pt in pts[1:]:
        p.lineTo(*pt)
    p.close()
    if fill:
        c.drawPath(p, stroke=1, fill=1)
    else:
        c.drawPath(p, stroke=1, fill=0)
    c.restoreState()

def draw_interlaced_star(c, cx, cy, r, color):
    """Étoile + carré entrelacés (motif classique marocain)."""
    c.saveState()
    c.setStrokeColor(color)
    c.setLineWidth(0.6)
    # Carré rotation 0
    s = r * 0.9
    c.rect(cx - s/2, cy - s/2, s, s, stroke=1, fill=0)
    # Carré rotation 45
    c.saveState()
    c.translate(cx, cy)
    c.rotate(45)
    c.rect(-s/2, -s/2, s, s, stroke=1, fill=0)
    c.restoreState()
    # Cercle central
    c.circle(cx, cy, r * 0.25, stroke=1, fill=0)
    c.restoreState()

def draw_arabesque_separator(c, cx, cy, width=14*cm, color=GOLD):
    """Séparateur zellige horizontal avec étoile centrale et lignes."""
    c.saveState()
    c.setStrokeColor(color)
    c.setLineWidth(0.5)
    # Ligne gauche
    c.line(cx - width/2, cy, cx - 12, cy)
    # Ligne droite
    c.line(cx + 12, cy, cx + width/2, cy)
    # Étoile centrale
    draw_eight_point_star(c, cx, cy, 8, color, line_width=0.8)
    # Petits losanges latéraux
    for dx in [-width/2 - 4, width/2 + 4]:
        c.saveState()
        c.translate(cx + dx, cy)
        c.rotate(45)
        c.rect(-2, -2, 4, 4, stroke=1, fill=0)
        c.restoreState()
    c.restoreState()

def draw_corner_ornament(c, x, y, size, color, rotation=0):
    """Ornement d'angle — arc + triangle."""
    c.saveState()
    c.translate(x, y)
    c.rotate(rotation)
    c.setStrokeColor(color)
    c.setLineWidth(0.6)
    # Triangle
    p = c.beginPath()
    p.moveTo(0, 0)
    p.lineTo(size, 0)
    p.lineTo(0, size)
    p.close()
    c.drawPath(p, stroke=1, fill=0)
    # Arc intérieur
    c.arc(0 - size*0.3, 0 - size*0.3, size*0.3, size*0.3, 0, 90)
    # Petit carré
    c.rect(size*0.2, size*0.2, 3, 3, stroke=1, fill=0)
    c.restoreState()

def draw_moroccan_border(c, page_color=None):
    """Double bordure décorative autour de la page."""
    c.saveState()
    if page_color:
        c.setFillColor(page_color)
        c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    # Bordure externe dorée fine
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.4)
    c.rect(12*mm, 12*mm, PAGE_W - 24*mm, PAGE_H - 24*mm, stroke=1, fill=0)
    # Bordure interne
    c.setLineWidth(0.25)
    c.rect(15*mm, 15*mm, PAGE_W - 30*mm, PAGE_H - 30*mm, stroke=1, fill=0)
    # Petits carrés aux 4 coins
    for cx, cy in [(12*mm, 12*mm), (PAGE_W-12*mm, 12*mm),
                   (12*mm, PAGE_H-12*mm), (PAGE_W-12*mm, PAGE_H-12*mm)]:
        c.setFillColor(GOLD)
        c.rect(cx - 1.5, cy - 1.5, 3, 3, stroke=0, fill=1)
    c.restoreState()

def draw_page_header(c, chapter_num, chapter_title):
    """Bandeau supérieur : N° chapitre + titre discret."""
    c.saveState()
    # Ligne dorée fine
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.4)
    c.line(20*mm, PAGE_H - 22*mm, PAGE_W - 20*mm, PAGE_H - 22*mm)
    # Étoile gauche
    draw_eight_point_star(c, 23*mm, PAGE_H - 22*mm, 3, GOLD)
    # Texte chapitre à droite
    c.setFillColor(GRAY)
    c.setFont("Helvetica", 7)
    header_text = f"CH. {chapter_num}  ·  {chapter_title.upper()}"
    c.drawRightString(PAGE_W - 20*mm - 8, PAGE_H - 20*mm, header_text)
    c.restoreState()

def draw_page_footer(c, page_num):
    """Pied de page : n° page encadré + mention auteurs."""
    c.saveState()
    y = 18*mm
    # Ligne dorée
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.4)
    c.line(20*mm, y + 6, PAGE_W - 20*mm, y + 6)
    # Numéro de page dans un losange
    cx = PAGE_W / 2
    c.saveState()
    c.translate(cx, y - 1)
    c.rotate(45)
    c.setFillColor(NAVY)
    c.rect(-5, -5, 10, 10, stroke=0, fill=1)
    c.restoreState()
    c.setFillColor(CREAM)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(cx, y - 3, str(page_num))
    # Mention gauche
    c.setFillColor(GRAY)
    c.setFont("Helvetica", 7)
    c.drawString(20*mm, y - 3, "INTIKHABATI · Cahier des charges")
    # Mention droite
    c.drawRightString(PAGE_W - 20*mm, y - 3, "Laafar · Menacera · 2026")
    c.restoreState()

# ═════════════════════════════════════════════════════════════
#  FLOWABLES PERSONNALISÉS
# ═════════════════════════════════════════════════════════════

class ZelligeSeparator(Flowable):
    """Séparateur zellige entre sections."""
    def __init__(self, width=14*cm, color=GOLD):
        Flowable.__init__(self)
        self.width = width
        self.color = color
        self.height = 16
    def draw(self):
        draw_arabesque_separator(self.canv, self.width/2, 8, self.width, self.color)

class ChapterTitle(Flowable):
    """Titre de chapitre avec numéro en médaillon."""
    def __init__(self, number, title, subtitle=""):
        Flowable.__init__(self)
        self.number = number
        self.title = title
        self.subtitle = subtitle
        self.width = 16*cm
        self.height = 70
    def draw(self):
        c = self.canv
        # Médaillon circulaire avec numéro
        c.saveState()
        c.setFillColor(NAVY)
        c.circle(20, 30, 18, stroke=0, fill=1)
        # Anneau doré
        c.setStrokeColor(GOLD)
        c.setLineWidth(1.2)
        c.circle(20, 30, 18, stroke=1, fill=0)
        c.circle(20, 30, 14, stroke=1, fill=0)
        # Numéro
        c.setFillColor(GOLD_LIGHT)
        c.setFont("Helvetica-Bold", 16)
        c.drawCentredString(20, 25, str(self.number).zfill(2))
        # Titre
        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", 20)
        c.drawString(50, 35, self.title)
        # Sous-titre
        if self.subtitle:
            c.setFillColor(IMPERIAL)
            c.setFont("Helvetica-Oblique", 10)
            c.drawString(50, 20, self.subtitle)
        # Ligne décorative
        c.setStrokeColor(GOLD)
        c.setLineWidth(1.2)
        c.line(50, 12, self.width, 12)
        c.setLineWidth(0.4)
        c.line(50, 9, self.width, 9)
        c.restoreState()

class SectionTitle(Flowable):
    """Titre de section (H2) avec pavé coloré à gauche."""
    def __init__(self, text, color=IMPERIAL):
        Flowable.__init__(self)
        self.text = text
        self.color = color
        self.width = 16*cm
        self.height = 22
    def draw(self):
        c = self.canv
        # Pavé gauche
        c.setFillColor(self.color)
        c.rect(0, 4, 4, 14, stroke=0, fill=1)
        # Petit carré doré décoratif
        c.setFillColor(GOLD)
        c.rect(8, 8, 3, 3, stroke=0, fill=1)
        # Texte
        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", 13)
        c.drawString(18, 7, self.text)

class SubsectionTitle(Flowable):
    """Titre H3 avec petite étoile."""
    def __init__(self, text):
        Flowable.__init__(self)
        self.text = text
        self.width = 16*cm
        self.height = 16
    def draw(self):
        c = self.canv
        draw_eight_point_star(c, 6, 8, 4, GOLD, line_width=0.6, fill=True)
        c.setFillColor(IMPERIAL)
        c.setFont("Helvetica-Bold", 10.5)
        c.drawString(16, 5, self.text.upper())

class InfoBox(Flowable):
    """Encadré d'information avec bordure dorée."""
    def __init__(self, text, label="NOTE", bg=PARCHMENT, border=GOLD, height=45):
        Flowable.__init__(self)
        self.text = text
        self.label = label
        self.bg = bg
        self.border = border
        self.width = 16*cm
        self.height = height
    def draw(self):
        c = self.canv
        c.setFillColor(self.bg)
        c.setStrokeColor(self.border)
        c.setLineWidth(0.6)
        c.rect(0, 0, self.width, self.height, stroke=1, fill=1)
        # Label en haut gauche
        c.setFillColor(IMPERIAL)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(8, self.height - 12, f"◆ {self.label}")
        # Texte
        c.setFillColor(INK)
        c.setFont("Helvetica", 9)
        # Wrap text (approximatif)
        from reportlab.lib.utils import simpleSplit
        lines = simpleSplit(self.text, "Helvetica", 9, self.width - 16)
        y = self.height - 24
        for line in lines:
            c.drawString(8, y, line)
            y -= 11

# ═════════════════════════════════════════════════════════════
#  STYLES DE PARAGRAPHE
# ═════════════════════════════════════════════════════════════

def make_styles():
    return {
        'body': ParagraphStyle(
            'body', fontName='Helvetica', fontSize=10, leading=15,
            textColor=INK, alignment=TA_JUSTIFY, spaceAfter=8,
        ),
        'body_center': ParagraphStyle(
            'body_center', fontName='Helvetica', fontSize=10, leading=15,
            textColor=INK, alignment=TA_CENTER, spaceAfter=8,
        ),
        'body_bold': ParagraphStyle(
            'body_bold', fontName='Helvetica-Bold', fontSize=10, leading=15,
            textColor=NAVY, alignment=TA_JUSTIFY, spaceAfter=8,
        ),
        'quote': ParagraphStyle(
            'quote', fontName='Helvetica-Oblique', fontSize=10, leading=16,
            textColor=GRAY, alignment=TA_CENTER, leftIndent=30, rightIndent=30,
            spaceAfter=12,
        ),
        'bullet': ParagraphStyle(
            'bullet', fontName='Helvetica', fontSize=10, leading=14,
            textColor=INK, leftIndent=18, bulletIndent=6, spaceAfter=4,
        ),
        'toc_entry': ParagraphStyle(
            'toc_entry', fontName='Helvetica', fontSize=11, leading=20,
            textColor=INK,
        ),
        'small': ParagraphStyle(
            'small', fontName='Helvetica', fontSize=8, leading=11,
            textColor=GRAY, alignment=TA_JUSTIFY,
        ),
        'cover_subtitle': ParagraphStyle(
            'cover_subtitle', fontName='Helvetica-Oblique', fontSize=13,
            textColor=GOLD_LIGHT, alignment=TA_CENTER, leading=18,
        ),
    }

# ═════════════════════════════════════════════════════════════
#  PAGE DE COUVERTURE (dessinée directement sur canvas)
# ═════════════════════════════════════════════════════════════

LOGO_PATH = r"C:\Users\Windows\Desktop\civicchain\frontend\public\logo.png"
FLAG_PATH = r"C:\Users\Windows\Desktop\civicchain\frontend\public\drapeaumaroc.png"

def draw_cover(c):
    # Fond bleu nuit
    c.setFillColor(NAVY)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)

    # Bordure dorée
    c.setStrokeColor(GOLD)
    c.setLineWidth(1.2)
    c.rect(15*mm, 15*mm, PAGE_W - 30*mm, PAGE_H - 30*mm, stroke=1, fill=0)
    c.setLineWidth(0.4)
    c.rect(18*mm, 18*mm, PAGE_W - 36*mm, PAGE_H - 36*mm, stroke=1, fill=0)

    # Motifs d'angles — grandes étoiles
    for cx, cy in [(30*mm, 30*mm), (PAGE_W-30*mm, 30*mm),
                   (30*mm, PAGE_H-30*mm), (PAGE_W-30*mm, PAGE_H-30*mm)]:
        draw_eight_point_star(c, cx, cy, 10, GOLD, line_width=0.8)

    # Drapeau du Maroc — en haut à gauche et à droite (accent identité nationale)
    try:
        flag_size = 14*mm
        c.drawImage(FLAG_PATH, 28*mm, PAGE_H - 48*mm,
                    width=flag_size, height=flag_size,
                    mask='auto', preserveAspectRatio=True)
        c.drawImage(FLAG_PATH, PAGE_W - 28*mm - flag_size, PAGE_H - 48*mm,
                    width=flag_size, height=flag_size,
                    mask='auto', preserveAspectRatio=True)
    except Exception:
        pass

    # Bandeau supérieur : mention institution
    c.setFillColor(GOLD_LIGHT)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(PAGE_W/2, PAGE_H - 38*mm, "ROYAUME DU MAROC")
    c.setFillColor(GOLD)
    c.setFont("Helvetica", 7)
    c.drawCentredString(PAGE_W/2, PAGE_H - 44*mm, "· CAHIER DES CHARGES · PROJET DE FIN D'ÉTUDES ·")

    # Ligne ornée sous le bandeau
    draw_arabesque_separator(c, PAGE_W/2, PAGE_H - 56*mm, width=10*cm, color=GOLD)

    # ── Cartouche circulaire doré qui encadre le logo officiel ──
    cx, cy = PAGE_W/2, PAGE_H - 110*mm
    # Halo externe crème semi-transparent
    c.setFillColor(CREAM)
    c.circle(cx, cy, 55, stroke=0, fill=1)
    # Anneaux dorés
    c.setStrokeColor(GOLD)
    c.setLineWidth(2.0)
    c.circle(cx, cy, 55, stroke=1, fill=0)
    c.setLineWidth(0.6)
    c.circle(cx, cy, 58, stroke=1, fill=0)
    c.circle(cx, cy, 50, stroke=1, fill=0)

    # Logo officiel du projet (carte du Maroc + zellige + INTIKHABATI)
    try:
        logo_w = 95  # points
        logo_h = 75
        c.drawImage(LOGO_PATH, cx - logo_w/2, cy - logo_h/2,
                    width=logo_w, height=logo_h,
                    mask='auto', preserveAspectRatio=True)
    except Exception:
        # Fallback si l'image manque
        draw_eight_point_star(c, cx, cy, 22, IMPERIAL, line_width=1.2)

    # Petites étoiles autour du médaillon
    for angle_deg in [0, 90, 180, 270]:
        ang = math.radians(angle_deg)
        sx = cx + 68 * math.cos(ang)
        sy = cy + 68 * math.sin(ang)
        draw_eight_point_star(c, sx, sy, 5, GOLD, line_width=0.6, fill=True)

    # Sous le médaillon : nom du projet en grand (typographie dorée)
    c.setFillColor(GOLD_LIGHT)
    c.setFont("Helvetica-Bold", 34)
    c.drawCentredString(PAGE_W/2, PAGE_H - 180*mm, "INTIKHABATI")

    # Sous-titre
    c.setFillColor(CREAM)
    c.setFont("Helvetica-Oblique", 12)
    c.drawCentredString(PAGE_W/2, PAGE_H - 192*mm, "Plateforme décentralisée de vote électronique")
    c.drawCentredString(PAGE_W/2, PAGE_H - 200*mm, "basée sur la blockchain Ethereum")

    # Ligne dorée
    draw_arabesque_separator(c, PAGE_W/2, PAGE_H - 214*mm, width=8*cm, color=GOLD)

    # Auteurs
    c.setFillColor(GOLD_LIGHT)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(PAGE_W/2, PAGE_H - 227*mm, "PRÉSENTÉ PAR")
    c.setFillColor(CREAM)
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(PAGE_W/2, PAGE_H - 238*mm, "Ayoub LAAFAR")
    c.setFont("Helvetica", 10)
    c.setFillColor(GOLD)
    c.drawCentredString(PAGE_W/2, PAGE_H - 246*mm, "&")
    c.setFillColor(CREAM)
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(PAGE_W/2, PAGE_H - 254*mm, "Kaoutar MENACERA")

    # Pied de page cover
    draw_arabesque_separator(c, PAGE_W/2, 35*mm, width=6*cm, color=GOLD)
    c.setFillColor(GOLD_LIGHT)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(PAGE_W/2, 27*mm, "ANNÉE UNIVERSITAIRE 2025 — 2026")
    c.setFillColor(GOLD)
    c.setFont("Helvetica", 7)
    c.drawCentredString(PAGE_W/2, 22*mm, "Document confidentiel · Usage académique")

# ═════════════════════════════════════════════════════════════
#  PAGE DE GARDE INTERNE (avec citation)
# ═════════════════════════════════════════════════════════════

def draw_quote_page(c):
    c.setFillColor(CREAM)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    draw_moroccan_border(c)

    # Étoile centrale décorative en haut
    draw_eight_point_star(c, PAGE_W/2, PAGE_H - 70*mm, 18, IMPERIAL, line_width=1.0)
    draw_eight_point_star(c, PAGE_W/2, PAGE_H - 70*mm, 8, GOLD, line_width=0.8, fill=True)

    # Citation
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Oblique", 14)
    quote_lines = [
        "« La démocratie n'est pas l'opinion de la majorité,",
        "mais la protection de la minorité. »",
    ]
    y = PAGE_H/2 + 20
    for line in quote_lines:
        c.drawCentredString(PAGE_W/2, y, line)
        y -= 22

    c.setFillColor(IMPERIAL)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(PAGE_W/2, y - 10, "— Albert CAMUS")

    # Séparateur
    draw_arabesque_separator(c, PAGE_W/2, PAGE_H/2 - 60, width=10*cm, color=GOLD)

    # Dédicace
    c.setFillColor(GRAY)
    c.setFont("Helvetica-Oblique", 11)
    c.drawCentredString(PAGE_W/2, PAGE_H/2 - 90, "À notre patrie le Maroc,")
    c.drawCentredString(PAGE_W/2, PAGE_H/2 - 106, "et à toutes celles et ceux qui croient")
    c.drawCentredString(PAGE_W/2, PAGE_H/2 - 122, "qu'un vote honnête est un droit inaliénable.")

# ═════════════════════════════════════════════════════════════
#  PAGE DE SÉPARATION DE PARTIE (demi-page colorée)
# ═════════════════════════════════════════════════════════════

def draw_part_divider(c, part_num, title, subtitle):
    c.setFillColor(CREAM)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    # Moitié haute navy
    c.setFillColor(NAVY)
    c.rect(0, PAGE_H/2, PAGE_W, PAGE_H/2, stroke=0, fill=1)
    # Bandeau doré central
    c.setFillColor(GOLD)
    c.rect(0, PAGE_H/2 - 3, PAGE_W, 6, stroke=0, fill=1)
    # Motifs de fond
    for i in range(0, int(PAGE_W), 40):
        draw_eight_point_star(c, i, PAGE_H/2 + 15*mm, 5, GOLD, line_width=0.3)
        draw_eight_point_star(c, i, PAGE_H/2 - 15*mm, 5, GOLD, line_width=0.3)

    # Grand cercle central
    cx, cy = PAGE_W/2, PAGE_H/2
    c.setFillColor(IMPERIAL)
    c.circle(cx, cy, 50, stroke=0, fill=1)
    c.setStrokeColor(GOLD)
    c.setLineWidth(2.0)
    c.circle(cx, cy, 50, stroke=1, fill=0)
    c.setLineWidth(0.6)
    c.circle(cx, cy, 54, stroke=1, fill=0)
    c.circle(cx, cy, 44, stroke=1, fill=0)

    # Numéro de partie
    c.setFillColor(GOLD_LIGHT)
    c.setFont("Helvetica-Bold", 48)
    c.drawCentredString(cx, cy - 17, str(part_num).zfill(2))

    # Sous le cercle : label
    c.setFillColor(CREAM)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(cx, PAGE_H/2 + 75, "PARTIE")

    # Titre (en bas, sur fond crème)
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 26)
    c.drawCentredString(cx, PAGE_H/2 - 80, title.upper())
    c.setFillColor(IMPERIAL)
    c.setFont("Helvetica-Oblique", 12)
    c.drawCentredString(cx, PAGE_H/2 - 100, subtitle)

    draw_arabesque_separator(c, cx, PAGE_H/2 - 130, width=8*cm, color=GOLD)

# ═════════════════════════════════════════════════════════════
#  DOCUMENT TEMPLATE
# ═════════════════════════════════════════════════════════════

class MoroccanDocTemplate(BaseDocTemplate):
    def __init__(self, filename, **kwargs):
        BaseDocTemplate.__init__(self, filename,
                                 pagesize=A4,
                                 leftMargin=22*mm, rightMargin=22*mm,
                                 topMargin=30*mm, bottomMargin=28*mm, **kwargs)
        self.chapter_num = 0
        self.chapter_title = ""
        self.page_num = 0
        self.is_cover = True
        self.skip_decor = False

        frame = Frame(self.leftMargin, self.bottomMargin,
                      self.width, self.height, id='normal',
                      topPadding=0, bottomPadding=0,
                      leftPadding=0, rightPadding=0)
        self.addPageTemplates([PageTemplate(id='content', frames=frame,
                                            onPage=self._on_page)])

    def _on_page(self, canvas_obj, doc):
        self.page_num += 1
        if self.skip_decor:
            return
        # Fond crème
        canvas_obj.setFillColor(CREAM)
        canvas_obj.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
        # Décor
        draw_moroccan_border(canvas_obj)
        if self.chapter_title:
            draw_page_header(canvas_obj, self.chapter_num, self.chapter_title)
        draw_page_footer(canvas_obj, self.page_num)

# ═════════════════════════════════════════════════════════════
#  HELPER pour créer des tableaux stylisés
# ═════════════════════════════════════════════════════════════

def moroccan_table(data, col_widths=None, header=True):
    t = Table(data, colWidths=col_widths)
    style = [
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('FONT', (0,0), (-1,-1), 'Helvetica', 9),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('GRID', (0,0), (-1,-1), 0.3, GOLD),
        ('BOX', (0,0), (-1,-1), 0.8, NAVY),
    ]
    if header:
        style += [
            ('BACKGROUND', (0,0), (-1,0), NAVY),
            ('TEXTCOLOR', (0,0), (-1,0), GOLD_LIGHT),
            ('FONT', (0,0), (-1,0), 'Helvetica-Bold', 9.5),
            ('ALIGN', (0,0), (-1,0), 'CENTER'),
            ('BOTTOMPADDING', (0,0), (-1,0), 8),
            ('TOPPADDING', (0,0), (-1,0), 8),
        ]
    # Lignes alternées
    for i in range(1 if header else 0, len(data)):
        if i % 2 == 0:
            style.append(('BACKGROUND', (0,i), (-1,i), PARCHMENT))
    t.setStyle(TableStyle(style))
    return t

# ═════════════════════════════════════════════════════════════
#  CONTENU
# ═════════════════════════════════════════════════════════════

def build_content(doc, S):
    flow = []

    # ──────── PARTIE I ────────
    # Contexte & Présentation

    # CHAPITRE 1
    doc.chapter_num = 1
    doc.chapter_title = "Contexte général"
    flow.append(ChapterTitle(1, "Contexte général", "Pourquoi repenser le vote au Maroc ?"))
    flow.append(Spacer(1, 10))

    flow.append(SectionTitle("1.1 — Enjeux démocratiques actuels"))
    flow.append(Paragraph(
        "Le Royaume du Maroc s'est engagé depuis la Constitution de 2011 dans une profonde "
        "modernisation de ses processus démocratiques. Malgré les avancées institutionnelles, "
        "les scrutins nationaux restent encore confrontés à trois défis majeurs : l'abstention "
        "structurelle (plus de 50 % en moyenne), la défiance envers la transparence du dépouillement, "
        "et le coût logistique considérable d'un vote entièrement papier.",
        S['body']))
    flow.append(Paragraph(
        "Parallèlement, la technologie blockchain — née en 2008 avec Bitcoin — a atteint en 2024 "
        "une maturité permettant son application à des cas d'usage critiques comme les registres "
        "fonciers, les diplômes universitaires ou les scrutins. La blockchain Ethereum, en particulier, "
        "offre des primitives cryptographiques (signatures, hachages, contrats intelligents) qui "
        "transforment fondamentalement la notion de confiance : celle-ci n'est plus accordée à une "
        "autorité centrale, mais résulte mathématiquement de la vérification publique.",
        S['body']))

    flow.append(Spacer(1, 8))
    flow.append(SectionTitle("1.2 — Genèse du projet INTIKHABATI"))
    flow.append(Paragraph(
        "Le nom <b>INTIKHABATI</b> (« mes élections » en arabe — انتخاباتي) traduit notre ambition : "
        "rendre chaque citoyen acteur direct, conscient et vérifiable de sa propre voix. "
        "Le projet a pris forme dans le cadre de notre année de fin d'études et entend proposer "
        "une architecture de référence, adaptée au contexte juridique marocain, pour un vote "
        "électronique gazless, privé et auditable.",
        S['body']))

    flow.append(ZelligeSeparator())
    flow.append(Spacer(1, 6))

    flow.append(SectionTitle("1.3 — Cadre juridique applicable"))
    flow.append(InfoBox(
        "Loi 09-08 (protection des données personnelles) · Loi 53-05 (échange électronique de données juridiques) · "
        "Code électoral marocain · Article 47 de la Constitution interdisant aux militaires en activité de prendre part au vote.",
        label="RÉFÉRENCES LÉGALES", height=52))
    flow.append(Spacer(1, 8))
    flow.append(Paragraph(
        "Notre solution respecte strictement chacun de ces cadres. Le blocage automatique des "
        "militaires en activité (Article 47) est par exemple matérialisé dans le code par une "
        "vérification systématique de la profession lors de l'inscription, avec notification "
        "administrative en cas de tentative bloquée.",
        S['body']))

    flow.append(PageBreak())

    # CHAPITRE 2 — Présentation
    doc.chapter_num = 2
    doc.chapter_title = "Présentation du projet"
    flow.append(ChapterTitle(2, "Présentation du projet", "Vision, mission, périmètre"))
    flow.append(Spacer(1, 10))

    flow.append(SectionTitle("2.1 — Vision"))
    flow.append(Paragraph(
        "Faire du Maroc une référence africaine et arabe en matière de vote électronique "
        "souverain, en s'appuyant sur des briques technologiques ouvertes, auditables par "
        "tout citoyen et conformes aux plus hauts standards cryptographiques internationaux.",
        S['body']))

    flow.append(SectionTitle("2.2 — Mission"))
    flow.append(Paragraph(
        "Fournir aux administrations marocaines (Ministère de l'Intérieur, collectivités, CNDH) "
        "une plateforme clé-en-main permettant d'organiser, sécuriser et archiver sur blockchain "
        "publique toute forme de scrutin — présidentiel, législatif, municipal, régional, référendaire "
        "— sans coût de gas pour l'électeur final et sans possibilité de fraude a posteriori.",
        S['body']))

    flow.append(SectionTitle("2.3 — Périmètre fonctionnel"))
    flow.append(Paragraph(
        "Le projet couvre le cycle complet d'une élection :",
        S['body']))
    bullets = [
        "création d'une élection par l'administrateur (via MultiSig 2-of-3)",
        "ajout de candidats et configuration de zone géographique",
        "inscription des électeurs avec vérification d'identité (CIN) et d'éligibilité",
        "phase de vote (directe ou commit-reveal pour les scrutins sensibles)",
        "clôture automatique à la deadline (impossible d'anticiper)",
        "publication des résultats et archivage IPFS/Pinata",
        "génération de certificats PDF signés avec QR code vérifiable",
    ]
    for b in bullets:
        flow.append(Paragraph(f"◆ {b}", S['bullet']))

    flow.append(Spacer(1, 10))
    flow.append(ZelligeSeparator())
    flow.append(Spacer(1, 6))

    flow.append(SectionTitle("2.4 — Hors périmètre"))
    flow.append(Paragraph(
        "Le projet ne traite pas la campagne électorale en amont, ni la phase d'émission "
        "physique des cartes d'identité (CIN). Ces éléments sont pris comme intrants externes.",
        S['body']))

    flow.append(PageBreak())

    # CHAPITRE 3 — Objectifs
    doc.chapter_num = 3
    doc.chapter_title = "Objectifs et enjeux"
    flow.append(ChapterTitle(3, "Objectifs et enjeux", "Ce que nous visons à prouver"))
    flow.append(Spacer(1, 10))

    flow.append(SectionTitle("3.1 — Objectifs techniques"))
    obj_data = [
        ["N°", "Objectif", "Indicateur mesurable"],
        ["O1", "Intégrité des votes", "Aucune modification possible après validation"],
        ["O2", "Anonymat de l'électeur", "Commit-reveal sur scrutins sensibles"],
        ["O3", "Transparence des résultats", "100 % des résultats consultables on-chain"],
        ["O4", "Accessibilité sans crypto", "Vote possible sans détenir d'ETH (EIP-2771)"],
        ["O5", "Résilience administrative", "Aucun acteur unique ne peut fermer une élection"],
        ["O6", "Conformité légale", "Respect intégral de l'Article 47"],
        ["O7", "Preuve citoyenne", "Certificat PDF + QR vérifiable par tout citoyen"],
    ]
    flow.append(moroccan_table(obj_data, col_widths=[1.4*cm, 6.5*cm, 8*cm]))

    flow.append(Spacer(1, 14))
    flow.append(SectionTitle("3.2 — Objectifs pédagogiques"))
    flow.append(Paragraph(
        "Ce projet nous permet de mettre en pratique les compétences acquises durant notre cursus : "
        "développement Solidity (smart contracts, tests Hardhat), architecture Node.js / Express, "
        "React / JavaScript moderne, base de données NoSQL (MongoDB), cryptographie appliquée "
        "(EIP-712, EIP-191, ECDSA, Keccak-256), et gestion de projet agile en binôme.",
        S['body']))

    flow.append(SectionTitle("3.3 — Enjeux stratégiques"))
    flow.append(InfoBox(
        "Au-delà de l'exercice académique, ce prototype démontre qu'une solution "
        "entièrement open-source peut concurrencer les offres propriétaires coûteuses (Scytl, "
        "Smartmatic) tout en offrant un niveau de transparence radicalement supérieur.",
        label="ENJEU POLITIQUE", height=52))

    flow.append(PageBreak())

    # ───── PARTIE II ─────
    doc.skip_decor = True
    flow.append(PageBreak())
    # Part divider drawn via special page — handled differently; we'll just use a styled page
    doc.skip_decor = False

    # CHAPITRE 4 — Utilisateurs
    doc.chapter_num = 4
    doc.chapter_title = "Utilisateurs cibles"
    flow.append(ChapterTitle(4, "Utilisateurs cibles", "Qui utilise la plateforme ?"))
    flow.append(Spacer(1, 10))

    users_data = [
        ["Profil", "Rôle principal", "Actions clés"],
        ["Citoyen électeur", "Voter, vérifier", "Inscription, vote gasless, téléchargement certificat"],
        ["Administrateur", "Créer les élections", "Création, ouverture, gestion des candidats"],
        ["Owner MultiSig", "Co-signer les actions", "Confirmer chaque action administrative critique"],
        ["Observateur", "Auditer", "Lecture publique des votes et résultats on-chain"],
        ["Agent CIN", "Valider les identités", "Ajouter/mettre à jour la base CIN hors-ligne"],
    ]
    flow.append(moroccan_table(users_data, col_widths=[3.5*cm, 3.8*cm, 8.6*cm]))

    flow.append(Spacer(1, 14))
    flow.append(SectionTitle("4.1 — Focus : l'électeur"))
    flow.append(Paragraph(
        "L'électeur est au cœur du système. Notre conception suit un principe fondateur : "
        "<b>il ne doit pas avoir besoin de comprendre la blockchain pour voter</b>. "
        "Grâce à EIP-2771, il signe une simple autorisation dans MetaMask — comme une "
        "signature papier numérisée — et c'est le relayeur qui paie les frais de transaction. "
        "Il reçoit ensuite un certificat PDF avec un QR code qui permet à quiconque de "
        "vérifier que son vote a bien été comptabilisé.",
        S['body']))

    flow.append(Spacer(1, 8))
    flow.append(SectionTitle("4.2 — Focus : les 3 owners du MultiSig"))
    flow.append(Paragraph(
        "Dans un déploiement réel, nous recommandons la répartition suivante :",
        S['body']))
    for txt in [
        "<b>Owner 1</b> — Ministère de l'Intérieur (autorité organisatrice)",
        "<b>Owner 2</b> — CNDH / Commission indépendante (garant de régularité)",
        "<b>Owner 3</b> — Observateur international (ONU, UA ou équivalent)",
    ]:
        flow.append(Paragraph(f"◆ {txt}", S['bullet']))
    flow.append(Spacer(1, 6))
    flow.append(Paragraph(
        "Cette triangulation garantit qu'<i>aucun acteur unique ne puisse modifier la plateforme, "
        "même s'il est corrompu ou contraint</i>. Le seuil 2-of-3 permet de continuer à "
        "fonctionner même si un owner est temporairement indisponible.",
        S['body']))

    flow.append(PageBreak())

    # CHAPITRE 5 — Fonctionnalités
    doc.chapter_num = 5
    doc.chapter_title = "Fonctionnalités détaillées"
    flow.append(ChapterTitle(5, "Fonctionnalités détaillées", "Le cœur technique du système"))
    flow.append(Spacer(1, 10))

    flow.append(SubsectionTitle("F1 · Meta-transactions EIP-2771 (vote gasless)"))
    flow.append(Paragraph(
        "Le standard EIP-2771 permet à un électeur de signer hors-chaîne une requête typée "
        "EIP-712, qu'un relayeur soumet ensuite au <i>MinimalForwarder</i>. Le contrat "
        "CivicChain — qui hérite de <b>ERC2771Context</b> — extrait l'adresse réelle de "
        "l'électeur depuis les 20 derniers octets du calldata. Résultat : l'électeur n'a "
        "besoin d'aucun ETH.",
        S['body']))
    flow.append(InfoBox(
        "Un electeur marocain peut voter depuis un wallet vide — exactement comme on signe "
        "une carte d'émargement papier. Les frais sont pris en charge par le relayeur institutionnel.",
        label="IMPACT CITOYEN", height=42))
    flow.append(Spacer(1, 10))

    flow.append(SubsectionTitle("F2 · MultiSig 2-of-3 (gouvernance partagée)"))
    flow.append(Paragraph(
        "Toute action administrative (création, ouverture, inscription) passe par le contrat "
        "<b>MultiSigWallet</b>. Le flux complet est : <i>submit → confirm (owner 0) → confirm "
        "(owner 1) → auto-exécution</i>. Si un owner refuse de signer, l'action ne s'exécute pas.",
        S['body']))
    flow.append(Spacer(1, 10))

    flow.append(SubsectionTitle("F3 · Vote commit-reveal (anonymat renforcé)"))
    flow.append(Paragraph(
        "Pour les scrutins sensibles, l'électeur envoie d'abord un <i>commitment</i> = "
        "hash(candidat, nonce_secret). Une fois la période de vote terminée, il révèle "
        "son choix. Aucun observateur ne peut lier un vote à un électeur avant la phase "
        "de révélation, empêchant toute pression ou intimidation.",
        S['body']))
    flow.append(Spacer(1, 10))

    flow.append(SubsectionTitle("F4 · Blocage militaire (Article 47)"))
    flow.append(Paragraph(
        "À l'inscription, la profession de l'électeur est contrôlée contre une liste noire "
        "(Forces Armées Royales, Gendarmerie Royale, Direction Générale de la Sûreté Nationale). "
        "Un enregistrement automatique dans la collection <code>Blacklist</code> + une alerte "
        "email à l'administrateur + un <code>ActivityLog</code> de criticité <b>CRITICAL</b> "
        "sont déclenchés.",
        S['body']))
    flow.append(Spacer(1, 10))

    flow.append(SubsectionTitle("F5 · Archivage IPFS via Pinata"))
    flow.append(Paragraph(
        "À la fermeture de chaque élection, les résultats sont empaquetés en JSON et "
        "épinglés (<i>pinned</i>) sur le réseau IPFS via l'API Pinata. Le CID — hash "
        "cryptographique immuable — est embarqué dans le certificat PDF via QR code. "
        "N'importe qui peut ouvrir <code>ipfs.io/ipfs/&lt;CID&gt;</code> et vérifier "
        "les résultats bruts, sans dépendre de nos serveurs.",
        S['body']))
    flow.append(Spacer(1, 10))

    flow.append(SubsectionTitle("F6 · Restriction géographique"))
    flow.append(Paragraph(
        "Chaque élection peut être limitée à une ou plusieurs régions, villes ou arrondissements "
        "via un side-car MongoDB <code>ElectionMeta</code>. Un électeur de Tanger ne peut pas "
        "s'inscrire à une élection municipale de Marrakech.",
        S['body']))

    flow.append(PageBreak())

    flow.append(SubsectionTitle("F7 · Certificat PDF signé avec QR code"))
    flow.append(Paragraph(
        "Après la fermeture d'une élection, tout électeur peut télécharger un certificat PDF "
        "mentionnant : son adresse wallet (partielle), l'ID de l'élection, la date, le total "
        "de votes exprimés, et un QR code pointant soit vers IPFS (si Pinata configuré), "
        "soit vers la page de vérification locale.",
        S['body']))
    flow.append(Spacer(1, 10))

    flow.append(SubsectionTitle("F8 · Délégation de vote (proxy)"))
    flow.append(Paragraph(
        "Un électeur peut déléguer son droit de vote à un autre électeur <b>lui-même inscrit</b> "
        "à la même élection. Cette fonctionnalité reproduit numériquement la procuration "
        "postale en usage dans plusieurs démocraties.",
        S['body']))
    flow.append(Spacer(1, 10))

    flow.append(SubsectionTitle("F9 · Score de risque anti-fraude"))
    flow.append(Paragraph(
        "Chaque wallet inscrit dispose d'un <code>riskScore</code> recalculé à chaque action "
        "(multiples inscriptions rapides, mismatch CIN/wallet, tentatives bloquées). "
        "Au-dessus du seuil 80, l'inscription est refusée. L'administrateur peut réinitialiser "
        "manuellement un score via l'endpoint <code>POST /api/admin/reset-risk/:wallet</code>.",
        S['body']))
    flow.append(Spacer(1, 10))

    flow.append(SubsectionTitle("F10 · Audit trail complet"))
    flow.append(Paragraph(
        "Toutes les actions critiques sont journalisées dans la collection "
        "<code>ActivityLog</code> avec horodatage, niveau de criticité et détail. "
        "Chaque événement est également émis comme <i>event</i> Solidity, donc "
        "définitivement inscrit dans la blockchain Ethereum.",
        S['body']))

    flow.append(Spacer(1, 14))
    flow.append(ZelligeSeparator())
    flow.append(Spacer(1, 8))
    flow.append(Paragraph(
        "<i>Au total, la plateforme compte plus de 40 endpoints REST, 25 fonctions Solidity, "
        "et 65 tests unitaires automatisés exécutés à chaque modification de contrat.</i>",
        S['quote']))

    flow.append(PageBreak())

    # CHAPITRE 6 — Architecture
    doc.chapter_num = 6
    doc.chapter_title = "Architecture technique"
    flow.append(ChapterTitle(6, "Architecture technique", "Les 4 couches du système"))
    flow.append(Spacer(1, 10))

    flow.append(SectionTitle("6.1 — Vue d'ensemble"))
    flow.append(Paragraph(
        "L'architecture suit un modèle en <b>quatre couches</b> clairement séparées, "
        "communicant via des contrats d'interface explicites. Cette séparation permet "
        "de remplacer indépendamment chaque couche (par exemple : migration PostgreSQL "
        "à la place de MongoDB) sans toucher aux autres.",
        S['body']))

    arch_data = [
        ["Couche", "Technologie", "Rôle"],
        ["Blockchain", "Solidity 0.8.19 · Ethereum · Hardhat", "Source de vérité (votes, identité)"],
        ["Backend API", "Node.js 18+ · Express · ethers.js v6", "Orchestration, relayage, off-chain"],
        ["Base de données", "MongoDB · Mongoose ODM", "Cache, métadonnées, audit trail"],
        ["Frontend", "React 18 · React Router · ethers.js", "Interface citoyen et administrateur"],
    ]
    flow.append(moroccan_table(arch_data, col_widths=[3.3*cm, 5.5*cm, 7.1*cm]))

    flow.append(Spacer(1, 14))
    flow.append(SectionTitle("6.2 — Contrats Solidity"))
    contracts_data = [
        ["Contrat", "Responsabilité", "Lignes"],
        ["CivicChain.sol", "Logique principale des élections", "≈ 520"],
        ["MultiSigWallet.sol", "Gouvernance 2-of-3", "≈ 180"],
        ["MinimalForwarder.sol", "Relais EIP-2771", "≈ 140"],
        ["ERC2771Context.sol", "Extraction _msgSender()", "≈ 40 (inline)"],
    ]
    flow.append(moroccan_table(contracts_data, col_widths=[4.5*cm, 8.5*cm, 2.9*cm]))

    flow.append(PageBreak())

    flow.append(SectionTitle("6.3 — Modèles MongoDB"))
    models_data = [
        ["Modèle", "Usage", "TTL / Index"],
        ["Voter", "Profil citoyen + historique", "Index walletAddress"],
        ["Nonce", "Anti-replay signatures", "TTL 300 s"],
        ["FakeID", "Base CIN de test", "Index cin unique"],
        ["Blacklist", "Article 47", "Append-only"],
        ["ElectionMeta", "Zones géo, paramètres hors-chaîne", "FK electionId"],
        ["ElectionCache", "Snapshot des résultats fermés", "FK electionId"],
        ["ActivityLog", "Audit trail", "Index timestamp"],
        ["ElectionSettings", "Singleton : visibilité résultats", "1 doc unique"],
    ]
    flow.append(moroccan_table(models_data, col_widths=[3.5*cm, 6.5*cm, 5.9*cm]))

    flow.append(Spacer(1, 14))
    flow.append(SectionTitle("6.4 — Diagramme simplifié des flux"))
    flow.append(Paragraph(
        "<b>Inscription :</b> CIN saisi → hachage Keccak-256 → vérification blacklist Article 47 → "
        "vérification zone géographique → inscription on-chain via MultiSig → journalisation.",
        S['body']))
    flow.append(Paragraph(
        "<b>Vote (gasless) :</b> électeur signe EIP-712 → envoi au backend → relayeur appelle "
        "MinimalForwarder.execute() → CivicChain._msgSender() extrait l'électeur → comptage.",
        S['body']))
    flow.append(Paragraph(
        "<b>Fermeture :</b> autoCloseService (polling 15 s) détecte deadline dépassée → "
        "MultiSig co-signe closeElection() → results cachés en Mongo + pinnés sur IPFS.",
        S['body']))

    flow.append(Spacer(1, 12))
    flow.append(ZelligeSeparator())
    flow.append(Spacer(1, 8))
    flow.append(SectionTitle("6.5 — Sécurité cryptographique"))
    sec_data = [
        ["Primitive", "Usage", "Algorithme"],
        ["Signature utilisateur", "Authentification login", "EIP-191 (personal_sign)"],
        ["Signature meta-tx", "Vote gasless", "EIP-712 (typed data)"],
        ["Hachage CIN", "Pseudonymisation identité", "Keccak-256"],
        ["Hachage commitment", "Commit-reveal", "Keccak-256(candidat + nonce)"],
        ["Nonce anti-replay", "Protection login", "CSPRNG 128 bits"],
    ]
    flow.append(moroccan_table(sec_data, col_widths=[4*cm, 5.5*cm, 6.4*cm]))

    flow.append(PageBreak())

    # CHAPITRE 7 — Contraintes
    doc.chapter_num = 7
    doc.chapter_title = "Contraintes"
    flow.append(ChapterTitle(7, "Contraintes", "Limites imposées au projet"))
    flow.append(Spacer(1, 10))

    flow.append(SectionTitle("7.1 — Contraintes techniques"))
    tech_c = [
        "Blockchain publique Ethereum (pas de consortium privé)",
        "Finalité en blocs < 15 secondes (réseau local Hardhat en dev, Sepolia en staging)",
        "Compatibilité Solidity ≥ 0.8.19 (protections anti-overflow natives)",
        "Node.js 18+ (usage de fetch natif pour Pinata)",
        "Navigateurs modernes avec extension MetaMask",
    ]
    for t in tech_c:
        flow.append(Paragraph(f"◆ {t}", S['bullet']))

    flow.append(Spacer(1, 10))
    flow.append(SectionTitle("7.2 — Contraintes juridiques"))
    flow.append(InfoBox(
        "Loi 09-08 : toute donnée personnelle (CIN, email) est pseudonymisée via Keccak-256 "
        "avant stockage on-chain. Aucune donnée identifiante n'apparaît en clair dans la blockchain. "
        "Les données MongoDB sont hébergées sur serveur souverain marocain.",
        label="CONFORMITÉ LOI 09-08", height=56))

    flow.append(Spacer(1, 10))
    flow.append(SectionTitle("7.3 — Contraintes financières"))
    flow.append(Paragraph(
        "Ce projet académique est réalisé sans budget. Tous les outils utilisés sont "
        "open-source ou en version gratuite (Pinata Free 1 GB, MongoDB Community, "
        "Hardhat). Un déploiement en production nécessiterait un budget dédié au gas "
        "Ethereum — que nous estimons à <b>0,15 MAD par électeur</b> sur Polygon L2.",
        S['body']))

    flow.append(Spacer(1, 10))
    flow.append(SectionTitle("7.4 — Contraintes de temps"))
    flow.append(Paragraph(
        "Le projet a été réalisé entre <b>janvier et avril 2026</b>, soit environ 4 mois, "
        "avec un effort cumulé estimé à 480 heures réparties équitablement entre les "
        "deux membres du binôme.",
        S['body']))

    flow.append(PageBreak())

    # CHAPITRE 8 — Livrables
    doc.chapter_num = 8
    doc.chapter_title = "Livrables et planning"
    flow.append(ChapterTitle(8, "Livrables et planning", "Ce qui est remis, quand"))
    flow.append(Spacer(1, 10))

    flow.append(SectionTitle("8.1 — Livrables"))
    liv_data = [
        ["Livrable", "Format", "Statut"],
        ["Code source intégral", "Dépôt Git public", "Finalisé"],
        ["Smart contracts audités", "Solidity + 65 tests Hardhat", "Finalisé"],
        ["Base CIN de démonstration", "Seed MongoDB", "Finalisé"],
        ["Documentation technique", "Markdown dans repo", "Finalisée"],
        ["Cahier des charges", "Présent document PDF", "Finalisé"],
        ["Présentation orale", "Slides + démo live", "À présenter"],
        ["Mémoire de PFE", "Document académique A4", "En rédaction"],
    ]
    flow.append(moroccan_table(liv_data, col_widths=[6.5*cm, 5.5*cm, 3.9*cm]))

    flow.append(Spacer(1, 14))
    flow.append(SectionTitle("8.2 — Planning (diagramme de Gantt synthétique)"))
    plan_data = [
        ["Phase", "Période", "Durée"],
        ["Phase 1 — Analyse & cadrage", "Janvier 2026", "3 semaines"],
        ["Phase 2 — Conception architecture", "Fin janvier 2026", "2 semaines"],
        ["Phase 3 — Dév. smart contracts", "Février 2026", "4 semaines"],
        ["Phase 4 — Dév. backend & relayeur", "Début mars 2026", "3 semaines"],
        ["Phase 5 — Dév. frontend React", "Mi-mars 2026", "3 semaines"],
        ["Phase 6 — Intégration & tests", "Début avril 2026", "2 semaines"],
        ["Phase 7 — Rédaction & soutenance", "Mi-avril 2026", "2 semaines"],
    ]
    flow.append(moroccan_table(plan_data, col_widths=[6.5*cm, 5.5*cm, 3.9*cm]))

    flow.append(Spacer(1, 14))
    flow.append(SectionTitle("8.3 — Critères d'acceptation"))
    acc = [
        "Les 65 tests unitaires Hardhat doivent passer à 100 %",
        "Aucune faille de sécurité critique détectée par slither / mythril",
        "L'application complète démarre en moins de 5 minutes depuis un clone frais",
        "Au moins 10 scénarios end-to-end documentés et rejouables",
        "Respect intégral de l'Article 47 vérifié par test automatisé",
    ]
    for a in acc:
        flow.append(Paragraph(f"◆ {a}", S['bullet']))

    flow.append(PageBreak())

    # CHAPITRE 9 — Équipe
    doc.chapter_num = 9
    doc.chapter_title = "Équipe projet"
    flow.append(ChapterTitle(9, "Équipe projet", "Les architectes d'INTIKHABATI"))
    flow.append(Spacer(1, 10))

    flow.append(Paragraph(
        "Le projet est porté par un binôme complémentaire, chacun apportant sa spécialisation "
        "et sa sensibilité propre aux problématiques de souveraineté numérique et de démocratie "
        "participative au Maroc.",
        S['body']))

    flow.append(Spacer(1, 16))

    # Carte AYOUB
    ayoub_box = Table([
        ["AYOUB LAAFAR"],
        ["Chef de projet · Architecte blockchain"],
        ["Responsabilités principales :"],
        ["◆ Conception et développement des smart contracts Solidity"],
        ["◆ Mise en place de l'infrastructure Hardhat et des 65 tests"],
        ["◆ Implémentation EIP-2771 (meta-transactions gasless)"],
        ["◆ Architecture MultiSig 2-of-3 et transfert d'ownership"],
        ["◆ Intégration IPFS / Pinata pour archivage immuable"],
    ], colWidths=[16*cm])
    ayoub_box.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,0), NAVY),
        ('TEXTCOLOR', (0,0), (0,0), GOLD_LIGHT),
        ('FONT', (0,0), (0,0), 'Helvetica-Bold', 18),
        ('ALIGN', (0,0), (0,0), 'CENTER'),
        ('TOPPADDING', (0,0), (0,0), 12),
        ('BOTTOMPADDING', (0,0), (0,0), 12),
        ('BACKGROUND', (0,1), (0,1), IMPERIAL),
        ('TEXTCOLOR', (0,1), (0,1), CREAM),
        ('FONT', (0,1), (0,1), 'Helvetica-Oblique', 11),
        ('ALIGN', (0,1), (0,1), 'CENTER'),
        ('TOPPADDING', (0,1), (0,1), 6),
        ('BOTTOMPADDING', (0,1), (0,1), 6),
        ('BACKGROUND', (0,2), (0,-1), PARCHMENT),
        ('FONT', (0,2), (0,2), 'Helvetica-Bold', 10),
        ('TEXTCOLOR', (0,2), (0,2), NAVY),
        ('FONT', (0,3), (0,-1), 'Helvetica', 10),
        ('TEXTCOLOR', (0,3), (0,-1), INK),
        ('LEFTPADDING', (0,0), (-1,-1), 16),
        ('RIGHTPADDING', (0,0), (-1,-1), 16),
        ('TOPPADDING', (0,2), (0,-1), 4),
        ('BOTTOMPADDING', (0,2), (0,-1), 4),
        ('BOX', (0,0), (-1,-1), 1.0, GOLD),
    ]))
    flow.append(ayoub_box)

    flow.append(Spacer(1, 18))

    # Carte KAOUTAR
    kaoutar_box = Table([
        ["KAOUTAR MENACERA"],
        ["Lead développeuse · UI/UX et conformité juridique"],
        ["Responsabilités principales :"],
        ["◆ Développement complet du frontend React"],
        ["◆ Conception de l'interface citoyenne et administrateur"],
        ["◆ Analyse juridique : Loi 09-08, Article 47, Code électoral"],
        ["◆ Modèles MongoDB et API REST Express"],
        ["◆ Système de scoring anti-fraude et détection militaire"],
    ], colWidths=[16*cm])
    kaoutar_box.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,0), NAVY),
        ('TEXTCOLOR', (0,0), (0,0), GOLD_LIGHT),
        ('FONT', (0,0), (0,0), 'Helvetica-Bold', 18),
        ('ALIGN', (0,0), (0,0), 'CENTER'),
        ('TOPPADDING', (0,0), (0,0), 12),
        ('BOTTOMPADDING', (0,0), (0,0), 12),
        ('BACKGROUND', (0,1), (0,1), IMPERIAL),
        ('TEXTCOLOR', (0,1), (0,1), CREAM),
        ('FONT', (0,1), (0,1), 'Helvetica-Oblique', 11),
        ('ALIGN', (0,1), (0,1), 'CENTER'),
        ('TOPPADDING', (0,1), (0,1), 6),
        ('BOTTOMPADDING', (0,1), (0,1), 6),
        ('BACKGROUND', (0,2), (0,-1), PARCHMENT),
        ('FONT', (0,2), (0,2), 'Helvetica-Bold', 10),
        ('TEXTCOLOR', (0,2), (0,2), NAVY),
        ('FONT', (0,3), (0,-1), 'Helvetica', 10),
        ('TEXTCOLOR', (0,3), (0,-1), INK),
        ('LEFTPADDING', (0,0), (-1,-1), 16),
        ('RIGHTPADDING', (0,0), (-1,-1), 16),
        ('TOPPADDING', (0,2), (0,-1), 4),
        ('BOTTOMPADDING', (0,2), (0,-1), 4),
        ('BOX', (0,0), (-1,-1), 1.0, GOLD),
    ]))
    flow.append(kaoutar_box)

    flow.append(PageBreak())

    # CHAPITRE 10 — Conclusion
    doc.chapter_num = 10
    doc.chapter_title = "Conclusion & perspectives"
    flow.append(ChapterTitle(10, "Conclusion", "Vers un Maroc numérique et démocratique"))
    flow.append(Spacer(1, 10))

    flow.append(Paragraph(
        "Le projet INTIKHABATI démontre qu'il est techniquement possible, <b>dès aujourd'hui</b>, "
        "de proposer une plateforme de vote électronique conforme au droit marocain, radicalement "
        "transparente et accessible à tout citoyen sans pré-requis cryptographique. Les briques "
        "technologiques utilisées sont matures, auditables et reposent sur des standards "
        "internationaux (EIP-712, EIP-2771, ERC-20 style ownership).",
        S['body']))

    flow.append(Spacer(1, 8))
    flow.append(SectionTitle("10.1 — Perspectives d'évolution"))
    evol = [
        "Migration vers Polygon L2 pour réduire les coûts de gas de 99 %",
        "Intégration de la future Carte Nationale Électronique (CNE) marocaine",
        "Support multilingue arabe / français / amazighe (Tifinagh)",
        "Version mobile native iOS / Android avec signature in-app",
        "Preuves à divulgation nulle (zk-SNARK) pour anonymat absolu",
        "Audit de sécurité externe par cabinet spécialisé",
    ]
    for e in evol:
        flow.append(Paragraph(f"◆ {e}", S['bullet']))

    flow.append(Spacer(1, 16))
    flow.append(ZelligeSeparator())
    flow.append(Spacer(1, 10))
    flow.append(Paragraph(
        "<i>« La technologie ne remplacera jamais la volonté politique, mais elle peut "
        "la rendre vérifiable. »</i>",
        S['quote']))
    flow.append(Paragraph(
        "— AYOUB LAAFAR & KAOUTAR MENACERA",
        S['body_center']))

    return flow

# ═════════════════════════════════════════════════════════════
#  MAIN
# ═════════════════════════════════════════════════════════════

def main():
    output = r"C:\Users\Windows\Desktop\civicchain\Cahier_des_Charges_INTIKHABATI.pdf"
    S = make_styles()

    # On construit le PDF en deux passes :
    # 1. Cover + quote page (canvas direct)
    # 2. Document principal (reportlab Platypus)
    # Astuce : on génère 2 fichiers puis on merge, ou on utilise BaseDocTemplate
    # avec onFirstPage. Ici, on va tout faire via BaseDocTemplate en gérant
    # les pages spéciales.

    # Approche simple : on écrit d'abord cover + quote sur un canvas séparé,
    # puis on génère le corps, puis on merge avec pypdf.
    import tempfile, os
    tmp_cover = tempfile.mktemp(suffix="_cover.pdf")
    tmp_body  = tempfile.mktemp(suffix="_body.pdf")

    # ─ Cover ─
    c = canvas.Canvas(tmp_cover, pagesize=A4)
    draw_cover(c)
    c.showPage()
    draw_quote_page(c)
    c.showPage()
    c.save()

    # ─ Body ─
    doc = MoroccanDocTemplate(tmp_body)
    flow = build_content(doc, S)
    doc.build(flow)

    # ─ Merge ─
    try:
        from pypdf import PdfReader, PdfWriter
    except ImportError:
        from PyPDF2 import PdfReader, PdfWriter

    writer = PdfWriter()
    for pdf_file in [tmp_cover, tmp_body]:
        reader = PdfReader(pdf_file)
        for page in reader.pages:
            writer.add_page(page)
    # Métadonnées
    writer.add_metadata({
        "/Title": "Cahier des charges — INTIKHABATI",
        "/Author": "Ayoub LAAFAR & Kaoutar MENACERA",
        "/Subject": "Plateforme de vote électronique décentralisée",
        "/Creator": "CivicChain Project 2026",
    })
    with open(output, "wb") as f:
        writer.write(f)

    # Nettoyage
    try:
        os.unlink(tmp_cover)
        os.unlink(tmp_body)
    except Exception:
        pass

    print(f"[OK] Cahier des charges genere : {output}")
    print(f"     Taille : {os.path.getsize(output) / 1024:.1f} KB")

if __name__ == "__main__":
    main()
