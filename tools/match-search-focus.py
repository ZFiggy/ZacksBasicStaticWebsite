"""Apply user-authorized local blur to existing AI photo integrations.

No faces are pasted, moved, resized, or generated here. Accepted head bounds
remain unchanged. Every output is staged for visual review before activation.
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
cv2.setNumThreads(1)


def detail(gray):
    low = cv2.GaussianBlur(gray, (0, 0), 1.0)
    return float(np.std(gray - low) / max(3.0, np.std(gray)))


def crop_face(photo, box):
    x, y, w, h = box
    height, width = photo.shape[:2]
    # Keep the same proportional face region at the final image resolution.
    return photo[max(0, round((y + h * .22) * height)):min(height, round((y + h * .88) * height)),
                 max(0, round((x + w * .12) * width)):min(width, round((x + w * .88) * width))]


def blur_head(photo, target, sigma):
    x, y, w, h = target
    width, height = photo.size
    mask = Image.new('L', photo.size, 0)
    ImageDraw.Draw(mask).ellipse(((x - .18 * w) * width, (y - .14 * h) * height,
                                 (x + 1.18 * w) * width, (y + 1.34 * h) * height), fill=255)
    feather = max(2, w * width * .13)
    mask = mask.filter(ImageFilter.GaussianBlur(feather))
    return Image.composite(photo.filter(ImageFilter.GaussianBlur(sigma)), photo, mask), feather


# AI pose repairs start from their newly generated output, never the older v1
# photo. Keep the raw output so focus adjustments remain reproducible.
if len(sys.argv) > 1 and sys.argv[1] == '--ai':
    sigma = float(sys.argv[2])
    assert 0 < sigma <= 4
    for key in sys.argv[3:]:
        record_path = ROOT / f'tools/ai-search-repairs/{key}.json'
        record = json.loads(record_path.read_text())
        if record.get('method', '').startswith('User-authorized'):
            raise ValueError(f'{key} is a focus-only correction; use its calibrated filter setting.')
        source = record.get('generatedOutputPath', record['outputPath'])
        target = record['reviewedTarget']
        photo = Image.open(source).convert('RGB')
        after, feather = blur_head(photo, target, sigma)
        destination = ROOT / f'public/assets/photo-search/rounds/{record["team"]}-ai-v2-{record["round"]}.jpg'
        after.save(destination, quality=95, subsampling=0)
        record.update(generatedOutputPath=source, outputPath=str(destination),
                      method='AI pose repair followed by user-authorized local Gaussian blur',
                      sigmaPixels=sigma, maskFeatherPixels=feather,
                      status='AI repair and local blur; awaiting visual review')
        record_path.write_text(json.dumps(record, indent=4) + '\n')
        print(key, 'AI output retained; sigma', sigma)
    sys.exit(0)


jobs = json.loads((ROOT / 'tools/ai-search-repair-jobs.json').read_text())
settings = json.loads((ROOT / 'tools/ai-search-focus-settings.json').read_text())
keys = sys.argv[1:]
unknown = set(keys) - set(settings)
if unknown:
    raise ValueError(f'Ordinary mode is restricted to focus-only repairs: {sorted(unknown)}. Use --ai for new AI outputs.')
for job in jobs:
    if job['key'] not in keys:
        continue
    before = Image.open(ROOT / 'public' / job['beforeSrc']).convert('RGB')
    original = Image.open(job['sourcePath']).convert('RGB').resize(before.size, Image.Resampling.BICUBIC)
    gray = cv2.cvtColor(np.asarray(before), cv2.COLOR_RGB2GRAY).astype(np.float32)
    source_gray = cv2.cvtColor(np.asarray(original), cv2.COLOR_RGB2GRAY).astype(np.float32)
    sw, sh = job['sourceSize']
    left, top, right, bottom = job['headBounds']
    original_box = [left / sw, top / sh, (right - left) / sw, (bottom - top) / sh]
    reference = crop_face(source_gray, original_box)
    reference = cv2.GaussianBlur(reference, (0, 0), .35)
    target_detail = detail(reference)
    face = crop_face(gray, job['beforeTarget'])
    candidates = [.6, .9, 1.2, 1.6, 2.0, 2.5, 3.0, 3.5]
    sigma = min(candidates, key=lambda s: abs(detail(cv2.GaussianBlur(face, (0, 0), s)) - target_detail))
    # These values are proposals; selection is reviewed against nearby faces.
    x, y, w, h = job['beforeTarget']
    width, height = before.size
    # Visual calibration overrides the estimate: different hats, hair and skin
    # texture make automatic sharpness metrics insufficient for final choice.
    sigma = settings.get(job['key'], sigma)
    mask = Image.new('L', before.size, 0)
    ImageDraw.Draw(mask).ellipse(((x - .18 * w) * width, (y - .14 * h) * height,
                                 (x + 1.18 * w) * width, (y + 1.34 * h) * height), fill=255)
    feather = max(2, w * width * .13)
    mask = mask.filter(ImageFilter.GaussianBlur(feather))
    after = Image.composite(before.filter(ImageFilter.GaussianBlur(sigma)), before, mask)
    destination = ROOT / f'public/assets/photo-search/rounds/{job["team"]}-ai-v2-{job["round"]}.jpg'
    after.save(destination, quality=95, subsampling=0)
    record = {**job, 'method': 'User-authorized local Gaussian blur; AI-integrated person unchanged',
              'sigmaPixels': sigma, 'maskFeatherPixels': feather,
              'referenceDetail': target_detail, 'beforeDetail': detail(face),
              'afterDetail': detail(cv2.GaussianBlur(face, (0, 0), sigma)),
              'reviewedTarget': job['beforeTarget'], 'outputPath': str(destination),
              'src': str(destination.relative_to(ROOT / 'public')),
              'status': 'filtered; awaiting visual review'}
    (ROOT / f'tools/ai-search-repairs/{job["key"]}.json').write_text(json.dumps(record, indent=4) + '\n')
    print(job['key'], 'sigma', sigma)
