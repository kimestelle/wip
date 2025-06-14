import asyncio
from crawl4ai import AsyncWebCrawler
from img_processing import get_image_embeddings_for_urls
from text_processing import get_text_embeddings
import numpy as np
from pinecone import Pinecone
import os
from dotenv import load_dotenv

load_dotenv()

pc = Pinecone(api_key=os.getenv("PINECONE_KEY"))
index = pc.Index(host=os.getenv("PINECONE_INDEX_HOST"))

async def main():

    # website_url = 'https://crawl4ai.com'

    website_url_csv = './backend/domain_set.txt'

    with open(website_url_csv, 'r') as file:
        website_urls = file.readlines()

    for website_url in website_urls:
        website_url = website_url.strip()  # Remove any extra whitespace

        # Create an instance of AsyncWebCrawler
        async with AsyncWebCrawler() as crawler:
            # Run the crawler on a URL
            result = await crawler.arun(url=website_url)

        # Print the extracted content
        text = result.html

        # print(result.html)

        image_urls = [i['src'] for i in result.media['images']]

        print(image_urls)

        img_embed = await get_image_embeddings_for_urls(image_urls)
        text_embed = get_text_embeddings(text)

        if img_embed:
            final_embedding = np.mean([img_embed, text_embed], axis=0)  # Average the embeddings
        else:
            final_embedding = text_embed
        
        index.upsert(
            vectors=[{
                "id": website_url,
                "values": list(final_embedding),
            }],
            namespace=""
        )

# Run the async main function
asyncio.run(main())
