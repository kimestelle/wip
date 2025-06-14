# splits "browsing_processed.csv" in half

import csv

division = 20

with open('./backend/browsing_processed_2.csv', 'r') as file:
    reader = csv.reader(file)
    next(reader)  # Skip the header row
    rows = list(reader)
    half = len(rows) // division

    for i in range(division):
        if i == division - 1:
            # Last part gets the rest of the rows
            rows_to_write = rows[i * half:]
        else:
            rows_to_write = rows[i * half:(i + 1) * half]

        # Write the current part to a new CSV file
        with open(f'./backend/download/browsing_processed_{i + 1}.csv', 'w', newline='') as file:
            writer = csv.writer(file)
            writer.writerow(["id", "origin", "target", "user", "order", "origin_start", "time_active", "switch_time"])
            writer.writerows(rows_to_write)