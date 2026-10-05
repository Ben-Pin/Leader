"""Build the bundled English PDF from docs/USER_MANUAL.md.

Authoring dependency: ReportLab. Python is not needed to run Leader.
Run from any directory: python scripts/build-user-manual.py
"""
from pathlib import Path
import html
import json
import re
import tempfile
from io import BytesIO
from PIL import Image as PillowImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.pagesizes import A4
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Preformatted, Image, KeepTogether, Flowable
from reportlab.lib.utils import ImageReader
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT = Path(__file__).resolve().parent.parent
VERSION = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
OUTPUT = ROOT / 'public' / f'Leader-User-Manual-{VERSION}.pdf'
BLUE = colors.HexColor('#405ba5')
INK = colors.HexColor('#27364c')
MUTED = colors.HexColor('#64748b')
WORDMARK = 'Helvetica-Bold'
for font in [Path('C:/Windows/Fonts/segoeuib.ttf'), Path('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')]:
    if font.exists():
        pdfmetrics.registerFont(TTFont('LeaderWordmark', str(font)))
        WORDMARK = 'LeaderWordmark'
        break

def draw_wordmark(canvas, x, y, size):
    canvas.setFont(WORDMARK, size)
    text = canvas.beginText(x, y)
    text.setCharSpace(-size / 24)
    text.setFillColor(colors.HexColor('#303e5b'))
    text.textOut('Leader')
    text.setFillColor(colors.HexColor('#7693e6'))
    text.textOut('.')
    canvas.drawText(text)

class LeaderWordmark(Flowable):
    def __init__(self, size):
        super().__init__()
        self.size = size
        self.width = pdfmetrics.stringWidth('Leader.', WORDMARK, size)
        self.height = size * 1.2
    def draw(self):
        draw_wordmark(self.canv, 0, self.size * .2, self.size)

MONO = 'Courier'
for font in [Path('C:/Windows/Fonts/consola.ttf'), Path('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf')]:
    if font.exists():
        pdfmetrics.registerFont(TTFont('ManualMono', str(font)))
        MONO = 'ManualMono'
        break
STYLES = getSampleStyleSheet()
STYLES.add(ParagraphStyle(name='ManualBody', fontName='Helvetica', fontSize=10.2, leading=15.4, textColor=INK, spaceAfter=8))
STYLES.add(ParagraphStyle(name='ManualHeading', fontName='Helvetica-Bold', fontSize=17, leading=22, textColor=BLUE, spaceBefore=18, spaceAfter=10, keepWithNext=True))
STYLES.add(ParagraphStyle(name='ManualCell', parent=STYLES['ManualBody'], fontSize=9, leading=12.5, spaceAfter=0))
STYLES.add(ParagraphStyle(name='ManualCode', fontName=MONO, fontSize=9, leading=13, textColor=INK, backColor=colors.HexColor('#edf2f8'), borderPadding=9, spaceBefore=4, spaceAfter=12))
STYLES.add(ParagraphStyle(name='ManualTOC', fontName='Helvetica', fontSize=10.2, leading=17, textColor=INK, leftIndent=0, firstLineIndent=0, spaceBefore=5))

def plain(text):
    return text.replace('\u2011', '-').replace('\u2013', '-').replace('\u2014', '-').replace('→', ' > ').replace('×', ' x ').replace('≤', '<=')

def inline(text):
    text = html.escape(plain(text))
    # Markdown URLs resolve to the source repository; the manual itself remains local.
    def link(match):
        label, url=match.groups()
        if not re.match(r'https?://', url):
            url='https://github.com/Ben-Pin/Leader/blob/main/docs/'+url
        return f'<a color="#405ba5" href="{url}">{label}</a>'
    text=re.sub(r'\[([^\]]+)\]\(([^)]+)\)',link,text)
    text=re.sub(r'\*\*([^*]+)\*\*',r'<b>\1</b>',text)
    text=re.sub(r'`([^`]+)`',lambda m:f'<font name="{MONO}" size="9">{m.group(1)}</font>',text)
    return text

def document_image(path, max_pixels=1400, transparent=False):
    """Compress embedded copies without changing application or screenshot files."""
    with PillowImage.open(path) as source:
        regions=ROOT/'docs/screenshots/regions.json'
        region=json.loads(regions.read_text()).get(path.name) if regions.exists() else None
        if region:
            if list(source.size)!=region['sourceSize']:
                raise ValueError('Recapture screenshot region for '+path.name)
            source=source.crop(region['box'])
        source.thumbnail((max_pixels,max_pixels), PillowImage.Resampling.LANCZOS)
        buffer=BytesIO()
        if transparent:
            source.save(buffer,format='PNG')
        else:
            source.convert('RGB').save(buffer,format='JPEG',quality=92)
    return Image(buffer,mask='auto')

class BodyParagraph(Paragraph):
    """Keep short instructional paragraphs intact across page boundaries."""
    def split(self, available_width, available_height):
        return []

class ToolbarGuide(Flowable):
    """Pair the photographed rail with numbered, readable callouts."""
    def __init__(self, path, rows):
        super().__init__()
        self.width, self.height = A4[0]-96, 540
        self.rows = rows
        geometry = json.loads((ROOT/'docs/screenshots/toolbar.json').read_text())
        self.buttons = geometry['buttons']
        with PillowImage.open(path) as source:
            if list(source.size) != geometry['sourceSize']:
                raise ValueError('Recapture toolbar coordinates with the screenshot')
            buffer = BytesIO()
            source.crop(geometry['railBox']).save(buffer, format='PNG')
        self.rail = ImageReader(buffer)

    def draw(self):
        canvas = self.canv
        scale = self.height / 720
        canvas.drawImage(self.rail,0,0,width=58*scale,height=self.height)
        for number, (row, button) in enumerate(zip(self.rows,self.buttons),1):
            center = self.height - (button['box'][1]+button['box'][3])/2*scale
            canvas.setStrokeColor(colors.HexColor('#9baed0'))
            canvas.line(44,center,53,center)
            canvas.setFillColor(BLUE)
            canvas.circle(64,center,9,stroke=0,fill=1)
            canvas.setFillColor(colors.white)
            canvas.setFont('Helvetica-Bold',8.5)
            canvas.drawCentredString(64,center-3,str(number))
            title = Paragraph('<b>'+inline(row[1])+'</b>',STYLES['ManualCell'])
            description = Paragraph(inline(row[2]),STYLES['ManualCell'])
            width = self.width-85
            _, title_height = title.wrap(width,100)
            _, description_height = description.wrap(width,100)
            top = center + (title_height+description_height+2)/2
            title.drawOn(canvas,85,top-title_height)
            description.drawOn(canvas,85,top-title_height-description_height-2)

def piece_catalogue():
    """Illustrated, fictional personalities; no application behavior is implied."""
    pieces = json.loads((ROOT/'docs/game-piece-personalities.json').read_text(encoding='utf-8'))
    width = (A4[0]-96)/3
    cells = []
    for piece in pieces:
        with PillowImage.open(ROOT/'public'/piece['image'].lstrip('/')) as source:
            source.thumbnail((300,300), PillowImage.Resampling.LANCZOS)
            buffer = BytesIO()
            source.save(buffer, format='PNG')
        art = Image(buffer,width=92,height=92,hAlign='CENTER')
        cells.append([art,Spacer(1,5),Paragraph('<b>'+inline(piece['name'])+'</b>',STYLES['ManualCell']),
                      Paragraph('<b>Strength:</b> '+inline(piece['strength'])+'<br/><b>Lucky for:</b> '+inline(piece['luck']),STYLES['ManualCell'])])
    rows=[cells[i:i+3] for i in range(0,len(cells),3)]
    table=Table(rows,colWidths=[width]*3,hAlign='LEFT',spaceBefore=10,spaceAfter=15)
    table.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,-1),12),('BOTTOMPADDING',(0,0),(-1,-1),14),('ROWBACKGROUNDS',(0,0),(-1,-1),[colors.HexColor('#f2f5fb'),colors.white]),('LINEBELOW',(0,0),(-1,-1),.4,colors.HexColor('#d6deec'))]))
    return table

class ManualDoc(BaseDocTemplate):
    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph) and flowable.style.name=='ManualHeading':
            title=flowable.getPlainText()
            key='section-'+str(self.seq.nextf('heading'))
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(title,key,0,False)
            self.notify('TOCEntry',(0,title,self.page,key))

def page_chrome(canvas, doc):
    canvas.saveState()
    width,height=A4
    canvas.setStrokeColor(BLUE)
    canvas.setLineWidth(.6)
    canvas.line(48,height-45,width-48,height-45)
    draw_wordmark(canvas,48,height-34,12)
    canvas.setFillColor(MUTED)
    canvas.setFont('Helvetica',8)
    canvas.drawRightString(width-48,height-34,'USER MANUAL  /  '+VERSION)
    canvas.line(48,44,width-48,44)
    canvas.drawString(48,30,'Local company and contact workspace')
    canvas.drawRightString(width-48,30,str(doc.page))
    canvas.restoreState()

def build():
    pdf_buffer=BytesIO()
    doc=ManualDoc(pdf_buffer,pagesize=A4,leftMargin=48,rightMargin=48,topMargin=62,bottomMargin=62,
                  title='Leader '+VERSION+' - User manual',author='Benjamin Pinkas',subject='English guide to company databases, contacts and follow-up')
    doc.addPageTemplates(PageTemplate(id='manual',frames=Frame(48,62,A4[0]-96,A4[1]-124,id='body',leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0),onPage=page_chrome))
    logo_art=document_image(ROOT/'public/leader-logo.png',max_pixels=300,transparent=True)
    logo_art.drawWidth=logo_art.drawHeight=60
    logo=Table([[logo_art]],colWidths=[76],rowHeights=[76],hAlign='LEFT')
    logo.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),BLUE),('BOX',(0,0),(-1,-1),.7,colors.HexColor('#90a5d4')),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('ALIGN',(0,0),(-1,-1),'CENTER'),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8)]))
    story=[Spacer(1,28),logo,Spacer(1,22)]
    story.extend([LeaderWordmark(49),Spacer(1,12)])
    story.append(Paragraph('of the lead-free world',ParagraphStyle(name='CoverMotto',fontName='Helvetica',fontSize=15,leading=22,textColor=MUTED,spaceAfter=44)))
    story.append(Paragraph('Company databases<br/>and contact management',ParagraphStyle(name='CoverStatement',fontName='Helvetica-Bold',fontSize=25,leading=33,textColor=INK,spaceAfter=25)))
    story.append(Paragraph('A local workspace for researching companies and leads, managing contacts, and tracking follow-up - for business development, sales, partnerships, or job searching.',STYLES['ManualBody']))
    story.append(Paragraph('Keep company research, people, discussions and follow-up together. Work with separate databases and retain your records on your own computer.',STYLES['ManualBody']))
    story.extend([Spacer(1,24),Paragraph('<b>English user manual</b><br/>Release '+VERSION+'<br/>5 October 2026<br/><br/><b>Concept and Product:</b> Benjamin Pinkas',STYLES['ManualBody']),PageBreak()])
    story.append(Paragraph('Contents',ParagraphStyle(name='ContentsTitle',parent=STYLES['ManualHeading'])))
    toc=TableOfContents();toc.levelStyles=[STYLES['ManualTOC']];story.extend([toc,Spacer(1,18),Paragraph('Click a contents entry to go to the section. This PDF is bundled with Leader and opens from About without an online viewer.',STYLES['ManualBody']),PageBreak()])
    lines=(ROOT/'docs/USER_MANUAL.md').read_text(encoding='utf-8').splitlines()
    i=0
    while i<len(lines):
        line=lines[i].strip();i+=1
        if not line or line.startswith('# ') or line.startswith('For Leader '):continue
        if line.startswith('## '):
            if line[3:] in ['Game piece personalities','The blue toolbar, icon by icon']:
                story.append(PageBreak())
            story.append(Paragraph(inline(line[3:]),STYLES['ManualHeading']))
            if line[3:]=='Game piece personalities':
                story.append(Paragraph('A playful companion for the workspace. These invented strengths and lucky associations are stories; selecting a piece does not change records, priorities or results.',STYLES['ManualBody']))
                story.append(piece_catalogue())
                while i<len(lines) and not lines[i].startswith('## '): i+=1
            continue
        picture=re.match(r'^!\[([^\]]+)\]\(([^)]+)\)$',line)
        if picture:
            caption,filename=picture.groups()
            if filename == 'screenshots/manual-toolbar.jpg':
                while i<len(lines) and not lines[i].strip(): i+=1
                raw=[]
                while i<len(lines) and lines[i].strip().startswith('|'):
                    raw.append(lines[i].strip());i+=1
                rows=[[c.strip() for c in row.strip('|').split('|')] for row in raw if not re.match(r'^\|[\s:|-]+\|$',row)]
                if len(rows)!=11 or rows[0][0]!='Icon / position':
                    raise ValueError('The photographed toolbar requires all ten documented buttons')
                image=ToolbarGuide(ROOT/'docs'/filename,rows[1:])
            else:
                image=document_image(ROOT/'docs'/filename)
                scale=min((A4[0]-96)/image.imageWidth,400/image.imageHeight)
                image.drawWidth=image.imageWidth*scale
                image.drawHeight=image.imageHeight*scale
            image.hAlign='LEFT'
            figure=[Spacer(1,6),image,Spacer(1,5),Paragraph(inline(caption),ParagraphStyle(name='FigureCaption',parent=STYLES['ManualBody'],fontSize=9,leading=12,textColor=MUTED)),Spacer(1,8)]
            if story and isinstance(story[-1],Paragraph) and story[-1].style.name=='ManualHeading':
                figure.insert(0,story.pop())
            story.append(KeepTogether(figure))
            continue
        if line.startswith('```'):
            code=[]
            while i<len(lines) and not lines[i].startswith('```'):
                code.append(plain(lines[i]));i+=1
            i+=1
            story.append(Preformatted('\n'.join(code),STYLES['ManualCode']));continue
        if line.startswith('|'):
            raw=[line]
            while i<len(lines) and lines[i].strip().startswith('|'):
                raw.append(lines[i].strip());i+=1
            rows=[[c.strip() for c in row.strip('|').split('|')] for row in raw if not re.match(r'^\|[\s:|-]+\|$',row)]
            count=len(rows[0]);width=A4[0]-96
            widths=[width/count]*count
            if count==2:widths=[width*.34,width*.66]
            data=[[Paragraph(inline(c),STYLES['ManualCell']) for c in row] for row in rows]
            table=Table(data,colWidths=widths,repeatRows=1,hAlign='LEFT',spaceBefore=4,spaceAfter=13)
            table.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e5edf9')),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#f5f7fb')]),('LINEBELOW',(0,0),(-1,0),.6,colors.HexColor('#b5c7e2')),('BOTTOMPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),8),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8)]))
            story.append(table);continue
        list_match=re.match(r'^(\d+\.|-)\s+(.*)',line)
        if list_match:
            instructions=[]
            while list_match:
                marker,text=list_match.groups()
                instructions.append(BodyParagraph(inline(text),ParagraphStyle(name='ManualList',parent=STYLES['ManualBody'],leftIndent=15,firstLineIndent=0,bulletIndent=0),bulletText=marker))
                list_match=re.match(r'^(\d+\.|-)\s+(.*)',lines[i].strip()) if i<len(lines) else None
                if list_match:i+=1
            if story and isinstance(story[-1],BodyParagraph) and story[-1].style.keepWithNext:
                instructions.insert(0,story.pop())
            story.append(KeepTogether(instructions));continue
        paragraph=[line]
        while i<len(lines) and lines[i].strip() and not re.match(r'^(#|!\[|\||```|- |\d+\. )',lines[i].strip()):
            paragraph.append(lines[i].strip());i+=1
        style=STYLES['ManualBody']
        if i<len(lines):
            following=next((item.strip() for item in lines[i:] if item.strip()),'')
            if following.startswith('|') or re.match(r'^(\d+\.|-)\s+',following):
                style=ParagraphStyle(name='TableIntro',parent=style,keepWithNext=True)
        story.append(BodyParagraph(inline(' '.join(paragraph)),style))
    doc.multiBuild(story)
    # Replace a completed file rather than truncating a manual still being served.
    with tempfile.NamedTemporaryFile(dir=OUTPUT.parent,suffix='.tmp',delete=False) as temporary:
        temporary.write(pdf_buffer.getvalue())
        temporary_path=Path(temporary.name)
    try:
        temporary_path.replace(OUTPUT)
    finally:
        temporary_path.unlink(missing_ok=True)
    print(OUTPUT)

if __name__=='__main__':build()
