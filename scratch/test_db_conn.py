import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def test_connection():
    print(f"Testing DATABASE_URL: {DATABASE_URL[:20]}...")
    
    # Handle multi-host
    dsn = DATABASE_URL
    if "@" in dsn and "," in dsn.split("@")[-1].split("/")[0]:
        prefix, remainder = dsn.split("@", 1)
        address_part, path_part = remainder.split("/", 1)
        primary_address = address_part.split(",")[0]
        dsn = f"{prefix}@{primary_address}/{path_part}"
        print(f"Normalized DSN for test: {dsn[:20]}...")

    if "sslmode=" not in dsn:
        dsn += "&sslmode=require" if "?" in dsn else "?sslmode=require"

    try:
        engine = create_engine(dsn)
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            print("Successfully connected to the database!")
            return True
    except Exception as e:
        print(f"Connection failed: {e}")
        return False

if __name__ == "__main__":
    test_connection()
