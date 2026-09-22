#!/usr/bin/env python3
"""
Scan a piece of text for the most common statistical "AI writing" tells:
overused vocabulary, boilerplate phrases, em-dash density, and low
sentence-length variation (burstiness).

This is a supporting signal, not a verdict. Read references/signs-of-ai-writing.md
in this skill for why no single flag here means much on its own -- it's the
combination and density of flags that's worth acting on.

Usage:
    python check_ai_tells.py <path-to-text-file>
    python check_ai_tells.py -   # read from stdin
"""
import sys
import re
import json
import statistics

BANNED_WORDS = [
    "delve", "tapestry", "pivotal", "underscore", "underscores", "foster",
    "fostering", "testament", "enhance", "intricate", "intricacies",
    "landscape", "boast", "boasts", "bolstered", "garner", "showcase",
    "meticulous", "meticulously", "robust", "vibrant", "realm", "beacon",
    "multifaceted", "noteworthy", "kaleidoscope", "nuanced", "comprehend",
    "commendable", "resonate", "illuminate", "compelling", "seamless",
    "transformative", "ever-evolving", "synergistic", "thought-provoking",
    "exemplary", "leverage", "synergy", "elevate", "unleash",
    "game-changing", "groundbreaking", "revolutionize", "revolutionary",
    "utilize", "commence", "facilitate", "endeavor", "ascertain", "nestled",
]

BANNED_PHRASES = [
    "it's important to note", "it is important to note",
    "it's worth noting", "it is worth noting",
    "a testament to",
    "in today's fast-paced", "in today's digital",
    "imagine a world", "picture this",
    "let's dive deeper", "let's delve",
    "i hope this email finds you well",
    "not an exhaustive list",
    "as an ai language model",
    "in conclusion", "in summary",
    "rich cultural heritage", "in the heart of",
]

def load_text(path):
    if path == "-":
        return sys.stdin.read()
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def find_hits(text_lower, terms):
    hits = {}
    for term in terms:
        count = len(re.findall(r"\b" + re.escape(term) + r"\b", text_lower))
        if count:
            hits[term] = count
    return hits

def sentence_lengths(text):
    # crude sentence splitter -- good enough for a style heuristic, not linguistics
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    lengths = [len(s.split()) for s in sentences if s.strip()]
    return lengths

def paragraph_lengths(text):
    paras = [p for p in re.split(r"\n\s*\n", text.strip()) if p.strip()]
    return [len(p.split()) for p in paras]

def analyze(text):
    text_lower = text.lower()
    word_count = len(text.split())
    em_dash_count = text.count("—") + text.count("--")
    lengths = sentence_lengths(text)
    para_lengths = paragraph_lengths(text)

    avg_sentence_len = round(statistics.mean(lengths), 1) if lengths else 0
    stdev_sentence_len = round(statistics.pstdev(lengths), 1) if len(lengths) > 1 else 0

    result = {
        "word_count": word_count,
        "banned_word_hits": find_hits(text_lower, BANNED_WORDS),
        "banned_phrase_hits": find_hits(text_lower, BANNED_PHRASES),
        "em_dash_count": em_dash_count,
        "em_dash_per_100_words": round(em_dash_count / word_count * 100, 2) if word_count else 0,
        "sentence_count": len(lengths),
        "avg_sentence_length_words": avg_sentence_len,
        "sentence_length_stdev": stdev_sentence_len,
        "burstiness_ratio": round(stdev_sentence_len / avg_sentence_len, 2) if avg_sentence_len else 0,
        "paragraph_count": len(para_lengths),
        "paragraph_lengths_words": para_lengths,
    }
    return result

def summarize(result):
    lines = []
    lines.append(f"Word count: {result['word_count']}")
    if result["banned_word_hits"]:
        lines.append(f"Flagged vocabulary ({sum(result['banned_word_hits'].values())} hits): "
                      + ", ".join(f"{w}x{c}" for w, c in result["banned_word_hits"].items()))
    else:
        lines.append("Flagged vocabulary: none")
    if result["banned_phrase_hits"]:
        lines.append(f"Boilerplate phrases: " + ", ".join(
            f'"{p}"x{c}' for p, c in result["banned_phrase_hits"].items()))
    else:
        lines.append("Boilerplate phrases: none")
    lines.append(f"Em dashes: {result['em_dash_count']} "
                 f"({result['em_dash_per_100_words']} per 100 words)")
    lines.append(f"Sentence length: avg {result['avg_sentence_length_words']} words, "
                 f"stdev {result['sentence_length_stdev']} "
                 f"(burstiness ratio {result['burstiness_ratio']} -- "
                 f"below ~0.3 suggests suspiciously uniform sentence lengths)")
    return "\n".join(lines)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    text = load_text(sys.argv[1])
    result = analyze(text)
    print(summarize(result))
    print()
    print(json.dumps(result, indent=2))
