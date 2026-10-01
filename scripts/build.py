from pathlib import Path
import json, zipfile
root = Path(__file__).resolve().parents[1]
version = json.loads((root / "manifest.json").read_text(encoding="utf-8"))["version"]
out = root / "dist" / f"nuvem-palavras-z-{version}.xpi"
out.parent.mkdir(exist_ok=True)
files = [root / name for name in ("manifest.json", "bootstrap.js", "plugin.js", "icon.svg")]
files += sorted(path for path in (root / "content").rglob("*") if path.is_file())
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as archive:
    for path in files:
        archive.write(path, path.relative_to(root))
print(out)
