
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def migrate():
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        print("Adding columns to users table...")
        try:
            # PostgreSQL syntax for adding multiple columns if they don't exist is tricky,
            # so we'll do them one by one with a check or use a slightly more verbose way.
            # Using basic ALTER TABLE since IF NOT EXISTS might not be supported in all PG versions
            # but usually is in modern Supabase.
            
            queries = [
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR UNIQUE;",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR;",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR;"
            ]
            
            for q in queries:
                conn.execute(text(q))
            
            conn.commit()
            print("Migration successful.")
        except Exception as e:
            print(f"Migration failed: {e}")

if __name__ == "__main__":
    migrate()
