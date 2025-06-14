import { useEffect, useRef, useState, useMemo } from 'react';
import ForceGraph3D, { ForceGraph3DInstance } from '3d-force-graph';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

import { getPrecomputedRankings, getEdges, CoordinateResponse, getTargetEdge, getUserEdges, getNodeStatistics, NodeStatisticsResponse } from '../api/api';
import { NodeType, LinkType } from '../types';
import { configureScene, handleEdgeSelect } from './graphHelpers';
import PathOverlay from './PathOverlay';

interface GraphData {
  nodes: NodeType[];
  links: LinkType[];
}

interface Graph3DProps {
  descriptorX: string;
  descriptorY: string;
}

export default function Graph3D({ descriptorX, descriptorY }: Graph3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraph3DInstance | null>(null);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });

  const [pathNodes, setPathNodes] = useState<NodeType[]>([]);

  const [selectedNode, setSelectedNode] = useState<{ nodeId: string, stats: NodeStatisticsResponse } | null>(null);
  const [overlayPos, setOverlayPos] = useState({ x: 0, y: 0 });

  const [frozen, setFrozen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [edgeLoading, setEdgeLoading] = useState(false);
  const [userPathLoading, setUserPathLoading] = useState(false);
  const [nodeInfoLoading, setNodeInfoLoading] = useState(false);

  const [edgePopupData, setEdgePopupData] = useState<{
    users: number[];
    pos: { x: number; y: number };
    source: string;
    target: string;
  } | null>(null);

  const [currentUser, setCurrentUser] = useState<number>(0);

  const userIds = useMemo(() => [0, 1, 2, 3, 4, 5, 6, 7, 8], []);

  const iconTexture = useMemo(() => {
    const tex = new THREE.TextureLoader().load('/landmarkblue.svg');
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }, []);

  const iconMaterial = useMemo(() =>
    new THREE.SpriteMaterial({ map: iconTexture, transparent: true }),
    [iconTexture]
  );

  const auraGeometry = useMemo(() => new THREE.SphereGeometry(4), []);
  const auraMaterial = useMemo(() =>
    new THREE.MeshBasicMaterial({
      color: 0x06bca7,
      transparent: true,
      opacity: 0.15,
      depthWrite: false
    }),
    []);

  useEffect(() => {
    const graph = new ForceGraph3D(containerRef.current!) as ForceGraph3DInstance;
    fgRef.current = graph;

    configureScene(graph);

    const handleResize = () => {
      if (fgRef.current) {
        fgRef.current.width(window.innerWidth);
        fgRef.current.height(window.innerHeight);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  useEffect (() => {
    if (frozen) {
      fgRef.current?.d3VelocityDecay(1);
      fgRef.current?.d3AlphaMin(1);
    } else {
      fgRef.current?.d3VelocityDecay(0.7);
      fgRef.current?.d3AlphaMin(0.5);
    }}, [frozen]);

  useEffect(() => {
    if (!fgRef.current || !selectedNode) return;

    const graph = fgRef.current;
    const camera = graph.camera();

    let animationFrameId: number;

    const update = () => {
      const node = graph.graphData().nodes.find(n => n.id === selectedNode.nodeId);
      if (!node) {
        camera.lookAt(new THREE.Vector3(0, 0, 0));
        return
      };

      // Camera offset (distance behind the node)
      const offset = 30;
      const camPos = new THREE.Vector3(
        node.x! + offset,
        node.y! + offset,
        node.z! + offset
      );

      camera.position.copy(camPos);
      camera.lookAt(new THREE.Vector3(node.x!, node.y!, node.z!));
      camera.updateMatrixWorld();

      const controls = fgRef.current?.controls() as OrbitControls | undefined;

      if (controls) {
        controls.target.set(node.x!, node.y!, node.z!);
        controls.update();
      }

      // Update overlay position
      const projected = new THREE.Vector3(node.x!, node.y!, node.z!).project(camera);
      const width = window.innerWidth;
      const height = window.innerHeight;

      setOverlayPos({
        x: (projected.x * 0.5 + 0.55) * width,
        y: (-projected.y * 0.5 + 0.5) * height,
      });

      animationFrameId = requestAnimationFrame(update);
    };

    update();

    return () => cancelAnimationFrame(animationFrameId);
  }, [selectedNode]);

  useEffect(() => {
    const controls = fgRef.current?.controls() as OrbitControls | undefined;
    if (controls) {
      const shouldEnable = !frozen;
      controls.enableRotate = shouldEnable;
      controls.enableZoom = shouldEnable;
      controls.enablePan = shouldEnable;
    }
  }, [frozen]);  
  
  const normalizeDomain = (domain: string) => {
    return domain
      .toLowerCase();
  };
  
  
  useEffect(() => {
    console.log('Fetching new graph data for new descriptors...');
    
    if (!fgRef.current) return;
  
    const fetchGraphData = async () => {
      setLoading(true);
      try {
        console.log('Fetching graph data...');
        const res: CoordinateResponse = await getPrecomputedRankings(descriptorX, descriptorY);
        const scaleFactor = 600;
  
        const nodes: NodeType[] = res.results.map((result) => ({
          id: result.id,
          name: result.id,
          val: result.scores.reduce((a, b) => a + b, 0),
          x: result.scores[0] * scaleFactor,
          y: result.scores[1] * scaleFactor,
          z: (Math.random() - 0.5) * scaleFactor * 2,
          rank: result.rank,
          isValidDomain: result.isValidDomain
        }));
  
        const websiteIds = nodes.map((node) => node.id);

        console.log('Website IDs:', websiteIds);
        const edgeRes = await getEdges(websiteIds, userIds);
  
        const links: LinkType[] = edgeRes.results.map((entry) => {
          const sourceNode = nodes.find(node => node.id === normalizeDomain(entry.origin));
          const targetNode = nodes.find(node => node.id === normalizeDomain(entry.target));

          if (!sourceNode || !targetNode) {
            console.warn('Source or target node not found for link:', entry);
            return null;
          }

          return {
            source: sourceNode,
            target: targetNode,
            num_users: entry.num_users,
          };
        }).filter((link): link is LinkType => link !== null);
        
  
        console.log('Graph data:', { nodes, links });
        // When NEW graph data comes in, reset highlight
        setGraphData({ nodes, links });
        setSelectedNode(null);
        setPathNodes([]);
        setFrozen(false);
  
      } catch (error) {
        console.error('Error fetching graph data or edges:', error);
      } finally {
        setLoading(false);
      }
    };
  
    fetchGraphData();
  }, [descriptorX, descriptorY, userIds]);
  
  const defaultSphere = useMemo(() => new THREE.SphereGeometry(2), []);
  const defaultMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xffffff }), []);

  useEffect(() => {
    if (!fgRef.current || graphData.nodes.length === 0) return;
  
    const graph = fgRef.current;
    graph.graphData(graphData)
      .nodeAutoColorBy('id')
      .nodeLabel('name')
      .linkWidth(0.3)
      .backgroundColor('black')
      // .d3Force('charge', null)
      // .d3Force('center', null)
      // .d3VelocityDecay(0)
      .cameraPosition({ z: 500 });

      graph.d3Force('link')?.distance((link: LinkType) => {
        const srcNode = typeof link.source === 'object' ? link.source : graphData.nodes.find(n => n.id === link.source.id);
        const tgtNode = typeof link.target === 'object' ? link.target : graphData.nodes.find(n => n.id === link.target.id);

        if (srcNode && tgtNode) {
          const dx = srcNode.x! - tgtNode.x!;
          const dy = srcNode.y! - tgtNode.y!;
          const dz = srcNode.z! - tgtNode.z!;
          const baseDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);
          return baseDistance * 0.3;
        }
        return 100;  // fallback  
      });
      
  
  }, [graphData]);
  

  useEffect(() => {
    if (!containerRef.current || graphData.nodes.length === 0 || !fgRef.current) return;

    // [landmark] edge count
    const nodeOutgoingEdges = new Map<string, number>();
    graphData.links.forEach(link => {
      const src = typeof link.source === 'object' ? link.source.id : link.source;
      nodeOutgoingEdges.set(src, (nodeOutgoingEdges.get(src) || 0) + 1);
    });

    const graph = fgRef.current!;

    graph
    
      // .d3Force('charge', null)
      // .d3Force('center', null)
      // .d3VelocityDecay(0.2)
      .graphData(graphData)
      .nodeAutoColorBy('id')
      .nodeLabel('name')
      .nodeThreeObjectExtend(true)
      // .linkCurvature('curvature')
      // .linkCurveRotation('rotation')
      .linkColor('white')
      .linkWidth(0.3)
      .nodeThreeObjectExtend(false)
      .nodeThreeObject((node) => {
        const typedNode = node as NodeType;
        const outgoingEdgeCount = nodeOutgoingEdges.get(typedNode.id) || 0;
        const isLandmark = outgoingEdgeCount >= 25;
        const isBigLandmark = outgoingEdgeCount >= 40;


        if (isLandmark) {
          const group = new THREE.Group();

          const auraMesh = new THREE.Mesh(auraGeometry, auraMaterial);
          auraMesh.scale.set(4, 4, 4);
          //not clickable
          auraMesh.raycast = () => {};
          auraMesh.material.depthTest = false;
          auraMesh.material.depthWrite = false;
          auraMesh.renderOrder = 997;
          group.add(auraMesh);

          if (isBigLandmark) {
            const bigAuraMesh = new THREE.Mesh(auraGeometry, auraMaterial);
            bigAuraMesh.scale.set(8, 8, 8);
            bigAuraMesh.raycast = () => {};
            bigAuraMesh.material.depthTest = false;
            bigAuraMesh.material.depthWrite = false;
            bigAuraMesh.renderOrder = 998;
            group.add(bigAuraMesh);
          }

          const sprite = new THREE.Sprite(iconMaterial);
          sprite.scale.set(8, 8, 1);

          sprite.material.depthTest = false;
          sprite.renderOrder = 999;
          group.add(sprite);

          group.renderOrder = 997;

          return group;
        }

        return new THREE.Mesh(defaultSphere, defaultMaterial);
      })
      .linkThreeObject((linkObj) => {

        const source = typeof linkObj.source === 'object' ? linkObj.source as NodeType : null;
        const target = typeof linkObj.target === 'object' ? linkObj.target as NodeType : null;

        if (!source || !target) {
          const emptyObject = new THREE.Object3D();
          emptyObject.visible = false;
          return emptyObject;
        }

        const material = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: false,
          opacity: 1.0,
          blending: THREE.NoBlending,
          depthWrite: true,
        });

        const curve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(source.x!, source.y!, source.z!),
          new THREE.Vector3(
            (source.x! + target.x!) / 2,
            (source.y! + target.y!) / 2 + 10,
            (source.z! + target.z!) / 2
          ),
          new THREE.Vector3(target.x!, target.y!, target.z!)
        );

        const points = curve.getPoints(20);
        const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 64, 0.5, 8, false);

        return new THREE.Mesh(geometry, material);
      })

      .onLinkClick(async (linkObj) => {
        const sourceNode = typeof linkObj.source === 'object' ? linkObj.source as NodeType : undefined;
        const targetNode = typeof linkObj.target === 'object' ? linkObj.target as NodeType : undefined;
      
        if (!sourceNode || !targetNode) {
          console.warn('Link source/target is not an object:', linkObj);
          return;
        }
      
        try {
          setEdgeLoading(true);
          const res = await getTargetEdge(sourceNode.id, targetNode.id, userIds);
          const users = res.results.map((r: any) => r.user);
      
          if (users.length === 0) {
            alert('No users traveled along this path.');
            return;
          }
      
          // Get camera position to project to screen space
          const camera = fgRef.current?.camera();
          if (!camera) return;
      
          const midX = (sourceNode.x! + targetNode.x!) / 2;
          const midY = (sourceNode.y! + targetNode.y!) / 2;
          const midZ = (sourceNode.z! + targetNode.z!) / 2;
      
          const projected = new THREE.Vector3(midX, midY, midZ).project(camera);
          const width = window.innerWidth;
          const height = window.innerHeight;
      
          const screenPos = {
            x: (projected.x * 0.5 + 0.5) * width,
            y: (-projected.y * 0.5 + 0.5) * height,
          };
      
          setEdgePopupData({
            users,
            pos: screenPos,
            source: sourceNode.id,
            target: targetNode.id,
          });
      
        } catch (error) {
          console.error('Error fetching edge users:', error);
        } finally {
          setEdgeLoading(false);
        }
      })
      
      .onNodeClick(async (node) => {
        if (typeof node.id !== 'string') {
          console.warn('Invalid node id:', node);
          return;
        }  
      
        const distance = 40;
        const newPos = {
          x: node.x! + distance,
          y: node.y! + distance,
          z: node.z! + distance,
        };
      
        if (node.x !== undefined && node.y !== undefined && node.z !== undefined) {
          const lookAt = { x: node.x, y: node.y, z: node.z };
          fgRef.current?.cameraPosition(newPos, lookAt, 1000);
        } else {
          console.warn('Node coordinates are undefined:', node);
        }

        try {
          setNodeInfoLoading(true);
          const stats = await getNodeStatistics(node.id);
          console.log('Node statistics:', stats);
          setSelectedNode({ nodeId: node.id, stats });

        } catch (error) {
          console.error('Error fetching node statistics:', error);
        } finally {
          setNodeInfoLoading(false);
        }
      
      })
      
      .linkWidth(0.3)
      .backgroundColor('black')
      .cameraPosition({ z: 500 });
  
    return () => {
      if (fgRef.current) {
        fgRef.current.graphData({ nodes: [], links: [] });
      }
    };
    
    }, [auraGeometry, auraMaterial, defaultMaterial, defaultSphere, graphData, iconMaterial, userIds]);


  const outgoingEdgeCountForSelected = useMemo(() => {
    if (!selectedNode) return 0;
    return graphData.links.reduce((acc, l) => {
      const src = typeof l.source === 'object' ? l.source.id : l.source;
      return src === selectedNode.nodeId ? acc + 1 : acc;
    }, 0);
  }, [selectedNode, graphData.links]);
  
  // Your landmark rule (≥ 20 outgoing links)
  const isLandmark = outgoingEdgeCountForSelected >= 20;
  
  return (
  <div ref={containerRef} className="relative w-screen h-screen"
    onClick={() => {
      setSelectedNode(null);
      setFrozen(false);
    }}>
      {loading && (
        <div className="absolute inset-0 bg-[radial-gradient(circle,_black,_transparent)] opacity-70 flex items-center justify-center z-50">
          <div className='flex justify-center items-center animate-pulse w-50 aspect-[1/1] rounded-full border border-white'>
            <h1>Loading...</h1>
          </div>
        </div>
      )}
      {edgeLoading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <h1 className="text-white text-2xl animate-pulse">Loading edge users...</h1>
        </div>
      )}

      {userPathLoading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <h1 className="text-white text-2xl animate-pulse">Tracing user path...</h1>
        </div>
      )}

      {nodeInfoLoading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <h1 className="text-white text-2xl animate-pulse">Loading node information...</h1>
        </div>
      )}

      {selectedNode && (
        <div
  style={{
    position: 'absolute',
    top: overlayPos.y,
    left: overlayPos.x,
    transform: 'translate(-0%, -50%)',
    width: '50svh',
    height: '60svh',
    backgroundImage: "url('/overlayfan.svg')",
    backgroundSize: 'contain',
    backgroundRepeat: 'no-repeat',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '1.2svh 2svh',
    borderRadius: '1svh',
    pointerEvents: 'none',
    zIndex: 99999
  }}
>
  {/* Node ID Title */}
  <a href={"https://www." + selectedNode.nodeId} target="_blank" className='w-full h-full cursor-pointer'>
  <h2
    className="handjet text-[4svh] text-[#06BCA7] font-bold"
    style={{
      transform: 'rotate(-25deg)', 
      marginTop: '3.5svh',
      marginLeft: '3.5svh',
      fontSize: '4svh',
    }}
  >
    {selectedNode.nodeId}
  </h2>
  </a>

  {/* Node Stats */}
  <ul className="handjet text-[2.2svh] text-[#06BCA7]/50 space-y-[1.5svh] pb-[4svh] mb-[4svh] ml-[9svh] w-[30svh]">
    <li className="flex justify-between">
      <span>Visitors:</span>
      <span className="text-[#06BCA7] text-opacity-100 mr-[5svh]">
        {selectedNode.stats.visit_count}
      </span>
    </li>
    <li className="flex justify-between">
      <span>Total time:</span>
      <span className="text-[#06BCA7] text-opacity-100 mr-[5svh]">
        {selectedNode.stats.total_time_spent}
      </span>
    </li>
    <li className="flex justify-between">
      <span>Avg time:</span>
      <span className="text-[#06BCA7] text-opacity-100 mr-[5svh]">
        {selectedNode.stats.avg_time_per_visit}
      </span>
    </li>
  </ul>

  {/* Type Indicator */}
  <h2
    className="handjet text-[4svh] text-[#06BCA7] font-bold"
    style={{
      transform: 'rotate(25deg)',
      marginLeft: '3svh',
      marginBottom: '1svh',
      paddingBottom: '2svh',
      fontSize:"4svh"
    }}
  >
    <span>
      TYPE:&nbsp;{isLandmark ? 'Landmark' : 'Node'}
    </span>
    <img
      src="/lnmkicon.svg"
      alt=""
      className="inline-block align-text-bottom"
      style={{
        width: '5svh',
        height: '5svh',
        marginLeft: '3svh',
        marginRight: '1svh',
      }}
    />
  </h2>
</div>

      )}

      {edgePopupData && (
        <div
          className="absolute bg-black w-[30svh] text-white rounded = p-5 z-50"
          style={{
            top: "50svh",
            left: "50svw",
            transform: 'translate(-50%, -50%)',
          }}
        >
          <h2 className="font-bold mb-2">Select a user:</h2>
          <div className="flex flex-col gap-3 p-2">
            {edgePopupData.users.map((userId) => (
              <button
                key={userId}
                className="w-full bg-gray-200/50 hover:bg-gray-300 rounded px-3 py-1"
                onClick={async () => {
                  try {
                    setUserPathLoading(true); 
                    setFrozen(true);
                    const userEdgesRes = await getUserEdges(userId, graphData.nodes.map((node) => node.id));
                    const userPathNodes: NodeType[] = [];
                    
                    for (let i = 0; i < userEdgesRes.results.length - 1; i++) {
                      const edge = userEdgesRes.results[i];
                    
                      const originNode = graphData.nodes.find(node => node.id === edge.origin);
                      if (originNode) {
                        userPathNodes.push({
                          ...originNode,
                          id: `${originNode.id}-origin-${i}`, // make id unique
                        });
                      }
                    }

                    const targetNode = graphData.nodes.find(node => node.id === userEdgesRes.results[userEdgesRes.results_count - 1].target);
                    if (targetNode) {
                      userPathNodes.push({
                        ...targetNode,
                        id: `${targetNode.id}-origin-${userEdgesRes.results.length}`, // make id unique
                      });
                    } else {
                      console.warn('Target node not found:', userEdgesRes.results[userEdgesRes.results_count - 1].target);
                    }
                    setCurrentUser(userId);
                    handleEdgeSelect(userPathNodes, fgRef.current!, setFrozen, setPathNodes);
                    setEdgePopupData(null); // Close popup after selection

                  } catch (error) {
                    console.error('Error fetching user edges:', error);
                  } finally {
                    setUserPathLoading(false);
                  }
                }}
              >
                <h2>User {userId}</h2>
              </button>
            ))}
          </div>
          <button
            className="w-full bg-gray-200/50 hover:bg-gray-300 rounded px-3 py-1 text-gray-200"
            onClick={() => setEdgePopupData(null)}
          >
            <h2>Cancel</h2>
          </button>
        </div>
      )}

      {pathNodes.length > 0 && (
        <PathOverlay
          pathNodes={pathNodes}
          userId={currentUser}
          setFrozen={setFrozen}
          clearPathNodes={() => setPathNodes([])}
        />
      )}
    </div>
  )
};