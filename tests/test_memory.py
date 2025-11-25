import os
import unittest


class TestMemory(unittest.TestCase):
    def test_compress_summary_stub(self):
        import app.memory as mem

        orig = mem.call_llm
        try:
            mem.call_llm = lambda prompt, **kwargs: "Short summary."  # stub
            out = mem.compress_summary("Long text")
            self.assertIsInstance(out, str)
            self.assertTrue(len(out) > 0)
        finally:
            mem.call_llm = orig

    def test_init_db(self):
        import app.memory as mem

        path = "test_memory.db"
        try:
            if os.path.exists(path):
                os.remove(path)
            mem.initialize_memory(path)
            self.assertTrue(os.path.exists(path))
        finally:
            if os.path.exists(path):
                os.remove(path)

    @unittest.skipUnless(__import__('importlib').util.find_spec('faiss') is not None, "faiss not installed")
    def test_add_and_search_with_faiss(self):
        import app.memory as mem
        from app import llm

        orig_embed = llm.create_embedding
        try:
            llm.create_embedding = lambda text: [0.1, 0.2, 0.3]
            path = "test_memory.db"
            if os.path.exists(path):
                os.remove(path)
            mem.initialize_memory(path)
            rid = mem.add_memory("u1", "hello", "hi", [0.1, 0.2, 0.3], db_path=path)
            self.assertGreater(rid, 0)
            res = mem.search_memory("u1", [0.1, 0.2, 0.3], db_path=path)
            self.assertTrue(len(res) >= 1)
        finally:
            llm.create_embedding = orig_embed


if __name__ == "__main__":
    unittest.main()