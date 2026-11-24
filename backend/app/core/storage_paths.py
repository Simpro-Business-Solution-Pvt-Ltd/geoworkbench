from pathlib import Path


def local_file_reference(path: Path, repo_root: Path) -> str:
    """Keep legacy relative references while supporting external durable storage."""
    absolute = path.resolve()
    try:
        return str(absolute.relative_to(repo_root.resolve()))
    except ValueError:
        return str(absolute)
