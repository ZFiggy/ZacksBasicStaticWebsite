"""Activate complete, visually reviewed teams from built-in image_gen edits."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
manifest_path = ROOT / 'public/assets/photo-search/consistent-crowd-scenes.json'
sets = json.loads(manifest_path.read_text())
reviews = json.loads((ROOT / 'tools/ai-search-review.json').read_text())
source_records = json.loads((ROOT / 'tools/real-search-placements.json').read_text())
for team, choices in reviews.items():
    if len(choices) != 5 or not all(isinstance(choice, int) and choice > 0 for choice in choices):
        continue
    scenes = []
    for level, choice in enumerate(choices):
        receipt_path = ROOT / f'tools/ai-search-receipts/{team}-{level + 1}.json'
        receipt = json.loads(receipt_path.read_text())
        assert receipt['team'] == team and receipt['level'] == level
        assert receipt['player'] == sets[team]['playerName']
        photo_path = ROOT / 'public' / receipt['src']
        assert photo_path.is_file()
        target = receipt['targetCandidates'][choice - 1]['target']
        x, y, w, h = target
        assert 0 <= x < x + w <= 1 and 0 <= y < y + h <= 1
        source = source_records[team][level]
        assert source['url'] == receipt['sourceImage']
        scene = dict(sets[team]['scenes'][level])
        scene.update(src=receipt['src'], target=target, kind='ai-integrated-photo',
                     sourcePage=receipt['sourcePage'], sourceImage=receipt['sourceImage'],
                     editedSha256=hashlib.sha256(photo_path.read_bytes()).hexdigest(),
                     originalSha256=source['backgroundSha256'],
                     clue='Compare the face, hairline, and expression with the reference. Look among the spectators.')
        receipt.update(reviewed=True, selectedCandidate=choice, target=target)
        receipt_path.write_text(json.dumps(receipt, indent=4) + '\n')
        scenes.append(scene)
    repaired = any(scene['src'].split('/')[-1].startswith(f'{team}-ai-v2-') for scene in scenes)
    sets[team].update(scenes=scenes, src=scenes[0]['src'], aiIntegrated=True, version=max(sets[team].get('version', 10), 11 if repaired else 10),
                      disclosure='Original real crowd photographs edited with AI to integrate the named player naturally. Fictional appearances for this fan game.')
manifest_path.write_text(json.dumps(sets, indent=4) + '\n')
print(f'Activated {sum(bool(s.get("aiIntegrated")) for s in sets.values())} complete, visually reviewed AI-edited teams.')
