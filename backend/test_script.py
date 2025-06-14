from text_processing import get_text_embeddings
from pinecone import Pinecone 
from dotenv import load_dotenv
import os

load_dotenv()

pc = Pinecone(api_key=os.getenv("PINECONE_KEY"))
index = pc.Index(host=os.getenv("PINECONE_INDEX_HOST"))

query = "warm design"

text_search_embedding = get_text_embeddings(query)
    
# Query Pinecone index for the k closest vectors
search_results = index.query(
    vector=text_search_embedding,
    top_k=500,
    include_values=False,  # Set to True if you want the actual vector values
    include_metadata=True  # Include metadata to get URLs and text snippets
)

# Format results for API response
formatted_results = []
for match in search_results.matches:
    formatted_results.append({"id": match.get("id", ""), "score": match.get("score", 0)})

print({
    "status": "success",
    "query": query,
    "results_count": len(formatted_results),
    "results": formatted_results
})