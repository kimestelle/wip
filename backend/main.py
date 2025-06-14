
# main.py with simplified background queue and rate limiting

from PIL import Image 
from fastapi import FastAPI, File, UploadFile, Form, Query
from fastapi.responses import JSONResponse
from crawl_and_embed import crawl_and_return 
from gemini_proc import img_and_txt_to_description, generate_embedding
from pinecone import Pinecone 
from dotenv import load_dotenv
import io
import os
import uuid
import numpy as np
import pandas as pd
import asyncio
import time
from datetime import datetime
import queue
import threading
from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, BrowserConfig
from typing import Optional, List
from collections import defaultdict
from supabase import create_client, Client
from text_processing import get_text_embeddings
import asyncio  # make sure imported
import csv
import random

from fastapi.middleware.cors import CORSMiddleware

# Load environment variables
load_dotenv()

# Initialize Supabase client
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_ADMIN_KEY")
SUPABASE: Client = create_client(url, key)

#Initialize FastAPI
app = FastAPI()

# Initialize Pinecone
pc = Pinecone(api_key=os.getenv("PINECONE_KEY"))
index = pc.Index(host=os.getenv("PINECONE_INDEX_HOST"))

# Create a job queue
job_queue = queue.Queue()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://sp25-internet-atlas-git-main-kimestelles-projects.vercel.app",
        "https://sp25-internet-atlas.vercel.app",
        "http://localhost:5173",
        "https://www.the-internet-atlas.com",  # <-- NO trailing slash, and has comma
        "https://the-internet-atlas.com",       # <-- correct
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Job status tracking
job_status = {}

browser_config = BrowserConfig(
    verbose=True
)

crawler = AsyncWebCrawler(config=browser_config)

# Rate limiting configuration
class RateLimiter:
    def __init__(self, calls_per_minute=30):
        self.calls_per_minute = calls_per_minute
        self.call_times = []
        self.lock = threading.Lock()
    
    async def wait_if_needed(self):
        """Wait if we're exceeding the rate limit"""
        with self.lock:
            now = time.time()
            # Remove timestamps older than 1 minute
            self.call_times = [t for t in self.call_times if t > now - 60]
            
            # If we've hit the limit, wait until we can make another call
            if len(self.call_times) >= self.calls_per_minute:
                wait_time = 60 - (now - self.call_times[0])
                if wait_time > 0:
                    self.lock.release()
                    await asyncio.sleep(wait_time + 0.1)
                    self.lock.acquire()
            
            # Record this call
            self.call_times.append(time.time())

# Initialize rate limiter
gemini_rate_limiter = RateLimiter(calls_per_minute=30)

# Worker function to process jobs in the background
def process_queue():
    while True:
        try:
            # Get a job from the queue
            job_id, url = job_queue.get(block=True)
            
            # Update status to processing
            job_status[job_id] = {
                "status": "processing",
                "url": url
            }
            
            # Process the job
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                result = loop.run_until_complete(process_website(url, job_id))
                job_status[job_id].update(result)
            except Exception as e:
                job_status[job_id].update({
                    "status": "error",
                    "message": f"Error: {str(e)}"
                })
            finally:
                loop.close()
                job_queue.task_done()
            
        except Exception as e:
            print(f"Worker error: {str(e)}")
            time.sleep(1)

# Start worker threads
NUM_WORKERS = 3
for _ in range(NUM_WORKERS):
    worker = threading.Thread(target=process_queue, daemon=True)
    worker.start()

async def process_website(url: str, job_id: str):
    """Process a website - crawl, generate description and store embedding"""
    try:

        # Crawl website
        print(f"[Process] Crawling {url}...")
        crawl_data = await crawl_and_return(url, crawler)
        print(f"[Process] Crawl success. Got text length={len(crawl_data['text'])}, images={len(crawl_data['images'])}")
        
        # Wait for rate limiter before making Gemini API call
        await gemini_rate_limiter.wait_if_needed()
        
        # Generate description and embedding
        # print(f"[Process] Generating description and embedding for {url}...")
        # description = await img_and_txt_to_description(crawl_data["text"], crawl_data["images"])
        
        # Check if embedding was generated successfully
        # if description["error"] is not None or description["embedding"] is None:
        #     print(f"[Process] Embedding generation failed: {description['error']}")
        #     return {
        #         "status": "error",
        #         "message": f"Failed to generate embedding: {description['error']}"
        #     }
        
        # Access the embedding
        # embedding_vector = description["embedding"]["embedding"]
        # print(f"[Process] Embedding vector length: {len(embedding_vector)}")
        
        # Check dimensions
        # vector_dim = len(embedding_vector)
        # if vector_dim != 3072:
        #     print(f"[Process] Dimension mismatch: {vector_dim}")
        #     return {
        #         "status": "error",
        #         "message": f"Vector dimension mismatch: {vector_dim} (needs to be 3072)"
        #     }
        
        # If dimensions match, proceed with upsert
        print(f"[Process] Upserting {url} into Pinecone...")
        # index.upsert(
        #     vectors=[{
        #         "id": url,
        #         "values": embedding_vector
        #     }],
        #     namespace=""
        # )
        print(f"[Process] Upsert complete for {url}.")
        
        return {
            "status": "completed",
            "description": None # description["text"]
        }
    except Exception as e:
        # If we get a rate limit error, requeue the job
        if "rate limit" in str(e).lower() or "quota" in str(e).lower():
            # Requeue the job
            job_queue.put((job_id, url))
            print(f"requeued {url}")
            return {
                "status": "requeued",
                "message": f"Hit rate limit, job requeued"
            }
        print(f"Error: {str(e)}")
        return {
            "status": "error",
            "message": f"Error: {str(e)}"
        }

@app.get("/")
async def root():
    return {"message": "Hello World"}


DEPLOY_TIME = datetime.now().isoformat() + "Z"

@app.get("/buildinfo")
async def build_info():
    return {
        "deployedAt": DEPLOY_TIME
    }

#for debugging
def diagnose_missing_fetches(url: str, fetch_response):
    """Prints a diagnosis if a fetch returns no vectors."""
    print(f"[Diagnose] URL: {url}")
    if not fetch_response.vectors:
        print(f"[Diagnose] No vectors found for {url}")
        if fetch_response.namespace != "":
            print(f"[Diagnose] Warning: fetch returned non-empty namespace: {fetch_response.namespace}")
        print(f"[Diagnose] Usage stats: {fetch_response.usage}")
    else:
        print(f"[Diagnose] Successfully fetched vector for {url}")


@app.post("/embed-website")
async def embed_website_api(url: str = Form(...)):
    print("=" * 80)
    fetch_response = index.fetch(ids=[url])

    diagnose_missing_fetches(url, fetch_response)
        
    if fetch_response.vectors:
        return {
        "status": "website exists",
        "url": url
    } 
        
    # Generate a job ID
    job_id = str(uuid.uuid4())
    
    # Add job to status tracker
    job_status[job_id] = {
        "status": "queued",
        "url": url
    }
    
    # Add job to processing queue
    job_queue.put((job_id, url))
    
    return {
        "status": "queued",
        "job_id": job_id,
        "url": url
    }


@app.get("/job-status/{job_id}")
async def get_job_status(job_id: str):
    if job_id in job_status:
        return job_status[job_id]
    else:
        return JSONResponse(
            status_code=404,
            content={"status": "error", "message": "Job not found"}
        )

# @app.post("/search_vectors")
# async def search_web_embeddings(query: str = Form(...), k_returns: int = Form(5)):
#     # Wait for rate limiter before making Gemini API call for embedding
#     await gemini_rate_limiter.wait_if_needed()

#     query_vector_response = await generate_embedding(query)
#     query_vector = query_vector_response["embedding"] if isinstance(query_vector_response, dict) else query_vector_response

#     search_results = index.query(
#         vector=query_vector,
#         top_k=k_returns,
#         include_values=False,
#         include_metadata=True
#     )   
    
#     # Format results
#     formatted_results = []
#     for match in search_results.matches:
#         formatted_results.append({"id": match.get("id", ""), "score": match.get("score", 0)})
    
#     return {
#         "results": formatted_results
#     }

import csv  # ← Add this at the top of your file

@app.post("/search_vectors")
async def search_web_embeddings(query: str = Form(...), k_returns: int = Form(5)):
    query_vector_response = await generate_embedding(query)
    query_vector = query_vector_response["embedding"] if isinstance(query_vector_response, dict) else query_vector_response

    search_results = index.query(
        vector=query_vector,
        top_k=k_returns,
        include_values=False,
        include_metadata=True
    )

    formatted_results = [{"id": match.get("id", ""), "score": match.get("score", 0)} for match in search_results.matches]

    # 🔥 Write results to a CSV file
    csv_filename = f"rankings_{query.replace(' ', '_')}.csv"
    with open(csv_filename, "w", newline="") as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(["Rank", "Website", "Score"])  # header row
        for rank, result in enumerate(formatted_results, start=1):
            writer.writerow([rank, result['id'], f"{result['score']:.4f}"])

    return {"results": formatted_results}


@app.get("/get_coordinates")
async def get_coordinates(
    axis1: str = Query(...),
    axis2: str = Query(...),
    axis3: Optional[str] = Query(None),
    k_returns: int = Query(500)
):
    queries = [axis1, axis2] if axis3 is None else [axis1, axis2, axis3]

    embeddings = []
    for query in queries:
        await gemini_rate_limiter.wait_if_needed()
        embedding_result = await generate_embedding(query)
        embedding = embedding_result["embedding"] if isinstance(embedding_result, dict) else embedding_result
        embeddings.append(embedding)

    search_results = []
    for embedding in embeddings:
        search_response = index.query(
            vector=embedding,
            top_k=k_returns,
            include_values=False,
            include_metadata=True
        )
        search_results.append(search_response)

    # Format each result like search_vectors does
    formatted_results = []
    for search_response in search_results:
        matches = [{"id": match.get("id", ""), "score": match.get("score", 0)} for match in search_response.matches]
        formatted_results.append(matches)

    return {
        "status": "success",
        "queries": queries,
        "results_count": sum(len(r) for r in formatted_results),
        "results": formatted_results
    }

@app.get("/get_edges")
async def get_edges(
    websites: List[str] = Query(...),
    users: List[int] = Query(...),
    page: int = Query(1),  # Add page number
    page_size: int = Query(1000)  # Add page size
):
    # Calculate how much to skip
    offset = (page - 1) * page_size

    # Run RPC with limit + range
    query = SUPABASE.rpc("count_users_by_site_pair", {
        "user_ids": users,
        "websites": websites
    }).range(offset, offset + page_size - 1)  # Pagination here

    result = query.execute()

    return JSONResponse(
        content={
            "status": "success",
            "current_page": page,
            "page_size": page_size,
            "results_count": len(result.data),
            "results": result.data
        }
    )


@app.get("/target_edge")
async def get_target_edge(website1: str = Query(...), website2: str = Query(...), users: List[int] = Query(...)):
    result = SUPABASE.rpc("count_user_records_between_sites", {
        "user_ids": users, 
        "origin_site": website1,
        "target_site": website2
    }).execute()
    return JSONResponse(
        content={
            "results_count": len(result.data),
            "results": result.data
        }
    )

@app.get("/user_edges")
async def get_user_edges(
    user_id: int = Query(...),
    page: int = Query(1),
    page_size: int = Query(1000)
):
    offset = (page - 1) * page_size
    result = SUPABASE.table("browsing_complete")\
        .select("*")\
        .eq("user", user_id)\
        .range(offset, offset + page_size - 1)\
        .execute()

    return JSONResponse(
        content={
            "results_count": len(result.data),
            "results": result.data
        }
    )

# gets all of the edges of a particular user

from fastapi import Query
from typing import Optional

@app.get("/get_node_statistics")
async def get_node_statistics(
    node: str = Query(...),
    mode: str = Query('origin')  # 'origin' or 'target'
):
    """
    Fetch edges where the node matches (origin or target),
    for users 0–8, and compute:
    - visit_count
    - total_time_spent (seconds)
    - avg_time_per_visit
    """

    if mode not in ['origin', 'target']:
        return {"status": "error", "message": "Mode must be 'origin' or 'target'"}

    try:
        # Users to consider
        users = list(range(9))

        # Query edges dynamically
        query = SUPABASE.table("browsing_complete")\
            .select("*")\
            .in_("user", users)\
            .eq(mode, node)\
            .execute()

        if not query.data:
            return {"status": "error", "message": f"No edges found for node '{node}' in mode '{mode}'."}

        edges = query.data

        # Now process the edges
        visit_count = len(edges)
        total_time_spent = 0

        for edge in edges:
            time_spent = edge.get('time_active')
            if isinstance(time_spent, (int, float)):
                total_time_spent += time_spent
            # else skip (missing or malformed)

        avg_time_per_visit = total_time_spent / visit_count if visit_count > 0 else 0

        return {
            "status": "success",
            "node": node,
            "mode": mode,
            "visit_count": visit_count,
            "total_time_spent": round(total_time_spent, 2),  # seconds
            "avg_time_per_visit": round(avg_time_per_visit, 2)  # seconds
        }

    except Exception as e:
        return {"status": "error", "message": str(e)}


# CSV_FILE = "rankings_all.csv"

# @app.post("/precompute_rankings")
# async def precompute_rankings(batch_size: int = 3, k_returns: int = 500):
#     try:
#         from pinecone import Pinecone  # make sure imported correctly at top

#         pc = Pinecone(api_key=os.getenv("PINECONE_KEY"))
#         index = pc.Index(host=os.getenv("PINECONE_INDEX_HOST"))

#         queries = [
#             "piece", "heavy", "organic", "ash", "light", 
#             "soft", "silk", "smooth", "sharp", "fuzzy"
#         ]

#         filename = "precomputed_rankings.csv"

#         # Open CSV once and write header
#         with open(filename, mode="w", newline='') as csvfile:
#             writer = csv.writer(csvfile)
#             writer.writerow(["query", "rank", "website_id", "score"])

#         async def embed_and_search(query: str):
#             try:
#                 print(f"🔵 Processing query: {query}")
#                 await gemini_rate_limiter.wait_if_needed()
#                 embedding_result = await generate_embedding(query)
#                 embedding = embedding_result["embedding"] if isinstance(embedding_result, dict) else embedding_result

#                 search_results = index.query(
#                     vector=embedding,
#                     top_k=k_returns,
#                     include_values=False,
#                     include_metadata=True
#                 )

#                 with open(filename, mode="a", newline='') as csvfile:
#                     writer = csv.writer(csvfile)
#                     for rank, match in enumerate(search_results.matches):
#                         writer.writerow([
#                             query,
#                             rank + 1,
#                             match.get("id", ""),
#                             match.get("score", 0)
#                         ])
#                 print(f"✅ Finished query: {query}")

#             except Exception as e:
#                 print(f"❌ Error with query '{query}': {e}")
#                 if "exhausted" in str(e).lower() or "quota" in str(e).lower():
#                     print(f"⏳ Waiting 65s due to quota limit...")
#                     await asyncio.sleep(65)
#                     await embed_and_search(query)  # Retry automatically after waiting
#                 else:
#                     raise

#         # Run queries in batches
#         for i in range(0, len(queries), batch_size):
#             batch = queries[i:i+batch_size]
#             print(f"🚀 Starting batch: {batch}")
#             await asyncio.gather(*(embed_and_search(q) for q in batch))
#             print(f"✅ Batch complete.\n")

#         return {"status": "done", "output_file": filename}

#     except Exception as e:
#         return JSONResponse(content={"status": "error", "message": str(e)})


@app.get("/get_precomputed_rankings")
async def get_precomputed_rankings(query: str = Query(...)):
    filename = "precomputed_rankings.csv"
    
    try:
        df = pd.read_csv(filename)
        query_df = df[df['query'] == query].copy()
        
        if query_df.empty:
            return {"status": "error", "message": f"No rankings found for query '{query}'."}
        
        query_df.sort_values("rank", inplace=True)
        
        results = [
            {
                "rank": int(row["rank"]),
                "id": row["website_id"],
                "isValidDomain": row["isValidDomain"],
                "score": float(row["score"])
            }
            for _, row in query_df.iterrows()
        ]
        
        return {
            "status": "success",
            "query": query,
            "results": results
        }
        
    except Exception as e:
        return {"status": "error", "message": str(e)}


# def fetch_all_edges():
#     users = [0, 1, 2, 3, 4, 5, 6, 7, 8]
#     page_size = 1000
#     all_results = []
#     page = 0

#     while True:
#         start = page * page_size
#         end = start + page_size - 1

#         try:
#             result = SUPABASE.table("browsing_complete")\
#                 .select("*")\
#                 .in_("user", users)\
#                 .range(start, end)\
#                 .execute()
#         except Exception as e:
#             print(f"[ERROR] Fetching page {page}: {e}")
#             break

#         if not result.data:
#             break

#         all_results.extend(result.data)

#         if len(result.data) < page_size:
#             break
#         page += 1

#     return all_results

# @app.get("/get_all_edges")
# async def get_all_edges():
#     results = fetch_all_edges()
#     return JSONResponse(
#         content={
#             "results_count": len(results),
#             "results": results
#         }
#     )


# def normalize_domain(domain: str) -> str:
#     domain = domain.lower().strip()
#     domain = domain.replace("https://", "").replace("http://", "")
#     # if domain.startswith("www."):
#     #     domain = domain[4:]
#     # domain = domain.rstrip("/")
#     return domain

# import random
# import pandas as pd
# from fastapi.responses import JSONResponse


# @app.post("/fill_missing_sites")
# async def fill_missing_sites():
#     try:
#         # Paths
#         rankings_path = "./precomputed_rankings.csv"
#         relevant_sites_path = "./relevant_sites_smaller.csv"

#         # Load data
#         rankings_df = pd.read_csv(rankings_path)
#         relevant_sites_df = pd.read_csv(relevant_sites_path)

#         # Normalize columns
#         rankings_df["website_id"] = rankings_df["website_id"].apply(normalize_domain)
#         relevant_sites_df["origin"] = relevant_sites_df["origin"].apply(normalize_domain)

#         # Build sets
#         existing_sites = set(rankings_df["website_id"])
#         relevant_sites = set(relevant_sites_df["origin"])

#         # (1) Delete any site not in relevant_sites
#         before_count = len(rankings_df)
#         rankings_df = rankings_df[rankings_df["website_id"].isin(relevant_sites)]
#         after_count = len(rankings_df)
#         deleted_sites_count = before_count - after_count

#         # (2) Find missing sites to add
#         missing_sites = relevant_sites - set(rankings_df["website_id"])

#         print(f"Deleted {deleted_sites_count} invalid sites.")
#         print(f"Missing sites to add: {len(missing_sites)}")

#         queries = rankings_df["query"].unique()
#         new_rows = []

#         for query in queries:
#             query_df = rankings_df[rankings_df["query"] == query]

#             if query_df.empty:
#                 continue

#             min_score = query_df["score"].min()
#             max_score = query_df["score"].max()

#             for site in missing_sites:
#                 fake_score = round(random.uniform(min_score, max_score), 6)
#                 new_rows.append({
#                     "query": query,
#                     "website_id": site,
#                     "score": fake_score,
#                     "isValidDomain": False  # Mark new fake rows as invalid
#                 })

#         # Add isValidDomain to original valid rows
#         rankings_df["isValidDomain"] = True

#         # Combine
#         if new_rows:
#             new_df = pd.DataFrame(new_rows)
#             combined_df = pd.concat([rankings_df, new_df], ignore_index=True)
#         else:
#             combined_df = rankings_df

#         # Sort and re-rank
#         combined_df.sort_values(["query", "score"], ascending=[True, False], inplace=True)
#         combined_df["rank"] = combined_df.groupby("query").cumcount() + 1

#         # Reorder columns
#         combined_df = combined_df[["query", "rank", "website_id", "score", "isValidDomain"]]

#         # Save
#         combined_df.to_csv(rankings_path, index=False)

#         return JSONResponse(content={
#             "status": "success",
#             "deleted_invalid_sites": deleted_sites_count,
#             "missing_sites_added": len(missing_sites),
#             "final_total_rows": len(combined_df)
#         })

#     except Exception as e:
#         return JSONResponse(content={"status": "error", "message": str(e)})


# @app.get("/find_invalid_sites")
# async def find_invalid_sites():
#     try:
#         rankings_path = "./precomputed_rankings.csv"
#         relevant_sites_path = "./relevant_sites_smaller.csv"

#         # Load CSVs
#         rankings_df = pd.read_csv(rankings_path)
#         relevant_sites_df = pd.read_csv(relevant_sites_path)

#         # Normalize
#         rankings_sites = set(w for w in rankings_df["website_id"])
#         relevant_sites = set(w for w in relevant_sites_df["origin"])

#         # Find invalid ones
#         invalid_sites = rankings_sites - relevant_sites

#         return JSONResponse(content={
#             "status": "success",
#             "invalid_sites_count": len(invalid_sites),
#             "invalid_sites": list(sorted(invalid_sites))
#         })

#     except Exception as e:
#         return JSONResponse(content={"status": "error", "message": str(e)})


# @app.post("/normalize_rankings")
# async def normalize_rankings():
#     try:
#         rankings_path = "./precomputed_rankings.csv"

#         # Load rankings
#         rankings_df = pd.read_csv(rankings_path)

#         if "score" not in rankings_df.columns:
#             return JSONResponse(content={"status": "error", "message": "Missing 'score' column in rankings."})

#         # Find current min and max
#         current_min = rankings_df["score"].min()
#         current_max = rankings_df["score"].max()

#         if current_min == current_max:
#             return JSONResponse(content={"status": "error", "message": "All scores are identical, cannot normalize."})

#         # Apply normalization: from current [min, max] -> to [-1, 1]
#         def normalize(value):
#             return 2 * (value - current_min) / (current_max - current_min) - 1

#         rankings_df["score"] = rankings_df["score"].apply(normalize)

#         # Save back
#         rankings_df.to_csv(rankings_path, index=False)

#         return JSONResponse(content={
#             "status": "success",
#             "new_min": rankings_df["score"].min(),
#             "new_max": rankings_df["score"].max(),
#             "total_entries": len(rankings_df)
#         })

#     except Exception as e:
#         return JSONResponse(content={"status": "error", "message": str(e)})


# from collections import defaultdict
# from datetime import datetime
# import pandas as pd

# @app.post("/precompute_user_stats")
# async def precompute_user_stats():
#     try:
#         browsing_data = []
#         page = 0
#         page_size = 1000

#         # Paginate
#         while True:
#             result = SUPABASE.table("browsing_complete")\
#                 .select("*")\
#                 .range(page * page_size, (page + 1) * page_size - 1)\
#                 .execute()

#             if not result.data:
#                 break

#             browsing_data.extend(result.data)
#             if len(result.data) < page_size:
#                 break
#             page += 1

#         print(f"Fetched {len(browsing_data)} browsing records.")

#         if not browsing_data:
#             return JSONResponse(content={"status": "error", "message": "No browsing data found."})

#         user_visits = defaultdict(list)
#         user_time_active = defaultdict(int)  # store total active time per user

#         for record in browsing_data:
#             user = record.get("user")
#             timestamp_str = record.get("origin_start")
#             time_active = record.get("time_active", 0)  # fallback if missing

#             if user is None or not timestamp_str:
#                 continue

#             try:
#                 timestamp = datetime.fromisoformat(timestamp_str)
#             except Exception as e:
#                 print(f"Bad timestamp: {timestamp_str} ({e})")
#                 continue

#             user_visits[user].append(timestamp)
#             user_time_active[user] += int(time_active)

#         rows = []
#         for user_id in range(0, 4):  # Only users 0-8
#             timestamps = user_visits.get(user_id, [])
#             total_seconds = user_time_active.get(user_id, 0)

#             if not timestamps:
#                 avg_hours_per_day = 0
#             else:
#                 dates = [ts.date() for ts in timestamps]
#                 unique_days = len(set(dates))
#                 if unique_days == 0:
#                     avg_hours_per_day = 0
#                 else:
#                     avg_hours_per_day = (total_seconds / 3600) / unique_days  # seconds to hours

#             rows.append({
#                 "user_id": user_id,
#                 "total_websites_visited": len(timestamps),
#                 "total_seconds_spent": total_seconds,
#                 "average_hours_spent_per_day": round(avg_hours_per_day, 2),
#             })

#         if not rows:
#             return JSONResponse(content={"status": "error", "message": "No valid rows found."})

#         output_filename = "./user_stats.csv"
#         pd.DataFrame(rows).to_csv(output_filename, index=False)

#         return JSONResponse(content={
#             "status": "success",
#             "user_count": len(rows),
#             "output_file": output_filename
#         })

#     except Exception as e:
#         return JSONResponse(content={"status": "error", "message": str(e)})
