from pathlib import Path
import json, zipfile
root = Path(__file__).resolve().parent.parent
out = root / "artifacts"
out.mkdir(exist_ok=True)
manifest = json.loads((root / "system.json").read_text())
with zipfile.ZipFile(out / "stellaknights-v14.zip", "w", zipfile.ZIP_DEFLATED) as archive:
    for name in ["system.json", "template.json", "README.md", "LICENSE", "LICENSE.txt", "module", "assets", "data", "lang", "styles", "templates"]:
        entry = root / name
        paths = sorted(entry.rglob("*")) if entry.is_dir() else [entry]
        for path in paths:
            if path.is_file():
                archive.write(path, Path("stellaknights") / path.relative_to(root))
(out / "system.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
print(out / "stellaknights-v14.zip")
