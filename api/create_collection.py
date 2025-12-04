import os
from qdrant_client import QdrantClient
from qdrant_client.http import models

def create_collection():
    host = os.environ.get("QDRANT_HOST", "mem0_store")
    port = int(os.environ.get("QDRANT_PORT", 6333))
    
    print(f"Connecting to Qdrant at {host}:{port}...")
    client = QdrantClient(host=host, port=port)
    
    # Collection name used by mem0
    col_name = "openmemory"
    
    try:
        if client.collection_exists(col_name):
            print(f"Collection '{col_name}' already exists. Deleting it to recreate with correct dimensions (1024)...")
            client.delete_collection(col_name)
            print(f"Collection '{col_name}' deleted.")
        
        print(f"Creating collection '{col_name}' with dimension 1024...")
        client.create_collection(
            collection_name=col_name,
            vectors_config=models.VectorParams(
                size=1024,  # 1024 for Pro/BAAI/bge-m3
                distance=models.Distance.COSINE
            )
        )
        print(f"Collection '{col_name}' created successfully.")
    except Exception as e:
        print(f"Error handling collection '{col_name}': {e}")

if __name__ == "__main__":
    create_collection()
