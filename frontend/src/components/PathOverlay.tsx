'use client';

import { useEffect, useState } from 'react';
import { NodeType } from '../types';

interface PathOverlayProps {
  pathNodes: NodeType[];
  userId: number;
  setFrozen?: (val: boolean) => void;
  clearPathNodes?: () => void;
}

const userStats = [
  { websitesVisited: 4757, avgHours: 3.3},
  { websitesVisited: 2319, avgHours: 1.29},
  { websitesVisited: 4, avgHours: 0.02},
  { websitesVisited: 4757, avgHours: 3.3},
  { websitesVisited: 228, avgHours: 0.54},
  { websitesVisited: 132, avgHours: 0.44},
  { websitesVisited: 90, avgHours: 0.25},
  { websitesVisited: 1379, avgHours: 1.04},
  { websitesVisited: 244, avgHours: 1.02},
  { websitesVisited: 132, avgHours: 0.44},
]

export default function PathOverlay({ pathNodes, userId, setFrozen, clearPathNodes }: PathOverlayProps) {
  const [windowSize, setWindowSize] = useState<{ width: number; height: number } | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null); // ⭐ Track selected node

  const svgScaleFactor = pathNodes.length * 300;

  useEffect(() => {
    console.log(selectedNodeId);
    }, [selectedNodeId]);

  useEffect(() => {
    const updateSize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  if (pathNodes.length < 2 || !windowSize) return null;


  const scaledNodes = pathNodes.map(node => ({
    id: node.id,
    x: node.x * windowSize.height + windowSize.width / 2,
    y: node.y * windowSize.height / 2 + windowSize.height / 2,
    name: node.name,
    isValidDomain: node.isValidDomain,
  }));


  const pathData = scaledNodes.map((node, index) => {
    const prefix = index === 0 ? 'M' : 'L';
    return `${prefix} ${node.x} ${node.y}`;
  }).join(' ');


  return (
    <svg
      className="absolute inset-0 w-screen h-screen"
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      onClick={() => {
        console.log("Clicked outside nodes -> closing overlay.");
        setFrozen?.(false);
        clearPathNodes?.();
      }}
    >
      {/* translucent black background */}
      <rect x="0" y="0" width={windowSize.width} height={windowSize.height} 
      fill="black" opacity="0.75"
      pointerEvents="none" />

      {/* animated path */}
      <path
        d={pathData}
        fill="none"
        stroke="white"
        strokeOpacity={0.75}
        strokeWidth={2}
        strokeDasharray={`${svgScaleFactor} ${svgScaleFactor}`}
        strokeDashoffset={svgScaleFactor}
      >
        <animate
          attributeName="stroke-dashoffset"
          from={-svgScaleFactor}
          to="0"
          dur="8s"
          fill="freeze"
          begin="0s"
        />
      </path>

      {/* nodes */}
      {scaledNodes.map((node, index) => {
        const isStart = index === 0;
        const isEnd = index === scaledNodes.length - 1;

        if (isStart || isEnd) {
          return (
            <image
              key={node.id}
              href={isStart ? "/start-rect.svg" : "/end-rect.svg"}
              x={node.x - 20}
              y={node.y - 20}
              width="40"
              height="40"
            />
          );
        } else {
          return (
            <circle
              key={node.id}
              cx={node.x}
              cy={node.y}
              r={selectedNodeId === node.id ? 3 : 6}
              fill="white" // ⭐ Red if selected
              stroke={selectedNodeId === node.id ? "#FF6363" : "none"}
              strokeWidth={selectedNodeId === node.id ? 5 : 0}
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                console.log("Clicked node", node.id); // 🔥 Add this
                setSelectedNodeId(node.id);
              }}
            >
              <title>{index}</title>
            </circle>
          );
        }
      })}

      {/* text overlay when node selected */}
      {selectedNodeId && (() => {
        const node = scaledNodes.find(n => n.id === selectedNodeId);
        if (!node) return null;
        return (
          <foreignObject x={node.x + 15} y={node.y - 27} width="500" height="50">
            {node.isValidDomain ? (
            <a className="text-[#FF6363] flex  p-2 rounded bg-gradient-to-r from-black to-black/0 cursor-pointer"
            href={"https://www." + selectedNodeId} target="_blank">
              <h2>[ {selectedNodeId} &rarr; ]</h2>
            </a>
            ):(
            <a className="text-gray-200 flex  p-2 rounded bg-gradient-to-r from-black to-black/0">
              <h2>[ {selectedNodeId} &rarr; ]</h2>
            </a>
            )}
          </foreignObject>
        );
      })()}

      {/* info panel */}
      <foreignObject x="65%" y="60%" width="100%" height="100%" pointerEvents="none">
        <div className="absolute flex flex-col top-0 left-0 items-center">
          <div className="flex flex-row justify-between w-full">
            <div className="w-3 h-3 rounded-[2px] bg-white" />
            <div className="w-3 h-3 rounded-[2px] bg-white" />
          </div>

          <div className="mx-3 min-w-60 bg-[#0E0E0E]/75 px-4 py-2 mb-2">
            <h2>Following: User #{userId}'s Path</h2>
          </div>

          <div className="mx-3 flex flex-col min-w-60 bg-[#0E0E0E]/75 px-4 py-2 mb-2">
            <div className='w-full flex flex-row justify-between'>
              <h5 className='opacity-50'>Websites Visited</h5>
              <h5>{userStats[userId].websitesVisited}</h5>
            </div>
            <div className='w-full flex flex-row justify-between'>
              <h5 className='opacity-50'>Avg. Time/Day</h5>
              <h5>{userStats[userId].avgHours} hrs</h5>
            </div>
          </div>

          <div className="mx-3 flex flex-row justify-between min-w-60 bg-[#0E0E0E]/75 px-4 py-2">
            <h2>Type: Path</h2>
            <img src='/path-icon.svg' alt='path icon' className="w-8 h-8 ml-2" />
          </div>

          <div className="flex flex-row justify-between w-full">
            <div className="w-3 h-3 rounded-[2px] bg-white" />
            <div className="w-3 h-3 rounded-[2px] bg-white" />
          </div>
        </div>
      </foreignObject>
    </svg>
  );
}
