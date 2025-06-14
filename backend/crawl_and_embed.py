import asyncio
from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, BrowserConfig
from PIL import Image
import io



run_config = CrawlerRunConfig(
    word_count_threshold=10,        
    exclude_external_links=True,    
    remove_overlay_elements=True,   
    process_iframes=True,
    screenshot=True
) 

async def crawl_and_return(url: str, crawler):
    """
    Crawls a page and returns its content and a screenshot
    as a list of PIL images using crawl4ai.
    """
    # Initialize the AsyncWebCrawler
    
    try:
        # Crawl the URL
        await crawler.start()
        result = await crawler.arun(url, config=run_config)
        html_content = result.html
        screenshot = result.screenshot
        print(html_content)
        if not screenshot:
            print("[crawl error] screenshot could not be taken")
            return {
                "url": url,
                "text": "",
                "images": []
            }
        screenshot_bytes = io.BytesIO(screenshot)
        pil_image = Image.open(screenshot_bytes)
        return {
            "url": url,
            "text": html_content,
            "images": [pil_image]
        }
    except Exception as e:
        print(f"[crawl error] {url} | {e}")
        return {
            "url": url,
            "text": "",
            "images": []
        }
    finally:
        await crawler.close()
