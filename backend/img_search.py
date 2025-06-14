import pinecone
import numpy as np



def compute_sites_with_distances(keyword1: str, keyword2: str, amt: float, index):
    
    search_results_1 = index.query(
        vector=None, # todo this keyword 1
        top_k=amt // 2,  
        include_values=True,
        include_metadata=True
    )

    search_results_2 = index.query(
        vector=None, # todo this keyword 2
        top_k=amt // 2,  
        include_values=True,
        include_metadata=True
    )
    return "todo"



