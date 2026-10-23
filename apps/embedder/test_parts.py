"""Checks the part splitting with BGE-M3's own tokenizer: python -m unittest test_parts"""
import unittest

import numpy as np
from transformers import AutoTokenizer

from parts import FITS_TOKENS, PART_TOKENS, join_vectors, split_parts

tokenizer = AutoTokenizer.from_pretrained("BAAI/bge-m3", revision="9a0624b896d81da7492a910ffa53731274b6cf3d")
count = lambda text: len(tokenizer(text, add_special_tokens=False)["input_ids"])


class SplitParts(unittest.TestCase):
    def test_a_text_that_fits_stays_whole(self):
        text = "The kettle sang on the stove while the rain kept on."
        self.assertEqual(split_parts(text, tokenizer), ([text], [count(text)]))

    def test_a_text_of_exactly_the_most_the_model_reads_stays_whole(self):
        words = "rain " * 1000
        ids = tokenizer(words, add_special_tokens=False, return_offsets_mapping=True)["offset_mapping"]
        text = words[: ids[FITS_TOKENS][0]]
        self.assertEqual(count(text), FITS_TOKENS)
        self.assertEqual(split_parts(text, tokenizer)[0], [text])
        self.assertGreater(len(split_parts(text + " rain", tokenizer)[0]), 1)

    def test_an_empty_text_is_one_empty_part(self):
        self.assertEqual(split_parts("", tokenizer)[0], [""])

    def test_a_long_text_is_cut_into_parts_that_fit_and_keep_every_word(self):
        for text in [
            " ".join(f"line {i} of the long walk home under the old bridge" for i in range(400)),
            "\n".join(f"पंक्ति {i}: बारिश में पुराना पुल और घर का रास्ता" for i in range(300)),
            "".join("abcdefghij  ,.\nअआइकखग"[(i * 7919) % 20] for i in range(15000)),
        ]:
            parts, counts = split_parts(text, tokenizer)
            self.assertGreater(len(parts), 1)
            self.assertTrue(all(c <= PART_TOKENS for c in counts))
            self.assertEqual(sum(counts), count(text))
            # Each part, read again on its own, still fits the model with its start and end marks.
            self.assertTrue(all(count(p) <= FITS_TOKENS for p in parts))
            # Nothing is rewritten or lost: the parts are the text, give or take the spaces between them.
            self.assertEqual("".join(parts).split(), text.split())


class JoinVectors(unittest.TestCase):
    def test_longer_parts_weigh_more_and_the_result_has_length_one(self):
        joined = join_vectors([[1.0, 0.0], [0.0, 1.0]], [3, 1])
        self.assertAlmostEqual(float(np.linalg.norm(joined)), 1.0, places=6)
        self.assertGreater(joined[0], joined[1])


if __name__ == "__main__":
    unittest.main()
