"""Import AI edits and propose target boxes for mandatory human visual review.

Image generation is performed with the built-in image_gen tool. This script
only packages its output and analyzes faces; it never paints player insertions.
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SCRATCH = Path('/private/tmp')
cv2.setNumThreads(1)
detector = cv2.FaceDetectorYN.create(str(SCRATCH / 'real-search-yunet.onnx'), '', (1280, 720), .72, .3, 5000)
recognizer = cv2.FaceRecognizerSF.create(str(SCRATCH / 'ai-search-sface.onnx'), '')


def faces(image):
    detector.setInputSize((image.shape[1], image.shape[0]))
    _, detected = detector.detect(image)
    return [] if detected is None else list(detected)


receipts = [json.loads(p.read_text()) for p in sorted((ROOT / 'tools/ai-search-receipts').glob('*.json'))]
teams = sys.argv[1:] or list(dict.fromkeys(r['team'] for r in receipts))
for team in teams:
    rounds = sorted((r for r in receipts if r['team'] == team), key=lambda r: r['level'])
    if all(row.get('reviewed') for row in rounds):
        print(team, 'already reviewed; preserving accepted images and target bounds', flush=True)
        continue
    portrait = cv2.imread(rounds[0]['portraitPath'])
    identity = max(faces(portrait), key=lambda f: f[2] * f[3])
    feature = recognizer.feature(recognizer.alignCrop(portrait, identity))
    sheet = Image.new('RGB', (1540, 5 * 370), '#ddd')
    draw = ImageDraw.Draw(sheet)
    for row in rounds:
        level = row['level']
        path = ROOT / f'public/assets/photo-search/rounds/{team}-ai-v1-{level + 1}.jpg'
        image = Image.open(row['outputPath']).convert('RGB')
        image.save(path, quality=95, subsampling=0)
        row['src'] = str(path.relative_to(ROOT / 'public'))
        photo = cv2.imread(str(path))
        height, width = photo.shape[:2]
        detected = faces(photo)
        enlarged = faces(cv2.resize(photo, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC))
        for face in enlarged:
            face[:14] /= 2
        detected += enlarged
        x, y, w, h = row['face']
        expected = np.array([(x + w / 2) / 1280, (y + h / 2) / 720])
        ranked = []
        for face in detected:
            center = np.array([(face[0] + face[2] / 2) / width, (face[1] + face[3] / 2) / height])
            distance = float(np.linalg.norm(center - expected))
            if distance > .35:
                continue
            embedding = recognizer.feature(recognizer.alignCrop(photo, face))
            similarity = float(recognizer.match(feature, embedding, cv2.FaceRecognizerSF_FR_COSINE))
            ranked.append((similarity - distance * .8, similarity, distance, face))
        distinct = []
        for candidate in sorted(ranked, key=lambda r: r[0], reverse=True):
            f = candidate[3]
            if any(np.linalg.norm(f[:2] - c[3][:2]) < min(f[2], c[3][2]) * .4 for c in distinct):
                continue
            distinct.append(candidate)
        assert distinct, f'No target proposals for {team}/{level + 1}'
        row['targetCandidates'] = []
        for choice, (_, similarity, distance, face) in enumerate(distinct[:3]):
            x, y, w, h = [float(n) for n in face[:4]]
            left, top = max(0, x - w * .17), max(0, y - h * .25)
            right, bottom = min(width, x + w * 1.17), min(height, y + h * 1.15)
            target = [left / width, top / height, (right - left) / width, (bottom - top) / height]
            row['targetCandidates'].append({'target': target, 'similarity': similarity, 'distance': distance})
            radius = max(60, w * 1.8)
            cx, cy = x + w / 2, y + h / 2
            crop = image.crop((round(cx - radius), round(cy - radius), round(cx + radius), round(cy + radius)))
            crop.thumbnail((290, 290))
            sheet.paste(crop, (650 + choice * 295, level * 370 + 45))
            draw.text((650 + choice * 295, level * 370 + 24), f'{choice + 1} | similarity {similarity:.2f}', fill='black')
        thumb = image.copy()
        thumb.thumbnail((640, 340))
        sheet.paste(thumb, (0, level * 370 + 25))
        draw.text((0, level * 370), f'{team} {level + 1} | {row["player"]}', fill='black')
        target = row['targetCandidates'][0]['target']
        x, y, w, h = target
        draw.rectangle((x * thumb.width, level * 370 + 25 + y * thumb.height,
                        (x + w) * thumb.width, level * 370 + 25 + (y + h) * thumb.height), outline='cyan', width=2)
        (ROOT / f'tools/ai-search-receipts/{team}-{level + 1}.json').write_text(json.dumps(row, indent=4) + '\n')
    sheet.save(SCRATCH / f'ai-search-review-{team}.jpg')
    print(team, 'ready for human review', flush=True)
