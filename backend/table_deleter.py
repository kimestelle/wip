from supabase import create_client, Client
import os
from dotenv import load_dotenv
from time import sleep
load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_ADMIN_KEY")
SUPABASE: Client = create_client(url, key)

# get all users

"""
DANGER: This operation will permanently delete user data from the database. Proceed with caution!
"""
# while True:
#     response = SUPABASE.table("browsing").select("user").limit(1000).execute()
#     users = set(s["user"] for s in SUPABASE.table("browsing").select("user").execute().data)
#     response = SUPABASE.table("browsing").delete().in_("user", users).execute()
#     if not response.data:
#         break
#     sleep(3)