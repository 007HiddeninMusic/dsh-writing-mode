"""Count Chinese/English text length under four conventions at once.

Why four: contests and platforms disagree about what counts. Some exclude
punctuation, some count every character including spaces, English material
counts words. Guessing gets an entry disqualified for being 30 characters over.

Usage:
    python wordcount.py <file>
    python wordcount.py <file> --json

Supports .md / .txt / .docx. ASCII-only status output so a GBK console cannot
garble the report.
"""
import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

CJK_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")
LATIN_WORD_RE = re.compile(r"[A-Za-z]+(?:['-][A-Za-z]+)*")
NUMBER_RE = re.compile(r"\d+(?:\.\d+)?")

CONVENTIONS = [
    ("han_only", "Han characters only"),
    ("han_plus_punctuation", "Han characters + punctuation"),
    ("chars_no_spaces", "All characters, spaces excluded"),
    ("chars_with_spaces", "All characters, spaces included"),
    ("mixed_words", "Mixed word count (CJK char = 1 word)"),
]


def read_text(path: Path) -> str:
    if path.suffix.lower() == ".docx":
        try:
            from docx import Document
        except ImportError:
            raise SystemExit("FAIL: python-docx is unavailable, cannot read .docx")
        doc = Document(str(path))
        parts = [p.text for p in doc.paragraphs]
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    parts.append(cell.text)
        return "\n".join(parts)
    return path.read_text(encoding="utf-8", errors="replace")


def measure(text: str) -> dict:
    cjk = len(CJK_RE.findall(text))
    punct = sum(1 for ch in text if unicodedata.category(ch).startswith("P"))
    spaces = sum(1 for ch in text if ch.isspace())
    latin_words = len(LATIN_WORD_RE.findall(text))
    numbers = len(NUMBER_RE.findall(text))
    return {
        "han_only": cjk,
        "han_plus_punctuation": cjk + punct,
        "chars_no_spaces": len(text) - spaces,
        "chars_with_spaces": len(text),
        "mixed_words": cjk + latin_words + numbers,
        "latin_words": latin_words,
        "punctuation_marks": punct,
        "paragraphs": sum(1 for line in text.splitlines() if line.strip()),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Count text length under four conventions.")
    parser.add_argument("file")
    parser.add_argument("--json", action="store_true", help="machine-readable output only")
    args = parser.parse_args()

    path = Path(args.file)
    if not path.exists():
        print(json.dumps({"error": "file not found", "path": str(path)}, ensure_ascii=True))
        return 2

    m = measure(read_text(path))

    if args.json:
        print(json.dumps({"file": str(path), "measures": m}, ensure_ascii=True, indent=2))
        return 0

    print(json.dumps({"file": str(path)}, ensure_ascii=True))
    for key, label in CONVENTIONS:
        print(f"{m[key]:>8}  {key:<22} {label}")
    print(f"{m['paragraphs']:>8}  paragraphs")
    print(f"{m['punctuation_marks']:>8}  punctuation marks")
    print()
    print("Report the convention explicitly, e.g. '1,480 Han characters (punctuation excluded)'.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
