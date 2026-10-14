"""Generate Android vector and density icons from the lobby's four numbered tiles."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / 'android/app/src/main/res'
FONT = Path('C:/Windows/Fonts/segoeuib.ttf')
font = TTFont(FONT)
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()
tiles = [(29,29,'2','#77B9F9'),(56,29,'4','#67D6C0'),(29,56,'8','#A6DF7A'),(56,56,'16','#E3DF71')]

def rounded(x,y,w,h,r):
    return f'M{x+r},{y}H{x+w-r}Q{x+w},{y} {x+w},{y+r}V{y+h-r}Q{x+w},{y+h} {x+w-r},{y+h}H{x+r}Q{x},{y+h} {x},{y+h-r}V{y+r}Q{x},{y} {x+r},{y}Z'

paths = []
scale = 13 / font['head'].unitsPerEm
for x,y,label,color in tiles:
    paths.append(f'<path android:fillColor="{color}" android:pathData="{rounded(x,y,23,23,5)}"/>')
    paths.append(f'<path android:fillColor="#22000000" android:pathData="M{x},{y+17}Q{x},{y+21} {x+5},{y+21}H{x+18}Q{x+23},{y+21} {x+23},{y+17}V{y+18}Q{x+23},{y+23} {x+18},{y+23}H{x+5}Q{x},{y+23} {x},{y+18}Z"/>')
    width = sum(font['hmtx'][cmap[ord(c)]][0] for c in label)
    bounds = BoundsPen(glyphs)
    glyphs[cmap[ord(label[0])]].draw(bounds)
    top = bounds.bounds[3]
    cursor = x + (23 - width*scale)/2
    baseline = y + 11.5 + top*scale/2
    for c in label:
        pen = SVGPathPen(glyphs)
        glyphs[cmap[ord(c)]].draw(TransformPen(pen,(scale,0,0,-scale,cursor,baseline)))
        paths.append(f'<path android:fillColor="#112B50" android:pathData="{pen.getCommands()}"/>')
        cursor += font['hmtx'][cmap[ord(c)]][0]*scale
vector = '<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">\n'
group = '<group android:rotation="-8" android:pivotX="54" android:pivotY="54">\n'+'\n'.join(paths)+'\n</group>\n'
(RES/'drawable/blok_icon_foreground.xml').write_text(vector+group+'</vector>\n',encoding='utf8')
(RES/'drawable/blok_icon.xml').write_text(vector+'<path android:fillColor="#141A2E" android:pathData="M0,0H108V108H0Z"/>\n'+group+'</vector>\n',encoding='utf8')

# Raster fallbacks for Android 7 and launchers without adaptive icon support.
factor = 10
fg = Image.new('RGBA',(108*factor,108*factor))
d = ImageDraw.Draw(fg)
pf = ImageFont.truetype(str(FONT),13*factor)
for x,y,label,color in tiles:
    box = (x*factor,y*factor,(x+23)*factor,(y+23)*factor)
    d.rounded_rectangle(box, radius=5*factor,fill=color)
    d.text(((x+11.5)*factor,(y+11.5)*factor),label,font=pf,fill='#112B50',anchor='mm')
fg = fg.rotate(8,Image.Resampling.BICUBIC)
for density,size in [('mdpi',48),('hdpi',72),('xhdpi',96),('xxhdpi',144),('xxxhdpi',192)]:
    folder = RES/('mipmap-'+density)
    folder.mkdir(exist_ok=True)
    bg = Image.new('RGBA',fg.size,'#141A2E')
    bg.alpha_composite(fg)
    for name in ['ic_launcher','ic_launcher_round']:
        bg.resize((size,size),Image.Resampling.LANCZOS).save(folder/(name+'.png'))
    fg.resize((round(size*108/48),)*2,Image.Resampling.LANCZOS).save(folder/'ic_launcher_foreground.png')
preview = Image.new('RGBA',fg.size,'#141A2E')
preview.alpha_composite(fg)
preview.resize((432,432),Image.Resampling.LANCZOS).save(ROOT/'preview-app-icon.png')
print('Numbered, tilted launcher icons generated.')
