import React, { useState, useCallback, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import Circle from './Circle';
import Item from './Item';
import { Circle as CircleType, Item as ItemType } from '../types';

const ITEM_COLORS = ['green', 'blue', 'red', 'orange', 'purple', 'teal', 'pink'];
const BASE_CIRCLE_RADIUS = 20;
const CIRCLE_SPACING = 40; // Minimum distance between circles
const CENTER_PULL = 0.1; // Strength of center pull
const REPULSION = 0.002; // Strength of circle repulsion
const MAX_CENTER_DISTANCE = 100; // Maximum distance from group center
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;
const VIEWPORT_PADDING = 100; // Extra padding around viewport for smooth transitions

// Helper to check if two circles overlap
function circlesOverlap(c1: CircleType, c2: CircleType): boolean {
  const dx = c1.x - c2.x;
  const dy = c1.y - c2.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < (c1.r + c2.r - 50);
}

// Calculate circle radius based on number of items
function calculateCircleRadius(itemCount: number): number {
  return BASE_CIRCLE_RADIUS + (itemCount**1.1 * 30 + 30);
}

// Helper to create a group circle from two circles
function createGroupCircle(c1: CircleType, c2: CircleType): CircleType {
  const centerX = (c1.x + c2.x) / 2;
  const centerY = (c1.y + c2.y) / 2;
  const allItems = [...c1.items, ...c2.items];
  const radius = calculateCircleRadius(allItems.length);
  
  return {
    id: `group-${Date.now()}`,
    x: centerX,
    y: centerY,
    r: radius,
    items: allItems,
    isDragging: false,
    children: [c1.id, c2.id]
  };
}

// Helper to check if a circle is an outermost circle (not a child of any other circle)
function isOutermostCircle(circle: CircleType, circles: CircleType[]): boolean {
  return !circles.some(other => other.children?.includes(circle.id));
}

// Helper to find outermost overlapping circle
function findOutermostOverlappingCircle(circle: CircleType, circles: CircleType[]): CircleType | null {
  let outermost: CircleType | null = null;
  let maxRadius = -1;

  for (const other of circles) {
    if (other.id === circle.id) continue;
    // Skip if either circle is a parent/child of the other
    if (circle.children?.includes(other.id) || other.children?.includes(circle.id)) continue;
    // Skip if either circle is not outermost
    if (!isOutermostCircle(circle, circles) || !isOutermostCircle(other, circles)) continue;
    
    const dx = circle.x - other.x;
    const dy = circle.y - other.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < circle.r + other.r && dist > circle.r + other.r - 50 && other.r > maxRadius) {
      outermost = other;
      maxRadius = other.r;
    }
  }

  return outermost;
}

// Helper to get intersection path for two circles
function getCircleIntersectionPath(a: CircleType, b: CircleType) {
  // Use SVG arc math for intersection
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  if (d >= a.r + b.r || d <= Math.abs(a.r - b.r)) return '';
  
  // Law of cosines
  const angleA = Math.acos((a.r * a.r + d * d - b.r * b.r) / (2 * a.r * d));
  const angleB = Math.acos((b.r * b.r + d * d - a.r * a.r) / (2 * b.r * d));
  const theta = Math.atan2(b.y - a.y, b.x - a.x);
  
  // Points on circle A
  const a1 = {
    x: a.x + a.r * Math.cos(theta + angleA),
    y: a.y + a.r * Math.sin(theta + angleA)
  };
  const a2 = {
    x: a.x + a.r * Math.cos(theta - angleA),
    y: a.y + a.r * Math.sin(theta - angleA)
  };
  
  // Points on circle B
  const b1 = {
    x: b.x + b.r * Math.cos(theta + Math.PI - angleB),
    y: b.y + b.r * Math.sin(theta + Math.PI - angleB)
  };
  
  // SVG path for intersection - fixed arc directions
  return [
    `M ${a1.x} ${a1.y}`,
    `A ${a.r} ${a.r} 0 0 0 ${a2.x} ${a2.y}`,
    `A ${b.r} ${b.r} 0 0 0 ${b1.x} ${b1.y}`,
    `A ${a.r} ${a.r} 0 0 1 ${a1.x} ${a1.y}`
  ].join(' ');
}

// Helper to get intersection center for two circles
function getCircleIntersectionCenter(a: CircleType, b: CircleType) {
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  if (d >= a.r + b.r || d <= Math.abs(a.r - b.r)) return null;
  
  // Calculate intersection points
  const angleA = Math.acos((a.r * a.r + d * d - b.r * b.r) / (2 * a.r * d));
  const theta = Math.atan2(b.y - a.y, b.x - a.x);
  
  // Get intersection points
  const a1 = {
    x: a.x + a.r * Math.cos(theta + angleA),
    y: a.y + a.r * Math.sin(theta + angleA)
  };
  const a2 = {
    x: a.x + a.r * Math.cos(theta - angleA),
    y: a.y + a.r * Math.sin(theta - angleA)
  };
  
  // Calculate center of intersection
  return {
    x: (a1.x + a2.x) / 2,
    y: (a1.y + a2.y) / 2
  };
}

// Intersection highlight component
function CircleIntersectionHighlights({ circles }: { circles: CircleType[] }) {
  const highlights: JSX.Element[] = [];
  const processedPairs = new Set<string>();
  
  // Sort circles by radius (largest first)
  const sortedCircles = [...circles].sort((a, b) => b.r - a.r);
  
  for (const circle of sortedCircles) {
    // Only process outermost circles
    if (!isOutermostCircle(circle, circles)) continue;
    
    const outermost = findOutermostOverlappingCircle(circle, sortedCircles);
    if (outermost) {
      const pairKey = [circle.id, outermost.id].sort().join('-');
      if (!processedPairs.has(pairKey)) {
        processedPairs.add(pairKey);
        
        const path = getCircleIntersectionPath(circle, outermost);
        const center = getCircleIntersectionCenter(circle, outermost);
        
        if (path && center) {
          highlights.push(
            <g key={`intersection-${circle.id}-${outermost.id}`}>
              <path
                d={path}
                fill="orange"
                fillOpacity={0.3}
                stroke="orange"
                strokeDasharray="4 2"
              />
              <g
                transform={`translate(${center.x}, ${center.y})`}
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  console.log(`Intersection clicked between circles ${circle.id} and ${outermost.id}`);
                }}
              >
                <circle
                  r="12"
                  fill="white"
                  stroke="orange"
                  strokeWidth="2"
                />
                <text
                  x="0"
                  y="0"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="orange"
                  fontSize="16"
                  fontWeight="bold"
                >
                  +
                </text>
              </g>
            </g>
          );
        }
      }
    }
  }
  return <g>{highlights}</g>;
}

const VennDiagram: React.FC = () => {
  const [circles, setCircles] = useState<Record<string, CircleType>>({
    '1': {
      id: '1',
      x: 0,
      y: 0,
      r: calculateCircleRadius(1),
      items: ['1'],
      isDragging: false
    },
    '2': {
      id: '2',
      x: 200,
      y: 0,
      r: calculateCircleRadius(1),
      items: ['2'],
      isDragging: false
    }
  });

  const [items, setItems] = useState<Record<string, Omit<ItemType, 'x' | 'y'>>>(
    {
      '1': {
        id: '1',
        width: 20,
        height: 20,
        color: 'green',
        circles: ['1'],
        isDragging: false
      },
      '2': {
        id: '2',
        width: 20,
        height: 20,
        color: 'blue',
        circles: ['2'],
        isDragging: false
      }
    }
  );

  const [transform, setTransform] = useState({
    x: 0,  // center x
    y: 0,  // center y
    scale: 1  // zoom level
  });

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get viewport dimensions
  const getViewportDimensions = useCallback(() => {
    if (!containerRef.current) return { width: 0, height: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height
    };
  }, []);

  // Handle canvas dragging
  useEffect(() => {
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        svgRef.current?.style.setProperty('cursor', 'grabbing');
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      
      setTransform(prev => ({
        ...prev,
        x: prev.x + dx,
        y: prev.y + dy
      }));
      
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const handleMouseUp = () => {
      isDragging = false;
      svgRef.current?.style.setProperty('cursor', 'grab');
    };

    const svg = svgRef.current;
    if (svg) {
      svg.style.cursor = 'grab';
      svg.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        svg.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, []);

  // Handle zoom with mouse wheel/trackpad
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Calculate mouse position relative to center
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const mouseRelX = mouseX - centerX;
      const mouseRelY = mouseY - centerY;
      
      // Calculate zoom factor
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      const newScale = Math.min(Math.max(transform.scale + delta, MIN_ZOOM), MAX_ZOOM);
      const scaleFactor = newScale / transform.scale;
      
      // Update transform
      setTransform(prev => ({
        x: prev.x - (mouseRelX * (scaleFactor - 1)),
        y: prev.y - (mouseRelY * (scaleFactor - 1)),
        scale: newScale
      }));
    };

    const svg = svgRef.current;
    if (svg) {
      svg.addEventListener('wheel', handleWheel, { passive: false });
      return () => svg.removeEventListener('wheel', handleWheel);
    }
  }, [transform.scale]);

  // Handle zoom with pinch gesture
  useEffect(() => {
    let initialDistance = 0;
    let initialScale = 1;
    let initialTransform = { x: 0, y: 0, scale: 1 };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const svg = svgRef.current;
        if (!svg) return;
        
        initialDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialScale = transform.scale;
        initialTransform = { ...transform };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const svg = svgRef.current;
        if (!svg) return;
        
        const rect = svg.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        // Calculate current pinch center relative to center
        const currentPinchCenter = {
          x: ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left - centerX,
          y: ((e.touches[0].clientY + e.touches[1].clientY) / 2) - rect.top - centerY
        };
        
        // Calculate scale
        const currentDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const scale = currentDistance / initialDistance;
        const newScale = Math.min(Math.max(initialScale * scale, MIN_ZOOM), MAX_ZOOM);
        const scaleFactor = newScale / initialScale;
        
        // Update transform
        setTransform({
          x: initialTransform.x - (currentPinchCenter.x * (scaleFactor - 1)),
          y: initialTransform.y - (currentPinchCenter.y * (scaleFactor - 1)),
          scale: newScale
        });
      }
    };

    const svg = svgRef.current;
    if (svg) {
      svg.addEventListener('touchstart', handleTouchStart);
      svg.addEventListener('touchmove', handleTouchMove, { passive: false });
      return () => {
        svg.removeEventListener('touchstart', handleTouchStart);
        svg.removeEventListener('touchmove', handleTouchMove);
      };
    }
  }, [transform]);

  // Get visible circles
  const getVisibleCircles = useCallback(() => {
    const { width, height } = getViewportDimensions();
    const viewportBounds = {
      left: transform.x - (width / 2 / transform.scale) - VIEWPORT_PADDING,
      right: transform.x + (width / 2 / transform.scale) + VIEWPORT_PADDING,
      top: transform.y - (height / 2 / transform.scale) - VIEWPORT_PADDING,
      bottom: transform.y + (height / 2 / transform.scale) + VIEWPORT_PADDING
    };

    return Object.values(circles).filter(circle => {
      const screenPos = {
        x: circle.x - transform.x,
        y: circle.y - transform.y
      };
      return (
        screenPos.x + circle.r > viewportBounds.left &&
        screenPos.x - circle.r < viewportBounds.right &&
        screenPos.y + circle.r > viewportBounds.top &&
        screenPos.y - circle.r < viewportBounds.bottom
      );
    }).sort((a, b) => b.r - a.r);
  }, [transform, circles, getViewportDimensions]);

  // Add new item and circle
  const handleAddItem = useCallback(() => {
    const newId = (Object.keys(items).length + 1).toString();
    const color = ITEM_COLORS[Object.keys(items).length % ITEM_COLORS.length];
    
    // Add new circle at viewport center
    const { width, height } = getViewportDimensions();
    const center = { x: transform.x + width / 2, y: transform.y + height / 2 };

    setItems(prev => ({
      ...prev,
      [newId]: {
        id: newId,
        width: 20,
        height: 20,
        color,
        circles: [newId],
        isDragging: false
      }
    }));

    setCircles(prev => ({
      ...prev,
      [newId]: {
        id: newId,
        x: center.x,
        y: center.y,
        r: calculateCircleRadius(1),
        items: [newId],
        isDragging: false
      }
    }));
  }, [items, transform, getViewportDimensions]);

  // Update circle positions based on physics
  useEffect(() => {
    const updateCirclePositions = () => {
      setCircles(prev => {
        const newCircles = { ...prev };
        const currentCircles = Object.values(prev);
        
        // Each circle is its own physics container
        currentCircles.forEach((circle: CircleType) => {
          // Skip if no children or being dragged
          if (!circle.children || circle.isDragging) return;
          
          // Get direct children
          const childCircles = circle.children
            .map(id => newCircles[id])
            .filter(Boolean)
            .filter(child => !child.isDragging);
          
          if (childCircles.length === 0) return;
          
          // Update container position based on children
          const centerX = childCircles.reduce((sum, c) => sum + c.x, 0) / childCircles.length;
          const centerY = childCircles.reduce((sum, c) => sum + c.y, 0) / childCircles.length;
          newCircles[circle.id] = {
            ...circle,
            x: centerX,
            y: centerY
          };
          
          // Apply physics to direct children only
          childCircles.forEach(child => {
            let dx = 0;
            let dy = 0;
            
            // Pull toward container center
            const centerDx = circle.x - child.x;
            const centerDy = circle.y - child.y;
            const centerDist = Math.sqrt(centerDx * centerDx + centerDy * centerDy);
            
            if (centerDist > 0) {
              const pullStrength = Math.min(1, centerDist / MAX_CENTER_DISTANCE) * CENTER_PULL;
              dx += centerDx * pullStrength;
              dy += centerDy * pullStrength;
            }
            
            // Repel from other children in this container
            childCircles.forEach(otherChild => {
              if (otherChild.id === child.id) return;
              
              const childDx = child.x - otherChild.x;
              const childDy = child.y - otherChild.y;
              const childDist = Math.sqrt(childDx * childDx + childDy * childDy);
              const minDist = child.r + otherChild.r + CIRCLE_SPACING;
              
              if (childDist < minDist) {
                const repulsionStrength = (minDist - childDist) * REPULSION;
                dx += childDx * repulsionStrength;
                dy += childDy * repulsionStrength;
              }
            });
            
            // Update child position
            newCircles[child.id] = {
              ...child,
              x: child.x + dx,
              y: child.y + dy
            };
          });
        });
        
        return newCircles;
      });
    };

    const interval = setInterval(updateCirclePositions, 16);
    return () => clearInterval(interval);
  }, []);

  // Handle circle drag
  const handleCircleDrag = useCallback((event: d3.D3DragEvent<SVGElement, CircleType, CircleType>, circleId: string) => {
    setCircles(prev => {
      const circle = prev[circleId];
      if (!circle) return prev;

      const newX = circle.x + event.dx;
      const newY = circle.y + event.dy;

      // If this is a group, check if it should break from its parent first
      if (circle.children) {
        const parentGroup = Object.values(prev).find(c => c.children?.includes(circleId));
        if (parentGroup) {
          const dx = newX - parentGroup.x;
          const dy = newY - parentGroup.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // If too far from parent, break the group
          if (distance > parentGroup.r) {
            const newCircles = { ...prev };
            const remainingChildren = parentGroup.children?.filter(id => id !== circleId) || [];
            const remainingItems = parentGroup.items.filter(id => !circle.items.includes(id));
            
            newCircles[parentGroup.id] = {
              ...parentGroup,
              children: remainingChildren,
              items: remainingItems,
              r: calculateCircleRadius(remainingItems.length)
            };
            
            if (remainingChildren.length === 1) {
              delete newCircles[parentGroup.id];
            }
            
            // Now move the group and all its descendants
            const moveCircleAndDescendants = (circleId: string, dx: number, dy: number) => {
              const currentCircle = newCircles[circleId];
              if (!currentCircle) return;
              
              newCircles[circleId] = {
                ...currentCircle,
                x: currentCircle.x + dx,
                y: currentCircle.y + dy,
                isDragging: true
              };
              
              if (currentCircle.children) {
                currentCircle.children.forEach(childId => {
                  moveCircleAndDescendants(childId, dx, dy);
                });
              }
            };
            
            moveCircleAndDescendants(circleId, event.dx, event.dy);
            return newCircles;
          }
        }
        
        // If not breaking, move the group and all its descendants
        const newCircles = { ...prev };
        const moveCircleAndDescendants = (circleId: string, dx: number, dy: number) => {
          const currentCircle = newCircles[circleId];
          if (!currentCircle) return;
          
          newCircles[circleId] = {
            ...currentCircle,
            x: currentCircle.x + dx,
            y: currentCircle.y + dy,
            isDragging: true
          };
          
          if (currentCircle.children) {
            currentCircle.children.forEach(childId => {
              moveCircleAndDescendants(childId, dx, dy);
            });
          }
        };
        
        moveCircleAndDescendants(circleId, event.dx, event.dy);
        return newCircles;
      }

      // If this is a child circle, check if it should break from its group
      const parentGroup = Object.values(prev).find(c => c.children?.includes(circleId));
      if (parentGroup) {
        const dx = newX - parentGroup.x;
        const dy = newY - parentGroup.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // If too far from group center, break the group
        if (distance > parentGroup.r) {
          const newCircles = { ...prev };
          const remainingChildren = parentGroup.children?.filter(id => id !== circleId) || [];
          const remainingItems = parentGroup.items.filter(id => !circle.items.includes(id));
          
          newCircles[parentGroup.id] = {
            ...parentGroup,
            children: remainingChildren,
            items: remainingItems,
            r: calculateCircleRadius(remainingItems.length)
          };
          
          if (remainingChildren.length === 1) {
            delete newCircles[parentGroup.id];
          }
          newCircles[circleId] = { ...circle, x: newX, y: newY, isDragging: true };
          return newCircles;
        }
      }

      // Normal movement
      return {
        ...prev,
        [circleId]: { ...circle, x: newX, y: newY, isDragging: true }
      };
    });
  }, []);

  // Handle drag end and check for overlaps
  const handleDragEnd = useCallback(() => {
    setCircles(prev => {
      const newCircles = { ...prev };
      const circles = Object.values(prev);
      
      // Reset isDragging flag
      Object.keys(newCircles).forEach(id => {
        newCircles[id] = { ...newCircles[id], isDragging: false };
      });
      
      // Get outermost circles (individual circles or group circles that aren't children)
      const outermostCircles = circles.filter(circle => {
        // If it's a child of any other circle, it's not outermost
        return !circles.some(otherCircle => 
          otherCircle.children?.includes(circle.id)
        );
      });
      
      // Check each pair of outermost circles
      for (let i = 0; i < outermostCircles.length; i++) {
        for (let j = i + 1; j < outermostCircles.length; j++) {
          const c1 = outermostCircles[i];
          const c2 = outermostCircles[j];
          
          if (circlesOverlap(c1, c2)) {
            // If either circle is already a group, add the other to it
            if (c1.children) {
              // Add c2 to c1's group
              const allItems = [...c1.items, ...c2.items];
              newCircles[c1.id] = {
                ...c1,
                children: [...c1.children, c2.id],
                items: allItems,
                r: calculateCircleRadius(allItems.length)
              };
            } else if (c2.children) {
              // Add c1 to c2's group
              const allItems = [...c2.items, ...c1.items];
              newCircles[c2.id] = {
                ...c2,
                children: [...c2.children, c1.id],
                items: allItems,
                r: calculateCircleRadius(allItems.length)
              };
            } else {
              // Create a new group
              const groupCircle = createGroupCircle(c1, c2);
              newCircles[groupCircle.id] = groupCircle;
            }
          }
        }
      }
      
      return newCircles;
    });
  }, []);

  // Debug panel component
  const DebugPanel = () => {
    const renderCircleInfo = (circle: CircleType, depth: number = 0) => {
      const isGroup = circle.children && circle.children.length > 0;
      const parentGroup = Object.values(circles).find(c => c.children?.includes(circle.id));
      
      return (
        <div key={circle.id} style={{ marginLeft: `${depth * 20}px` }}>
          <div style={{ 
            padding: '4px', 
            margin: '2px 0',
            backgroundColor: isGroup ? '#e0e0e0' : '#f5f5f5',
            borderRadius: '4px'
          }}>
            <div>ID: {circle.id}</div>
            <div>Position: ({Math.round(circle.x)}, {Math.round(circle.y)})</div>
            <div>Radius: {Math.round(circle.r)}</div>
            <div>Items: {circle.items.join(', ')}</div>
            {parentGroup && <div>Parent: {parentGroup.id}</div>}
            {isGroup && <div>Children: {circle.children?.join(', ')}</div>}
          </div>
          {isGroup && circle.children?.map(childId => {
            const child = circles[childId];
            return child ? renderCircleInfo(child, depth + 1) : null;
          })}
        </div>
      );
    };

    return (
      <div style={{
        position: 'fixed',
        right: '20px',
        top: '20px',
        width: '300px',
        maxHeight: '80vh',
        overflowY: 'auto',
        backgroundColor: 'white',
        padding: '10px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        fontFamily: 'monospace',
        fontSize: '12px'
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Circle Hierarchy</h3>
        {Object.values(circles)
          .filter(circle => !Object.values(circles).some(c => c.children?.includes(circle.id)))
          .map(circle => renderCircleInfo(circle))}
      </div>
    );
  };

  return (
    <div 
      ref={containerRef}
      style={{ 
        width: '100vw', 
        height: '100vh', 
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <button 
        onClick={handleAddItem} 
        style={{ 
          position: 'fixed',
          left: '20px',
          top: '20px',
          padding: '8px 16px', 
          fontSize: '16px',
          zIndex: 1000
        }}
      >
        Add Item
      </button>

      <div style={{
        position: 'fixed',
        left: '20px',
        bottom: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        zIndex: 1000
      }}>
        <button
          onClick={() => setTransform(prev => ({
            ...prev,
            scale: Math.min(prev.scale + ZOOM_STEP, MAX_ZOOM)
          }))}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '20px',
            border: 'none',
            backgroundColor: 'white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            fontSize: '20px',
            cursor: 'pointer'
          }}
        >
          +
        </button>
        <button
          onClick={() => setTransform(prev => ({
            ...prev,
            scale: Math.max(prev.scale - ZOOM_STEP, MIN_ZOOM)
          }))}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '20px',
            border: 'none',
            backgroundColor: 'white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            fontSize: '20px',
            cursor: 'pointer'
          }}
        >
          -
        </button>
      </div>

      <svg 
        ref={svgRef}
        width="100%" 
        height="100%" 
        style={{ 
          background: '#f0f0f0',
          cursor: 'grab'
        }}
      >
        <g
          transform={`translate(${transform.x + window.innerWidth / 2}, ${transform.y + window.innerHeight / 2}) scale(${transform.scale})`}
        >
          {getVisibleCircles().map(circle => (
            <React.Fragment key={circle.id}>
              <Circle
                circle={circle}
                onDragStart={() => {}}
                onDrag={(event) => handleCircleDrag(event, circle.id)}
                onDragEnd={handleDragEnd}
              />
              {!circle.children && circle.items.map(itemId => {
                const item = items[itemId];
                if (!item) return null;
                return (
                  <Item
                    key={itemId}
                    item={{
                      ...item,
                      x: circle.x - item.width / 2,
                      y: circle.y - item.height / 2
                    }}
                  />
                );
              })}
            </React.Fragment>
          ))}
          <CircleIntersectionHighlights circles={getVisibleCircles()} />
        </g>
      </svg>
      <DebugPanel />
    </div>
  );
};

export default VennDiagram;