from __future__ import annotations

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DIST_DIRECTORY = PROJECT_ROOT / "dist"
RELEASE_DIRECTORY = PROJECT_ROOT / "release"
PACKAGE_PATH = RELEASE_DIRECTORY / "duckcipline-0.1.0.zip"
MANIFEST_PATH = DIST_DIRECTORY / "manifest.json"


def main() -> None:
    if not MANIFEST_PATH.is_file():
        raise SystemExit("dist/manifest.json is missing. Run npm run build first.")

    RELEASE_DIRECTORY.mkdir(exist_ok=True)

    with ZipFile(PACKAGE_PATH, "w", ZIP_DEFLATED) as zip_file:
        for path in sorted(DIST_DIRECTORY.rglob("*")):
            if path.is_file():
                zip_file.write(path, path.relative_to(DIST_DIRECTORY))

    with ZipFile(PACKAGE_PATH) as zip_file:
        if "manifest.json" not in zip_file.namelist():
            raise SystemExit("Package is invalid: manifest.json is not at the zip root.")

    print(PACKAGE_PATH)


if __name__ == "__main__":
  main()
