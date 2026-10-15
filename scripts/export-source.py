"""Export only source/configuration; never copy dependencies, local databases or secrets."""
from pathlib import Path
import json
import zipfile

ROOT = Path(__file__).resolve().parent.parent
ROOT_FILES = {
    'README.md', 'package.json', 'package-lock.json', 'tsconfig.json',
    'playwright.config.ts', 'compose.yaml', 'Dockerfile', '.gitignore',
    '.gitattributes', '.dockerignore', '.prettierignore', '.env.example', 'vercel.json', '.vercelignore',
}
DIRECTORIES = ('apps', 'database', 'docs', 'infra', 'scripts', 'tests', '.github')
EXCLUDED = {'node_modules', '.next', 'dist', '.local', '.git', '.vercel', '__pycache__', 'test-results', 'playwright-report', 'coverage'}


def eligible(path: Path) -> bool:
    relative = path.relative_to(ROOT)
    return (not any(part in EXCLUDED for part in relative.parts)
            and not any(parent.is_symlink() for parent in (path, *path.parents) if parent != ROOT.parent)
            and not path.name.endswith(('.log', '.tsbuildinfo', '.zip', '.pyc'))
            and not (path.name.startswith('.env') and path.name != '.env.example')
            and path.is_file())


def main():
    files = [ROOT / name for name in ROOT_FILES if (ROOT / name).is_file()]
    for folder in DIRECTORIES:
        base = ROOT / folder
        if base.is_dir() and not base.is_symlink():
            # Prune generated directories before traversal (do not enumerate dependencies).
            import os
            for directory, children, names in os.walk(base, followlinks=False):
                children[:] = [name for name in children if name not in EXCLUDED and not (Path(directory) / name).is_symlink()]
                files.extend(Path(directory) / name for name in names)
    files = sorted(set(path for path in files if eligible(path)))
    output = ROOT / '.local' / 'vigia-github.zip'
    output.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for path in files:
            if path.stat().st_size > 5 * 1024 * 1024:
                raise ValueError(f'Arquivo inesperadamente grande: {path.relative_to(ROOT)}')
            archive.write(path, path.relative_to(ROOT).as_posix())
    summary = {'archive': str(output), 'files': len(files), 'source_bytes': sum(p.stat().st_size for p in files), 'zip_bytes': output.stat().st_size}
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
