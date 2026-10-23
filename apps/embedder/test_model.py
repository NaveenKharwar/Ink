"""Checks the embedder with the real model through its own HTTP route: python -m unittest test_model
Loads BGE-M3 at the pinned revision (about 2 GB on first run)."""
import json
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

import numpy as np

import server


class Embedder(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()

    def post(self, body, headers=None):
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        request = urllib.request.Request(self.base + "/embed", data=data, headers={"Content-Type": "application/json", **(headers or {})})
        try:
            with urllib.request.urlopen(request) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as err:
            return err.code, json.load(err)

    def embed(self, texts):
        status, body = self.post({"texts": texts})
        self.assertEqual(status, 200)
        return np.asarray(body["vectors"])

    def test_health_names_the_model(self):
        with urllib.request.urlopen(self.base + "/health") as response:
            self.assertEqual(json.load(response), {"ok": True, "model": "BAAI/bge-m3"})

    def test_one_normalised_vector_of_1024_per_text_in_order(self):
        texts = ["The kettle sang while the rain kept on.", "चाय की खुशबू और बारिश की आवाज़", "a"]
        vectors = self.embed(texts)
        self.assertEqual(vectors.shape, (3, 1024))
        np.testing.assert_allclose(np.linalg.norm(vectors, axis=1), 1, atol=1e-5)
        np.testing.assert_allclose(self.embed([texts[1]])[0], vectors[1], atol=1e-5)

    def test_the_same_text_gives_the_same_vector(self):
        text = "Morning light on the river and the boats waiting."
        np.testing.assert_allclose(self.embed([text])[0], self.embed([text])[0], atol=1e-6)

    def test_close_meanings_are_closer_than_far_ones(self):
        rain, storm, taxes = self.embed(["Rain fell all night on the tin roof.", "A storm poured water over the house until dawn.", "Fill in the tax form before the end of the year."])
        self.assertGreater(float(rain @ storm), float(rain @ taxes) + 0.1)

    def test_bad_requests_are_refused(self):
        for body in [{"texts": []}, {"texts": "one"}, {"texts": [1]}, {"words": ["a"]}, {"texts": ["a"] * 33}, b"not json"]:
            status, answer = self.post(body)
            self.assertEqual(status, 400, body)
            self.assertIn("error", answer)

    def test_a_wrong_secret_is_refused_when_one_is_set(self):
        saved = server.SECRET
        server.SECRET = "a-secret-of-sixteen-plus"
        try:
            self.assertEqual(self.post({"texts": ["a"]})[0], 401)
            self.assertEqual(self.post({"texts": ["a"]}, {"X-Embedder-Secret": "wrong"})[0], 401)
            self.assertEqual(self.post({"texts": ["a"]}, {"X-Embedder-Secret": "a-secret-of-sixteen-plus"})[0], 200)
        finally:
            server.SECRET = saved


if __name__ == "__main__":
    unittest.main()
