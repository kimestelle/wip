export interface NodeType {
    id: string;
    name?: string;
    val?: number;
    x: number;
    y: number;
    z: number;
    rank?: number;
    isValidDomain?: boolean;
    isLandmark?: boolean;
    visitCount?: number; 
  }
  //order,origin_start,time_active,switch_time
export interface LinkType {
    source: NodeType;
    target: NodeType;
    num_users: number;
    origin_start: string;
    time_active: number;
    switch_time: string;
    order: number;
  }