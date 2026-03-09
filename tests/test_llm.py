import os
import unittest
from unittest import mock


class TestLLMWrap(unittest.TestCase):
    @mock.patch("app.llm.load_dotenv")
    def test_missing_api_key_raises(self, mock_load_dotenv):
        from app import llm

        keys = ["OPENAI_API_KEY", "GROQ_API_KEY", "GEMINI_API_KEY"]
        old_keys = {}
        try:
            for k in keys:
                if k in os.environ:
                    old_keys[k] = os.environ[k]
                    del os.environ[k]
            llm._client = None  # force reinit
            with self.assertRaises(RuntimeError):
                llm.call_llm("hello", max_tokens=1)
        finally:
            for k, v in old_keys.items():
                os.environ[k] = v

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