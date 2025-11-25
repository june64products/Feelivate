import os
import unittest


class TestLLMWrap(unittest.TestCase):
    def test_missing_api_key_raises(self):
        from app import llm

        old = os.environ.get("OPENAI_API_KEY")
        try:
            if "OPENAI_API_KEY" in os.environ:
                del os.environ["OPENAI_API_KEY"]
            llm._client = None  # force reinit
            with self.assertRaises(RuntimeError):
                llm.call_llm("hello", max_tokens=1)
        finally:
            if old is not None:
                os.environ["OPENAI_API_KEY"] = old

    @unittest.skip("Integration placeholder: requires OPENAI_API_KEY")
    def test_call_llm_integration(self):
        from app.llm import call_llm

        out = call_llm("Say 'ok'", max_tokens=5)
        self.assertIsInstance(out, str)
        self.assertTrue(len(out) > 0)

    @unittest.skip("Integration placeholder: requires OPENAI_API_KEY")
    def test_create_embedding_integration(self):
        from app.llm import create_embedding

        vec = create_embedding("test")
        self.assertIsInstance(vec, list)
        self.assertGreater(len(vec), 0)


if __name__ == "__main__":
    unittest.main()