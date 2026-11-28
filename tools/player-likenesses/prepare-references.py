"""Arrange unmodified credited portraits as labeled image-generation references."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import json, sys
root = Path(__file__).resolve().parent
queue_name = sys.argv[1] if len(sys.argv) > 1 else 'queue.json'
queue = json.loads((root / queue_name).read_text())
prefix = 'pending-reference' if queue_name != 'queue.json' else 'reference'
font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 17)
for sheet in queue['sheets']:
    canvas = Image.new('RGB', (1536, 1536), '#d7e1e3')
    draw = ImageDraw.Draw(canvas)
    for i, p in enumerate(sheet['players']):
        x, y = i % 6 * 256, i // 6 * 256
        portrait = Image.open(root / 'references' / (p['id'] + '.png')).convert('RGBA')
        # The full reference remains on disk; this is a face-focused contact sheet.
        portrait.thumbnail((256, 205))
        canvas.paste(portrait, (x+(256-portrait.width)//2,y+5), portrait)
        draw.text((x+8,y+211), f"{i+1}: {p['name']}",font=font,fill='#102734')
        draw.text((x+8,y+234), f"{p['teamId']} / {p['role']}",font=font,fill='#183d49')
    for i in range(len(sheet['players']),36):
        x,y=i%6*256,i//6*256
        draw.text((x+8,y+120),'EMPTY',font=font,fill='#102734')
    canvas.save(root / f"{prefix}-{sheet['index']:02}.jpg",quality=94)
print(f'Prepared {len(queue["sheets"])} reference sheets.')
