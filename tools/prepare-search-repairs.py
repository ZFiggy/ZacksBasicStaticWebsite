"""Prepare original-photo edit inputs and review built-in image_gen repairs.

This helper only creates analysis guides, packages generated files, and records
visually accepted targets. It never draws or composites players into photos.
"""
import hashlib
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
AUDIT = ROOT / 'tools/ai-search-naturalness-audit.json'
JOBS = ROOT / 'tools/ai-search-repair-jobs.json'
REPAIRS = ROOT / 'tools/ai-search-repairs'
SCRATCH = Path('/private/tmp/search-naturalness-repairs')


def save(path, value):
    path.write_text(json.dumps(value, indent=4) + '\n')


def prepare():
    SCRATCH.mkdir(exist_ok=True)
    REPAIRS.mkdir(exist_ok=True)
    jobs = []
    for issue in json.loads(AUDIT.read_text())['repairs']:
        team, round_number = issue['team'], issue['round']
        key = f'{team}-{round_number}'
        receipt = json.loads((ROOT / f'tools/ai-search-receipts/{key}.json').read_text())
        original = Image.open(receipt['sourcePath']).convert('RGB')
        x, y, w, h = receipt['face']
        bounds = [max(0, round(x - w * .12)), max(0, round(y - h * .24)),
                  min(original.width, round(x + w * 1.12)), min(original.height, round(y + h * 1.15))]
        guide = original.copy()
        ImageDraw.Draw(guide).rectangle(bounds, outline='cyan', width=2)
        guide_path = SCRATCH / f'{key}-guide.jpg'
        guide.save(guide_path, quality=96)
        cx, cy = x + w / 2, y + h
        side = max(240, w * 7, h * 5)
        crop = original.crop((round(cx - side / 2), round(cy - side / 2), round(cx + side / 2), round(cy + side / 2)))
        crop_path = SCRATCH / f'{key}-original-context.jpg'
        crop.save(crop_path, quality=96)
        player = receipt['player']
        prompt = f"""Use case: identity-preserve / precise photographic compositing.
Image 1 is the ORIGINAL REAL CROWD PHOTO and the ONLY edit target. Image 2 supplies {player}'s face identity ONLY, not the pose, lighting, focus, jersey or expression. Image 3 is image 1 with a cyan rectangle locating the one original adult spectator to replace. Image 4 is an enlarged crop of that ORIGINAL spectator and nearby people; use it to match the original pose, body connection and optical focus, not as output framing.
Replace ONLY that boxed adult with {player} naturally present as an ordinary fan. Fit his identity INTO THE ORIGINAL PERSON, rather than putting a portrait over them. Preserve the original body silhouette, arm position, head footprint, head tilt, viewing direction, neck/shoulder relationship and distance from camera. Retain any cap, hood or sunglasses and ALL foreground obstructions. Adapt the visible skin, neck and ears coherently to the player's identity. Keep the spectator's existing casual team fan clothing and pose. Never enlarge the head, expose a hidden torso, move him forward, or turn his face toward the viewer for recognition.
Critical visual problem to fix: {issue['issue']}
The original spectator's head fits inside original-image pixel bounds {bounds}, in a {original.width} by {original.height} photograph. That is a strict maximum head footprint including hair: do not expand beyond it. His face must point where the ORIGINAL spectator looked, even if this is profile or looking down. Preserve natural candid expression and attention to the event.
OPTICAL FOCUS IS ESSENTIAL: the edited head, hair, ears and neck must have the SAME lens defocus, motion softness, grain, low contrast and resolution as the ORIGINAL spectator in image 4 and adjacent people at that depth. A defocused face must remain visibly defocused, even at the cost of facial detail. Do not sharpen, beautify, relight, restore, upscale or enhance the target person. No crisp eyes, razor hair edges, portrait lighting, glossy skin, oversized smile or isolated floating head. Match original sun/shade and skin shading. Restore foreground fence links, rails, hats, arms and people OVER the target wherever the original photo has them.
Keep the original real photograph's composition, every other person, foreground football players, mascots, children, background, signs, text, logos, geometry and framing unchanged. Do not invent new scenery or new spectators. Output ONLY the clean full image 1, same landscape aspect ratio, without the cyan guide, annotations, labels or collage."""
        jobs.append({**issue, 'key': key, 'player': player, 'sourcePath': receipt['sourcePath'],
                     'portraitPath': receipt['portraitPath'], 'guidePath': str(guide_path),
                     'contextPath': str(crop_path), 'headBounds': bounds,
                     'sourceSize': list(original.size), 'beforeSrc': receipt['src'],
                     'beforeTarget': receipt['target'], 'prompt': prompt})
    save(JOBS, jobs)
    print(f'Prepared {len(jobs)} original-photo repair briefs.')


def review(keys):
    for key in keys:
        path = REPAIRS / f'{key}.json'
        job = json.loads(path.read_text())
        final = Image.open(job['outputPath']).convert('RGB')
        destination = ROOT / f'public/assets/photo-search/rounds/{job["team"]}-ai-v2-{job["round"]}.jpg'
        if destination.resolve() != Path(job['outputPath']).resolve():
            final.save(destination, quality=95, subsampling=0)
        job['src'] = str(destination.relative_to(ROOT / 'public'))
        sw, sh = job['sourceSize']
        left, top, right, bottom = job['headBounds']
        job['proposedTarget'] = job.get('reviewedTarget', [left / sw, top / sh, (right - left) / sw, (bottom - top) / sh])
        # A proposal remains provisional until inspected against the new image.
        sheet = Image.new('RGB', (1500, 850), '#ddd')
        d = ImageDraw.Draw(sheet)
        for col, (label, photo) in enumerate([
            ('REPAIR', final), ('BEFORE', Image.open(ROOT / 'public' / job['beforeSrc'])),
            ('ORIGINAL', Image.open(job['sourcePath']))]):
            x, y, w, h = job['proposedTarget']
            cx, cy = x + w / 2, y + h
            side = max(220 / sw, w * 5.5, h * 2.5)
            radius = side * photo.width / 2
            crop = photo.crop((round(cx * photo.width - radius), round(cy * photo.height - radius),
                               round(cx * photo.width + radius), round(cy * photo.height + radius)))
            crop = crop.resize((480, 480), Image.Resampling.LANCZOS)
            sheet.paste(crop, (col * 500, 35))
            d.text((col * 500, 8), f'{key} | {label}', fill='black')
        thumb = final.copy()
        thumb.thumbnail((850, 320))
        sheet.paste(thumb, (0, 525))
        x, y, w, h = job['proposedTarget']
        d.rectangle((x * thumb.width, 525 + y * thumb.height, (x + w) * thumb.width, 525 + (y + h) * thumb.height), outline='cyan', width=2)
        sheet.save(SCRATCH / f'{key}-review.jpg', quality=94)
        save(path, job)
        print(key, 'packaged; visual review required')


def accept(keys):
    audit = json.loads(AUDIT.read_text())
    choices_path = ROOT / 'tools/ai-search-review.json'
    choices = json.loads(choices_path.read_text())
    for key in keys:
        path = REPAIRS / f'{key}.json'
        job = json.loads(path.read_text())
        receipt_path = ROOT / f'tools/ai-search-receipts/{key}.json'
        receipt = json.loads(receipt_path.read_text())
        receipt.setdefault('history', []).append(dict(receipt, history=[]))
        target = job.get('reviewedTarget', job['proposedTarget'])
        x, y, w, h = target
        assert 0 <= x < x + w <= 1 and 0 <= y < y + h <= 1
        executed_prompt = receipt['prompt'] if job.get('method', '').startswith('User-authorized') else job['prompt']
        receipt.update(prompt=executed_prompt, outputPath=job['outputPath'], src=job['src'],
                       target=target, targetCandidates=[{'target': target, 'method': 'Visually reviewed full-head bounds'}],
                       selectedCandidate=1, reviewed=True, assetRevision=2, naturalnessRepair=key)
        if 'sigmaPixels' in job:
            receipt['focusCorrection'] = {k: job[k] for k in ['sigmaPixels', 'maskFeatherPixels', 'method']}
        save(receipt_path, receipt)
        job['status'] = 'accepted-after-visual-review'
        save(path, job)
        choices[job['team']][job['round'] - 1] = 1
        next(r for r in audit['repairs'] if r['team'] == job['team'] and r['round'] == job['round'])['status'] = job['status']
    save(choices_path, choices)
    audit['completedRepairs'] = sum(r['status'] == 'accepted-after-visual-review' for r in audit['repairs'])
    audit['pendingRepairs'] = len(audit['repairs']) - audit['completedRepairs']
    audit['status'] = 'complete' if not audit['pendingRepairs'] else 'repairs in progress'
    save(AUDIT, audit)
    print('Recorded', len(keys), 'visually accepted repairs.')


def boards(keys):
    records = [json.loads(p.read_text()) for p in sorted(REPAIRS.glob('*.json'))]
    records = [r for r in records if r['key'] in keys] if keys else [r for r in records if r.get('sigmaPixels') is not None]
    for start in range(0, len(records), 5):
        group = records[start:start + 5]
        sheet = Image.new('RGB', (1450, len(group) * 340), '#ddd')
        draw = ImageDraw.Draw(sheet)
        for row, job in enumerate(group):
            page = Image.open(SCRATCH / f'{job["key"]}-review.jpg')
            overview = page.crop((0, 525, 570, 845))
            overview.thumbnail((490, 300))
            sheet.paste(overview, (0, row * 340 + 28))
            for col in range(3):
                crop = page.crop((col * 500, 35, col * 500 + 480, 515)).resize((310, 310))
                sheet.paste(crop, (500 + col * 315, row * 340 + 28))
            draw.text((0, row * 340 + 7), f'{job["key"]} | blur {job.get("sigmaPixels", "AI")} | repair / before / original', fill='black')
        sheet.save(SCRATCH / f'review-batch-{start // 5 + 1}.jpg', quality=94)
    print('Review boards:', (len(records) + 4) // 5)


if __name__ == '__main__':
    if sys.argv[1] == 'prepare':
        prepare()
    elif sys.argv[1] == 'review':
        review(sys.argv[2:])
    elif sys.argv[1] == 'accept':
        accept(sys.argv[2:])
    elif sys.argv[1] == 'boards':
        boards(sys.argv[2:])
