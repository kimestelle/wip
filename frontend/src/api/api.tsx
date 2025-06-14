import axios from "axios";

const API_BASE = "https://sp25-internet-atlas.onrender.com";

export interface EmbedWebsiteResponse {
  status: string;
  job_id?: string;
  url: string;
}

export interface JobStatusResponse {
  status: string;
  url: string;
  description?: string;
  message?: string;
}

export interface SearchResult {
  id: string;
  score: number;
  rank: number;
  isValidDomain: boolean;
}

export interface SearchVectorsResponse {
  results: SearchResult[];
}

export interface CoordinateResult {
  id: string;
  scores: number[];
  rank: number;
  isValidDomain: boolean;
}

export interface CoordinateResponse {
  status: string;
  queries: string[];
  axis_count: number;
  results_count: number;
  results: CoordinateResult[];
}

export interface EdgeData {
  id: number;
  origin: string;
  target: string;
  num_users: number;
}

export interface EdgesResponse {
  results_count: number;
  results: EdgeData[];
}

export interface PrecomputedRankingResult {
  rank: number;
  id: string;
  score: number;
  isValidDomain: boolean;
}

export interface PrecomputedRankingResponse {
  status: string;
  query: string;
  results: PrecomputedRankingResult[];
}

// GET /get_node_statistics
export interface NodeStatisticsResponse {
  status: string;
  node: string;
  mode: 'origin' | 'target';
  visit_count: number;
  total_time_spent: number;
  avg_time_per_visit: number;
}

export async function getNodeStatistics(
  node: string,
  mode: 'origin' | 'target' = 'origin'
): Promise<NodeStatisticsResponse> {
  const params = new URLSearchParams();
  params.append("node", node);
  params.append("mode", mode);

  const response = await axios.get<NodeStatisticsResponse>(`${API_BASE}/get_node_statistics`, { params });
  return response.data;
}

export async function getPrecomputedRankings(axis1: string, axis2: string, axis3?: string): Promise<CoordinateResponse> {
  const response1 = await axios.get<PrecomputedRankingResponse>(`${API_BASE}/get_precomputed_rankings`, {
    params: { query: axis1 },
  });

  const response2 = await axios.get<PrecomputedRankingResponse>(`${API_BASE}/get_precomputed_rankings`, {
    params: { query: axis2 },
  });

  const responses = axis3 
    ? [
        response1.data,
        response2.data,
        (await axios.get<PrecomputedRankingResponse>(`${API_BASE}/get_precomputed_rankings`, {
          params: { query: axis3 },
        })).data
      ]
    : [response1.data, response2.data];

  const mergedResults: Record<string, { scores: number[], rank?: number, isValidDomain?: boolean }> = {};

  // Merge results
  for (let i = 0; i < responses.length; i++) {
    const data = responses[i];
    data.results.forEach(r => {
      if (!mergedResults[r.id]) {
        mergedResults[r.id] = { scores: [] };
      }
      mergedResults[r.id].scores[i] = r.score;
      
      // Save rank and isValidDomain if not already set
      if (r.rank !== undefined) {
        mergedResults[r.id].rank = r.rank;
      }
      if (typeof r.isValidDomain !== 'undefined') {
        mergedResults[r.id].isValidDomain = r.isValidDomain;
      }
    });
  }

  const finalResults = Object.entries(mergedResults).map(([id, { scores, rank, isValidDomain }]) => ({
    id,
    scores: scores.map(s => s ?? 0),
    rank: rank ?? 9999,  // if missing, use dummy rank
    isValidDomain: isValidDomain ?? true, // if missing, assume valid
  }));

  return {
    status: "success",
    queries: responses.map(r => r.query),
    axis_count: responses.length,
    results_count: finalResults.length,
    results: finalResults,
  };
}

// POST /embed-website
export async function embedWebsite(url: string): Promise<EmbedWebsiteResponse> {
  const formData = new URLSearchParams();
  formData.append("url", url);

  const response = await axios.post(`${API_BASE}/embed-website`, formData, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  return response.data;
}

// GET /job-status/{job_id}
export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  const response = await axios.get(`${API_BASE}/job-status/${jobId}`);
  return response.data;
}

// POST /search_vectors
export async function searchVectors(
  query: string,
  k_returns = 5
): Promise<SearchVectorsResponse> {
  const formData = new URLSearchParams();
  formData.append("query", query);
  formData.append("k_returns", k_returns.toString());

  const response = await axios.post(`${API_BASE}/search_vectors`, formData, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  return response.data;
}

// GET /get_coordinates
export async function getCoordinates(
  axis1: string,
  axis2: string,
  axis3?: string,
  k_returns = 500
): Promise<CoordinateResponse> {
  const params = new URLSearchParams();
  params.append("axis1", axis1);
  params.append("axis2", axis2);
  if (axis3) params.append("axis3", axis3);
  params.append("k_returns", k_returns.toString());

  const response = await axios.get(`${API_BASE}/get_coordinates`, {
    params,
  });

  return response.data;
}

// GET /get_edges with pagination
export async function getEdges(websites: string[], users: number[]): Promise<EdgesResponse> {
  const allResults: EdgeData[] = [];
  let page = 1;
  const pageSize = 1000; // Same as the backend default

  while (true) {
    const params = new URLSearchParams();
    websites.forEach(site => params.append("websites", site));
    users.forEach(user => params.append("users", user.toString()));
    params.append("page", page.toString());
    params.append("page_size", pageSize.toString());

    const response = await axios.get(`${API_BASE}/get_edges`, { params });
    const data: EdgesResponse = response.data;

    console.log(`Fetched page ${page}, results:`, data.results.length);

    if (!data.results.length) {
      // No more results, stop
      break;
    }

    allResults.push(...data.results);
    page += 1; // Go to next page
  }

  return {
    results_count: allResults.length,
    results: allResults,
  };
}


// GET /target_edge
export async function getTargetEdge(
  website1: string,
  website2: string,
  users: number[]
): Promise<EdgesResponse> {
  const params = new URLSearchParams();
  params.append("website1", website1);
  params.append("website2", website2);
  users.forEach(user => params.append("users", user.toString()));

  const response = await axios.get(`${API_BASE}/target_edge`, { params });
  return response.data;
}

// GET /user_edges
export async function getUserEdges(
  userId: number,
  websites: string[]
): Promise<EdgesResponse> {
  const allResults: EdgeData[] = [];
  let page = 1;
  const pageSize = 1000; // default page size

  while (true) {
    const params = new URLSearchParams();
    params.append("user_id", userId.toString());
    websites.forEach(site => params.append("websites", site));
    params.append("page", page.toString());
    params.append("page_size", pageSize.toString());

    const response = await axios.get(`${API_BASE}/user_edges`, { params });
    const data: EdgesResponse = response.data;

    console.log(`Fetched page ${page} for user ${userId}, results:`, data.results.length);

    if (!data.results.length) {
      break; // No more results
    }

    allResults.push(...data.results);
    page += 1;
  }

  return {
    results_count: allResults.length,
    results: allResults,
  };
}
