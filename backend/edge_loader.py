import csv, os
# from supabase import create_client, Client
# from dotenv import load_dotenv
# from tqdm import tqdm

# load_dotenv()

# url: str = os.environ.get("SUPABASE_URL")
# key: str = os.environ.get("SUPABASE_ADMIN_KEY")
# SUPABASE: Client = create_client(url, key)

# need domain, timestamp, panelist_id, timestamp, and active seconds (type 2 record)

# check if the table exists
# def check_table_exists(name: str, schema: dict):
#     try:
#         response = SUPABASE.table(name).select("*").limit(1).execute()
#         return True
#     except Exception as e:
#         return False

# BROWSING_SCHEMA = {
#     "origin": "TEXT",
#     "target": "TEXT",
#     "type": "INTEGER", # 0 if url, 1 if subdomain, 2 if domain
#     "user": "INTEGER",
#     "origin_start": "TIMESTAMP",
#     "time_active": "INTEGER",
#     "switch_time": "TIMESTAMP",
# }

if __name__ == "__main__":
    # if not check_table_exists("browsing", BROWSING_SCHEMA):
    #     print("Table doesn't exist")
    #     exit(1)

    # # clear table
    # SUPABASE.table("browsing").delete().eq("user", 1421).execute()

    domain_set = set()

    panelists: dict[str, list[tuple[str, str, int]]] = {}

    with open('./backend/browsing.csv', 'r') as file:
        reader = csv.reader(file)
        next(reader) # Skip the header row
        for i, row in enumerate(reader):

            if i % 100000 == 0:
                print(f"Processed {i} rows")

            # process row
            user = row[2]
            domain = row[-1] + row[-2]
            timestamp = row[-4]
            active_seconds = int(row[-3])

            # for our records
            domain_set.add(domain)

            if user not in panelists: # first time
                panelists[user] = [(domain, timestamp, active_seconds)]
                continue
            panelists[user].append((domain, timestamp, active_seconds))

    csv_rows = []

    for user in panelists.keys():
        panelists[user] = sorted(panelists[user], key=lambda x: x[-2])

        l_domain = panelists[user][0][0]
        l_timestamp = panelists[user][0][1]
        l_active_seconds = panelists[user][0][2]
        for i, (domain, timestamp, active_seconds) in enumerate(panelists[user][1:]):
            if l_domain == domain:
                continue

            csv_rows.append((l_domain, domain, user, i, l_timestamp, l_active_seconds, timestamp))

            l_domain = domain
            l_timestamp = timestamp
            l_active_seconds = active_seconds

    with open('./backend/browsing_processed_2.csv', 'w') as file:
        writer = csv.writer(file)
        writer.writerow(["id", "origin", "target", "user", "order", "origin_start", "time_active", "switch_time"])
        writer.writerows([(i, *row) for i, row in enumerate(csv_rows, start=1)])

    with open('./backend/domain_set.txt', 'w') as file:
        file.writelines([d + '\n' for d in domain_set])