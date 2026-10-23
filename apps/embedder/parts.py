"""Splits a long text into parts the model can read whole, and joins the parts' vectors into one.

BGE-M3 reads at most 512 tokens at a time (two of them are its own start and end marks), so a long
piece used to be read only up to there. A text that fits is left whole, so its vector is exactly
what it was; a longer one is cut at token boundaries into parts of up to 500 tokens, each part is
embedded, and the vectors are averaged, each weighted by its number of tokens, then normalised.
A slice read again on its own can come out a token longer than where it was cut, so the parts
leave room below the model's 510.
"""
import numpy as np

FITS_TOKENS = 510
PART_TOKENS = 500


def split_parts(text, tokenizer, part_tokens=PART_TOKENS):
    """The text itself when it fits, otherwise consecutive slices of it of up to `part_tokens` tokens each.
    Returns (parts, token counts). The slices are cut from the original text, so nothing is rewritten."""
    encoded = tokenizer(text, add_special_tokens=False, return_offsets_mapping=True)
    offsets = encoded["offset_mapping"]
    if len(offsets) <= FITS_TOKENS:
        return [text], [max(len(offsets), 1)]
    parts, counts = [], []
    for start in range(0, len(offsets), part_tokens):
        window = offsets[start : start + part_tokens]
        begin = window[0][0]
        # The next part starts where its first token starts, so the space between them belongs to neither.
        end = offsets[start + part_tokens][0] if start + part_tokens < len(offsets) else len(text)
        parts.append(text[begin:end])
        counts.append(len(window))
    return parts, counts


def join_vectors(vectors, counts):
    """One normalised vector from the parts' vectors, each weighted by its number of tokens."""
    weights = np.asarray(counts, dtype=np.float32)[:, None]
    mean = (np.asarray(vectors, dtype=np.float32) * weights).sum(axis=0) / weights.sum()
    return mean / np.linalg.norm(mean)
