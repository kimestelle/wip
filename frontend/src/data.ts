// data/graphData.ts
export const nodes = [
  { id: 'GOOGLE', name: 'Google', val: 10, x: 0, y: 0 },
  { id: 'YOUTUBE', name: 'YouTube', val: 12, x: 10, y: 0 },
  { id: 'FACEBOOK', name: 'Facebook', val: 8, x: -10, y: 10 },
  { id: 'INSTAGRAM', name: 'Instagram', val: 9, x: 0, y: 10 },
  { id: 'TWITTER', name: 'Twitter', val: 7, x: 10, y: 10 },
  { id: 'REDDIT', name: 'Reddit', val: 6, x: -10, y: -10 },
  { id: 'NETFLIX', name: 'Netflix', val: 15, x: 20, y: 0 },
  { id: 'DISNEY_PLUS', name: 'Disney+', val: 6, x: 20, y: 10 },
  { id: 'AMAZON', name: 'Amazon', val: 13, x: -20, y: -5 },
  { id: 'WIKIPEDIA', name: 'Wikipedia', val: 5, x: -5, y: -5 },
  { id: 'TIKTOK', name: 'TikTok', val: 11, x: -30, y: 0 },
  { id: 'LINKEDIN', name: 'LinkedIn', val: 4, x: -15, y: 5 }
];

export const edges = [
  { source: 'GOOGLE', target: 'YOUTUBE', user: 'userA', curvature: 0.2, rotation: 0 },
  { source: 'YOUTUBE', target: 'NETFLIX', user: 'userA', curvature: 0.2, rotation: 0 },
  { source: 'REDDIT', target: 'WIKIPEDIA', user: 'userB', curvature: 0.3, rotation: Math.PI / 4 },
  { source: 'WIKIPEDIA', target: 'YOUTUBE', user: 'userB', curvature: 0.2, rotation: Math.PI / 8 },
  { source: 'YOUTUBE', target: 'DISNEY_PLUS', user: 'userB', curvature: 0.3, rotation: -Math.PI / 4 },
  { source: 'FACEBOOK', target: 'INSTAGRAM', user: 'userC', curvature: 0.4, rotation: 0 },
  { source: 'INSTAGRAM', target: 'YOUTUBE', user: 'userC', curvature: 0.2, rotation: Math.PI / 6 },
  { source: 'YOUTUBE', target: 'NETFLIX', user: 'userC', curvature: 0.4, rotation: Math.PI / 3 },
  { source: 'AMAZON', target: 'REDDIT', user: 'userD', curvature: 0.2, rotation: -Math.PI / 4 },
  { source: 'REDDIT', target: 'TWITTER', user: 'userD', curvature: 0.3, rotation: -Math.PI / 6 },
  { source: 'TWITTER', target: 'NETFLIX', user: 'userD', curvature: 0.3, rotation: Math.PI / 8 },
  { source: 'LINKEDIN', target: 'WIKIPEDIA', user: 'userE', curvature: 0.4, rotation: Math.PI / 3 },
  { source: 'WIKIPEDIA', target: 'AMAZON', user: 'userE', curvature: 0.3, rotation: -Math.PI / 3 },
  { source: 'AMAZON', target: 'TIKTOK', user: 'userE', curvature: 0.2, rotation: 0 },
  { source: 'YOUTUBE', target: 'NETFLIX', user: 'userB', curvature: 0.4, rotation: Math.PI }
];
