from typing import List, Dict
from fastapi import UploadFile
import google.generativeai as genai
from google.generativeai.types import ContentType
from PIL.Image import Image
import base64
import os
from dotenv import load_dotenv

load_dotenv()


genai.configure(api_key=os.getenv("GEMINI_KEY"))
model_flash = genai.GenerativeModel('gemini-2.0-flash')

async def generate_embedding(text : str):
        return genai.embed_content(
            model="gemini-embedding-exp-03-07",
            content=text,
            task_type="retrieval_document"
        )


async def img_and_txt_to_description(web_text: str, images: List[Image] ) -> str:
    """
    Analyzes a list of image byte dictionaries and website text using Gemini Pro 1.5.
    Each image part must contain 'data' (bytes) and 'mime_type' (e.g., 'image/png').
    """
    prompt = '''Analyze the website data provided by this text and images. 
    Describe the overall vibe and ambiance it conveys using descriptive words related to mood and feeling (e.g., calm, energetic, sophisticated, playful, serious, etc.). 
    Then, analyze the key design elements contributing to this vibe, such as color palette, typography, imagery, use of white space, layout, and any interactive elements. 
    Explain how these design choices reinforce the overall mood you identified. 
    Please provide your analysis in no more than 2048 tokens.'''

    contents = [web_text, *images, prompt]
    try:
        response = model_flash.generate_content(contents=contents, stream=False)
        embedding = await generate_embedding(response.text)
        return {"error": None, "embedding": embedding, "text": response.text}
    except Exception as e:
        return {"error": e, "embedding": None, "text": None}