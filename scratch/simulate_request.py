import asyncio
import uuid
import httpx
from datetime import datetime

async def main():
    async with httpx.AsyncClient() as client:
        # Create a mock user if necessary? Or we can just use the memory db.
        print("Done")

if __name__ == "__main__":
    asyncio.run(main())
