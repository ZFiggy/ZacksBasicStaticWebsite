"""Review helpers for photographic search composites. No network or credentials.

Requires Pillow and OpenCV. Saved placements reproduce the curated scenes with
render; align only proposes candidate faces for a new visual review. Face detection suggests locations only;
the final scene and enlarged target must both receive a human visual review.
"""
import hashlib
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / 'public'
SCRATCH = Path('/private/tmp')


def make_cutouts():
    crops = json.loads((ROOT / 'tools/real-search-portrait-crops.json').read_text())
    for team, name, *_ in json.loads((ROOT / 'tools/real-search-players.json').read_text()):
        portrait = Image.open(PUBLIC / f'assets/photo-search/real-players/{team}.png').convert('RGBA')
        x, y, w, h = crops[team][0]
        box = (round(x - w * .16), round(y - h * .38), round(x + w * 1.16), round(y + h * 1.23))
        head = portrait.crop(box)
        # Keep the photographic hair/ear alpha. Taper just the lower neck, so
        # an unrelated team's current jersey never enters the composite.
        mask = Image.new('L', head.size, 0)
        draw = ImageDraw.Draw(mask)
        bottom = round(h * 1.60)
        draw.polygon([(0, 0), (head.width, 0), (head.width, round(h * 1.30)),
                      (round(head.width * .63), bottom), (round(head.width * .37), bottom),
                      (0, round(h * 1.30))], fill=255)
        for row in range(round(h * 1.45), mask.height):
            opacity = round(255 * max(0, (mask.height - row) / (h * .16)))
            for col in range(mask.width):
                mask.putpixel((col, row), min(mask.getpixel((col, row)), opacity))
        mask = mask.filter(ImageFilter.GaussianBlur(2))
        import PIL.ImageChops
        head.putalpha(PIL.ImageChops.multiply(head.getchannel('A'), mask))
        head.save(PUBLIC / f'assets/photo-search/real-players/{team}-head.png')


def render():
    current = json.loads((PUBLIC / 'assets/photo-search/consistent-crowd-scenes.json').read_text())
    if any(s.get('aiIntegrated') for s in current.values()):
        raise SystemExit('Legacy face-cutout renderer cannot overwrite accepted AI-integrated scenes. Use adopt-ai-search.py for reviewed AI edits.')
    placements = json.loads((ROOT / 'tools/real-search-placements.json').read_text())
    players = {p[0]: p for p in json.loads((ROOT / 'tools/real-search-players.json').read_text())}
    sets = {}
    for team, scenes in placements.items():
        _, name, athlete_id, joined, number = players[team]
        cutout = Image.open(PUBLIC / f'assets/photo-search/real-players/{team}-head.png').convert('RGBA')
        rounds = []
        review = Image.new('RGB', (1160, len(scenes) * 330), '#eee')
        draw = ImageDraw.Draw(review)
        for level, scene in enumerate(scenes):
            source_path = ROOT / scene['path']
            assert hashlib.sha256(source_path.read_bytes()).hexdigest() == scene['backgroundSha256'], source_path
            original = Image.open(source_path).convert('RGB')
            photo = original.copy()
            x, y, w, h = scene['face']
            # Placement describes the visible head, not a reduced hit box.
            head = ImageEnhance.Brightness(cutout).enhance(scene.get('brightness', .9))
            head = ImageEnhance.Color(head).enhance(scene.get('saturation', .88))
            rgba = np.asarray(head, dtype=np.float32) / 255
            rgba[:, :, :3] *= np.asarray(scene.get('tint', [1, 1, 1]))
            rgba[:, :, :3] = np.clip(rgba[:, :, :3], 0, 1) * rgba[:, :, 3:4]
            layer = cv2.warpAffine(rgba, np.array(scene['matrix']), original.size, flags=cv2.INTER_CUBIC)
            radius = scene.get('blur', .5)
            layer = cv2.GaussianBlur(layer, (0, 0), radius)
            alpha = np.clip(layer[:, :, 3:4], 0, 1)
            rgb = np.clip(layer[:, :, :3] + np.asarray(original, dtype=np.float32) / 255 * (1 - alpha), 0, 1)
            photo = Image.fromarray(np.uint8(np.round(rgb * 255)))
            visible = Image.fromarray(np.uint8(np.clip(alpha[:, :, 0] * 255, 0, 255))).point(lambda value: 255 if value > 12 else 0).getbbox()
            left, top, right, bottom = visible
            head_width, head_height = right - left, bottom - top
            # Restore any explicitly traced foreground cover from the original.
            if scene.get('occlusion'):
                cover = Image.new('L', photo.size, 0)
                ImageDraw.Draw(cover).polygon([tuple(point) for point in scene['occlusion']], fill=255)
                photo.paste(original, (0, 0), cover)
            path = f'assets/photo-search/rounds/{team}-real-{level + 1}.jpg'
            photo.save(PUBLIC / path, quality=94, subsampling=0)
            padding = 4
            target_box = [max(0, left - padding), max(0, top - padding), min(photo.width, left + head_width + padding), min(photo.height, top + head_height + padding)]
            target = [target_box[0] / photo.width, target_box[1] / photo.height,
                      (target_box[2] - target_box[0]) / photo.width, (target_box[3] - target_box[1]) / photo.height]
            rounds.append({'index': level, 'name': scene.get('name', ['Beyond the front row', 'Between the jerseys', 'Among the supporters', 'Lost in the stands', 'One familiar face'][level]),
                           'difficulty': ['Hard', 'Harder', 'Very hard', 'Expert', 'Final challenge'][level],
                           'clue': scene.get('clue', 'Compare the hairline, eyes, and smile with the face reference.'),
                           'target': target, 'src': path, 'kind': 'photographic-composite',
                           'sourcePage': scene['page'], 'credit': scene['credit'], 'sourceImage': scene['url']})
            thumbnail = photo.copy()
            thumbnail.thumbnail((760, 300))
            review.paste(thumbnail, (0, level * 330 + 24))
            crop = photo.crop((max(0, left - 65), max(0, top - 55), min(photo.width, left + head_width + 65), min(photo.height, top + head_height + 75)))
            crop = crop.resize((crop.width * 2, crop.height * 2), Image.Resampling.NEAREST)
            crop.thumbnail((360, 295))
            review.paste(crop, (780, level * 330 + 24))
            draw.text((0, level * 330), f"{team} {level + 1} | source {scene['index']} | head {head_width}x{head_height}", fill='black')
        review.save(SCRATCH / f'real-final-{team}.jpg')
        sets[team] = {'src': rounds[0]['src'], 'cols': 1, 'rows': 1, 'referenceIndex': 0,
                      'playerName': name, 'number': number, 'teamJoined': joined, 'era': f'Joined the team in {joined}',
                      'sourcePage': rounds[0]['sourcePage'], 'credit': rounds[0]['credit'], 'scenes': rounds,
                      'disclosure': 'Real crowd photographs with a real player photograph inserted using conventional compositing. Fictional appearances; no AI-generated scenery or faces.',
                      'referenceSrc': f'assets/photo-search/real-players/{team}-head.png',
                      'referencePage': f'https://www.espn.com/nfl/player/_/id/{athlete_id}',
                      'referenceCredit': 'ESPN / photographic player portrait', 'version': 9,
                      'authentic': False, 'consistentPerson': True, 'photographicComposite': True}
    if len(sets) == 31 and all(len(s['scenes']) == 5 for s in sets.values()):
        (PUBLIC / 'assets/photo-search/consistent-crowd-scenes.json').write_text(json.dumps(sets, indent=4) + '\n')
    print(f'Rendered {sum(len(s) for s in placements.values())} photographic rounds.')


def verify():
    """Check provenance, transparency, native size, and localized photo edits."""
    placements = json.loads((ROOT / 'tools/real-search-placements.json').read_text())
    sets = json.loads((PUBLIC / 'assets/photo-search/consistent-crowd-scenes.json').read_text())
    players = json.loads((PUBLIC / 'assets/photo-search/real-player-sources.json').read_text())
    assert len(placements) == len(sets) == len(players) == 31
    for player in players:
        assert player['teamJoined'] >= 2015
        # A player can join before his first regular-season appearance (Love).
        assert player['verifiedTeamSeasons'] and min(player['verifiedTeamSeasons']) >= player['teamJoined']
        for kind in ['portrait', 'cutout']:
            path = PUBLIC / player[kind + 'Path']
            assert hashlib.sha256(path.read_bytes()).hexdigest() == player[kind + 'Sha256'], path
        alpha = np.asarray(Image.open(PUBLIC / player['cutoutPath']).getchannel('A'))
        assert (alpha == 0).any() and (alpha == 255).any(), player['team']
    for team, scenes in placements.items():
        assert len(scenes) == 5
        assert len({s['backgroundSha256'] for s in scenes}) == 5
        for index, source in enumerate(scenes):
            path = ROOT / source['path']
            assert hashlib.sha256(path.read_bytes()).hexdigest() == source['backgroundSha256'], path
            original = np.asarray(Image.open(path).convert('RGB'), dtype=np.int16)
            scene = sets[team]['scenes'][index]
            if sets[team].get('aiIntegrated'):
                assert scene['kind'] == 'ai-integrated-photo'
                edited_path = PUBLIC / scene['src']
                assert hashlib.sha256(edited_path.read_bytes()).hexdigest() == scene['editedSha256']
                assert scene['originalSha256'] == source['backgroundSha256']
                with Image.open(edited_path) as edited:
                    assert edited.format == 'JPEG'
                    assert edited.width >= 1280 and edited.height >= 720
                    edited.verify()
                x, y, w, h = scene['target']
                assert 0 <= x < x + w <= 1 and 0 <= y < y + h <= 1
                receipt = json.loads((ROOT / f'tools/ai-search-receipts/{team}-{index + 1}.json').read_text())
                assert receipt['reviewed'] and receipt['target'] == scene['target']
                continue
            composite = np.asarray(Image.open(PUBLIC / scene['src']).convert('RGB'), dtype=np.int16)
            assert original.shape == composite.shape, scene['src']
            height, width = original.shape[:2]
            assert width >= 1280 and height >= 720
            x, y, w, h = scene['target']
            assert 0 <= x < x + w <= 1 and 0 <= y < y + h <= 1
            # Extra margin includes feathering and JPEG block compression.
            left, top = max(0, int(x * width) - 16), max(0, int(y * height) - 16)
            right, bottom = min(width, int((x + w) * width) + 16), min(height, int((y + h) * height) + 16)
            difference = np.abs(original - composite).mean(axis=2)
            outside = np.ones((height, width), dtype=bool)
            outside[top:bottom, left:right] = False
            assert difference[outside].mean() < 3, f'Background changed outside insertion: {team}/{index + 1}'
            assert difference[top:bottom, left:right].mean() > 1, f'Missing insertion: {team}/{index + 1}'
    ai_count = sum(bool(s.get('aiIntegrated')) for s in sets.values()) * 5
    print(f'PASS 31 verified player inputs and 155 distinct team photo inputs; {ai_count} reviewed AI edits and {155 - ai_count} legacy composites. Source/output hashes, image sizes, bounded targets, and legacy insertion regions checked.')


def align():
    """Suggest real faces using eyes/nose/mouth landmarks, then review every result."""
    candidates = json.loads((ROOT / 'tools/real-search-sources.json').read_text())
    selections = {}
    for source in candidates:
        selections.setdefault(source['team'], []).append(source['index'])
    records = {(r['team'], r['index']): r for r in candidates}
    crops = json.loads((ROOT / 'tools/real-search-portrait-crops.json').read_text())
    detector = cv2.FaceDetectorYN.create(str(SCRATCH / 'real-search-yunet.onnx'), '', (1280, 720), .78, .3, 5000)

    def detect(image):
        detector.setInputSize((image.shape[1], image.shape[0]))
        _, faces = detector.detect(image)
        return [] if faces is None else faces.tolist()

    def landmarks(face):
        return np.float32([face[4:6], face[6:8], [(face[10] + face[12]) / 2, (face[11] + face[13]) / 2]])

    def skin(image, face):
        x, y, w, h = face[:4]
        patch = image[round(y + h * .43):round(y + h * .73), round(x + w * .35):round(x + w * .65)]
        return np.median(patch.reshape(-1, 3), axis=0) if patch.size else np.array([128., 128., 128.])

    placements = json.loads((ROOT / 'tools/real-search-placements.json').read_text())
    options_path = SCRATCH / 'real-search-placement-options.json'
    options = json.loads(options_path.read_text()) if options_path.exists() else {}
    for team, indexes in selections.items():
        if sys.argv[2:] and team not in sys.argv[2:]:
            continue
        portrait = cv2.imread(str(PUBLIC / f'assets/photo-search/real-players/{team}.png'))
        identity = max(detect(portrait), key=lambda f: f[2] * f[3])
        player_skin = skin(portrait, identity)
        px, py, pw, ph = crops[team][0]
        offset = np.array([round(px - pw * .16), round(py - ph * .38)])
        origin = landmarks(identity) - offset
        placements[team] = []
        options[team] = []
        sheet = Image.new('RGB', (1600, 5 * 270), '#eee')
        labels = ImageDraw.Draw(sheet)
        for level, index in enumerate(indexes):
            record = records[(team, index)]
            image = cv2.imread(str(ROOT / record['path']))
            faces = detect(image)
            # Detection may inspect an enlargement, but saved photographs and
            # insertion coordinates always retain the original pixel size.
            enlarged = detect(cv2.resize(image, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC))
            for face in enlarged:
                face[:14] = [value / 2 for value in face[:14]]
            faces += enlarged
            # These photographs include a field or sideline below the stands.
            # Search for the inserted player among spectators, above the rail.
            crowd_top = {('giants', 542): .49, ('giants', 521): .49, ('giants', 547): .49,
                         ('giants', 1): .49, ('49ers', 3): .57, ('bengals', 512): .44,
                         ('saints', 2256): .51, ('titans', 11): .72, ('titans', 9): .64,
                         ('titans', 4): .65, ('titans', 7): .65, ('titans', 513): .60,
                         ('broncos', 544): .56, ('broncos', 543): .66, ('broncos', 541): .60}
            if (team, index) in crowd_top:
                faces = [f for f in faces if f[1] + f[3] / 2 < image.shape[0] * crowd_top[(team, index)]]
            eligible = []
            for f in faces:
                x, y, w, h = f[:4]
                eye_gap = f[6] - f[4]
                yaw = (f[8] - f[4]) / max(1, eye_gap)
                if 15 <= w <= 65 and h >= 18 and x > 25 and y > 20 and x + w < image.shape[1] - 25 and y + h < image.shape[0] - 20 and .18 < yaw < .82 and eye_gap > w * .28:
                    eligible.append(f)
            if not eligible:
                eligible = [f for f in faces if f[2] < 110] or faces
            assert eligible, f'No genuine face found: {team}/{index}'

            def score(f):
                x, y, w, h = f[:4]
                preferred = [.3, .7, .4, .77, .55][level]
                return abs(w - 29) / 40 + abs((x + w / 2) / image.shape[1] - preferred) * .5 + max(0, (y + h / 2) / image.shape[0] - .65) + np.linalg.norm(skin(image, f) - player_skin) / 160

            distinct = []
            for face in sorted(eligible, key=score):
                center = np.array([face[0] + face[2] / 2, face[1] + face[3] / 2])
                if any(np.linalg.norm(center - np.array([f[0] + f[2] / 2, f[1] + f[3] / 2])) < min(face[2], f[2]) * .5 for f in distinct):
                    continue
                distinct.append(face)
            choices = []
            for choice, face in enumerate(distinct[:8]):
                matrix, _ = cv2.estimateAffinePartial2D(origin, landmarks(face), method=cv2.LMEDS)
                color = skin(image, face)
                brightness = float(np.clip(color.mean() / max(1, player_skin.mean()), .66, 1.10))
                tint = np.clip((color / max(1, color.mean())) / (player_skin / max(1, player_skin.mean())), .82, 1.22)[::-1]
                result = dict(record)
                result.update(face=[round(v, 2) for v in face[:4]], landmarks=landmarks(face).tolist(), matrix=matrix.tolist(), brightness=round(brightness, 3), saturation=.93, tint=tint.tolist(), blur=.7)
                result['credit'] = record['page'].split('/')[2].removeprefix('www.') + ' / official team photography'
                choices.append(result)
                x, y, w, h = face[:4]
                context = Image.open(ROOT / record['path']).crop((max(0, round(x - w * .8)), max(0, round(y - h * .6)), min(image.shape[1], round(x + w * 1.8)), min(image.shape[0], round(y + h * 2.5))))
                context.thumbnail((198, 240))
                context = context.resize((round(context.width * min(198 / context.width, 240 / context.height)), round(context.height * min(198 / context.width, 240 / context.height))), Image.Resampling.NEAREST)
                sheet.paste(context, (choice * 200, level * 270 + 25))
                labels.text((choice * 200, level * 270), f'{team} {level + 1}.{choice + 1} | {index}', fill='black')
            options[team].append(choices)
            placements[team].append(choices[0])
        sheet.save(SCRATCH / f'real-choices-{team}.jpg')
        print(team, [round(s['face'][2]) for s in placements[team]], flush=True)
    # Suggestions never overwrite the reviewed placements used by render.
    (SCRATCH / 'real-search-suggested-placements.json').write_text(json.dumps(placements, indent=4) + '\n')
    (SCRATCH / 'real-search-placement-options.json').write_text(json.dumps(options))


if __name__ == '__main__':
    if sys.argv[1:] == ['cutouts']:
        make_cutouts()
    elif sys.argv[1:] == ['render']:
        render()
    elif sys.argv[1:] == ['verify']:
        verify()
    elif sys.argv[1:2] == ['align']:
        align()
