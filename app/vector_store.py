import os
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime

from dotenv import load_dotenv
from loguru import logger
from qdrant_client import QdrantClient
from qdrant_client.http import models

load_dotenv()

QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
COLLECTION_NAME = "user_memories"

class VectorStore:
    def __init__(self):
        self.client = None
        self.enabled = False
        
        if QDRANT_URL and QDRANT_API_KEY:
            try:
                self.client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
                self.enabled = True
                logger.info("Connected to Qdrant Cloud")
                self._ensure_collection()
            except Exception as e:
                logger.error(f"Failed to connect to Qdrant: {e}")
                self.enabled = False
        else:
            logger.warning("QDRANT_URL or QDRANT_API_KEY not set. Memory features disabled.")

    def _ensure_collection(self):
        """Ensure the collection exists with correct config."""
        if not self.enabled or not self.client:
            return

        try:
            collections = self.client.get_collections()
            exists = any(c.name == COLLECTION_NAME for c in collections.collections)
            
            if not exists:
                logger.info(f"Creating Qdrant collection: {COLLECTION_NAME}")
                self.client.create_collection(
                    collection_name=COLLECTION_NAME,
                    vectors_config=models.VectorParams(size=1536, distance=models.Distance.COSINE),
                )
        except Exception as e:
            logger.error(f"Error checking/creating collection: {e}")

    def add_memory(self, user_id: str, text: str, embedding: List[float], metadata: Dict[str, Any]) -> bool:
        """Add a memory vector for a user."""
        if not self.enabled or not self.client:
            return False

        try:
            point_id = str(uuid.uuid4())
            payload = {
                "user_id": user_id,
                "text": text,
                "timestamp": datetime.now().isoformat(),
                **metadata
            }
            
            self.client.upsert(
                collection_name=COLLECTION_NAME,
                points=[
                    models.PointStruct(
                        id=point_id,
                        vector=embedding,
                        payload=payload
                    )
                ]
            )
            logger.info(f"Memory stored in Qdrant for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to add memory to Qdrant: {e}")
            return False

    def search_memories(self, user_id: str, embedding: List[float], limit: int = 5) -> List[Dict[str, Any]]:
        """Search for similar memories for a specific user."""
        if not self.enabled or not self.client:
            return []

        try:
            hits = self.client.search(
                collection_name=COLLECTION_NAME,
                query_vector=embedding,
                query_filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="user_id",
                            match=models.MatchValue(value=user_id)
                        )
                    ]
                ),
                limit=limit
            )
            
            results = []
            for hit in hits:
                results.append({
                    "text": hit.payload.get("text", ""),
                    "metadata": hit.payload,
                    "score": hit.score
                })
            return results
        except Exception as e:
            logger.error(f"Search failed in Qdrant: {e}")
            return []

# Singleton instance
vector_store = VectorStore()
