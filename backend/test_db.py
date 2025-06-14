from dotenv import load_dotenv
from supabase import create_client, Client
import os

load_dotenv()

# Initialize Supabase client
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_ADMIN_KEY")
SUPABASE: Client = create_client(url, key)

result = SUPABASE.table("browsing_counts").select("*").limit(10).order('visit_count', desc=True).execute()
print(result.data)

result = SUPABASE.table("browsing_complete").select("*").limit(10).execute()
print(result.data)