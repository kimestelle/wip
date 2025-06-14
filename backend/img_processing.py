from transformers import BlipProcessor, BlipForConditionalGeneration, CLIPProcessor, CLIPModel 
import torch
from fastapi import FastAPI, File, UploadFile, Form
from PIL import Image, UnidentifiedImageError
import io
import numpy as np
import httpx
import aiohttp

# Load the BLIP model and processor
blip_processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-large")  
blip_model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-large").to("cuda" if torch.cuda.is_available() else "cpu")

# Load the CLIP model and processor
clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to("cuda" if torch.cuda.is_available() else "cpu")


async def get_image_embeddings(files: list[UploadFile] = File(...)):
    all_combined_embeddings = []
    
    # Process each uploaded image
    for file in files:
        print("proc file")
        # Read the image data from the uploaded file
        img_data = await file.read()
        img = Image.open(io.BytesIO(img_data))

        # Generate the description based on the uploaded image
        description = generate_description(img)
        
        # Get individual image and text embeddings
        image_embeddings, text_embeddings = make_clip_embedding(img, description=description)

        # Combine the image and text embeddings (e.g., by averaging or concatenating)
        # Option 1: Average the image and text embeddings
        combined_embedding = np.mean([image_embeddings, text_embeddings], axis=0)

        # Append the combined embedding to the list
        all_combined_embeddings.append(combined_embedding)
    
    # Aggregate all combined embeddings (mean across all images)
    combined_final_embedding = np.mean(all_combined_embeddings, axis=0).tolist()

    # Return the final aggregated vector that captures the "mood/vibe"
    
    return combined_final_embedding

async def get_image_embeddings_for_urls(urls: list[str]):
    all_combined_embeddings = []
    
    # Process each uploaded image

    async with aiohttp.ClientSession() as session:

        for url in urls:
            try:
                response = await session.get(url)

                if response.status != 200:
                    print(f"Failed to fetch {url}: status {response.status}")
                    continue

                content_type = response.headers.get('Content-Type', '')
                if 'svg' in content_type or url.endswith('.svg'):
                    print(f"Skipping SVG image: {url}")
                    continue

                img_data = await response.read()

                try:
                    img = Image.open(io.BytesIO(img_data)).convert("RGB")
                except UnidentifiedImageError:
                    print(f"Cannot identify image file: {url}")
                    continue

                # Generate the description based on the uploaded image
                description = generate_description(img)
                
                # Get individual image and text embeddings
                image_embeddings, text_embeddings = make_clip_embedding(img, description=description)

                # Combine the image and text embeddings (e.g., by averaging or concatenating)
                # Option 1: Average the image and text embeddings
                combined_embedding = np.mean([image_embeddings, text_embeddings], axis=0)

                # Append the combined embedding to the list
                all_combined_embeddings.append(combined_embedding)
            
            except Exception as e:
                print(f"Error processing image {url}: {e}")
                continue

    if not all_combined_embeddings:
        return None
    
    # Aggregate all combined embeddings (mean across all images)
    combined_final_embedding = np.mean(all_combined_embeddings, axis=0).tolist()

    # Return the final aggregated vector that captures the "mood/vibe"
    
    return combined_final_embedding

def generate_description(img: Image.Image):
    # Try different prompts to get more detailed descriptions
    prompts = [
    "a website with an atmosphere that feels",
    "a webpage design creating a mood of",
    "a site with a visual ambiance conveying",
    "a digital interface evoking emotions of",
    "a web design with color tones suggesting",
    "a website experience that makes visitors feel",
    "a web interface with visual elements creating a sense of",
    "a website aesthetic that establishes a mood of"
]
    
    descriptions = []
    for prompt in prompts[:1]:
        inputs = blip_processor(img, text=prompt, return_tensors="pt").to("cuda" if torch.cuda.is_available() else "cpu")
        output = blip_model.generate(**inputs, min_length=30, max_length=70, num_beams=1, temperature=0.8, do_sample=True)
        description = blip_processor.decode(output[0], skip_special_tokens=True)
        descriptions.append(description)
    
    # default for now change when we can analyze prompts better
    return descriptions[0]

def make_clip_embedding(img: Image.Image, description: str):
    # Preprocess the image and text for the CLIP model
    inputs = clip_processor(text=[description], images=img, return_tensors="pt", padding=True)

    with torch.no_grad():
        # Extract image embeddings
        image_embeddings = clip_model.get_image_features(pixel_values=inputs["pixel_values"])
        
        # Extract text embeddings
        text_embeddings = clip_model.get_text_features(input_ids=inputs["input_ids"], attention_mask=inputs["attention_mask"])

    # Convert embeddings to NumPy arrays
    image_embeddings = image_embeddings.cpu().detach().numpy().flatten().tolist()
    text_embeddings = text_embeddings.cpu().detach().numpy().flatten().tolist()

    # Optionally, print the embeddings
    
    # Return the embeddings as NumPy arrays
    return image_embeddings, text_embeddings

# For site content
def clip_text_embedding(text: str):
    # Tokenize the text for CLIP
    inputs = clip_processor(text=[text], return_tensors="pt", padding=True).to(clip_model.device)

    with torch.no_grad():
        # Extract the embedding
        text_features = clip_model.get_text_features(
            input_ids=inputs["input_ids"],
            attention_mask=inputs["attention_mask"]
        )

    return text_features[0].cpu().numpy().flatten().tolist()

