import asyncio
import httpx

async def keep_alive():
    """Keep the server alive"""
    while True:
        try:
            async with httpx.AsyncClient() as client:
                await client.get("https://internet-atlas.onrender.com/", timeout = 10.0)
        except Exception as e:
            print(e)
        await asyncio.sleep(300)