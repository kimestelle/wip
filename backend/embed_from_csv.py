import pandas as pd
import requests
import time


df = pd.read_csv("relevant_sites_smaller.csv")

base_url = "http://127.0.0.1:8000/embed-website"


for url in df["origin"]:
    try:
        if pd.isna(url) or not isinstance(url, str):
            continue
        

        if not url.startswith("http"):
            url = "https://" + url
        
        print(f"Processing: {url}")
        
        response = requests.post(base_url, data={"url": url})
        
        print(f"Response: {response.status_code} - {response.json()}")
        
        time.sleep(0.5)

    except Exception as e:
        print(f"Error processing {url}: {str(e)}")
