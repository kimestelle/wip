"use client"

import { useEffect, useRef, useMemo } from 'react'
import * as d3 from 'd3'

interface Node extends d3.SimulationNodeDatum {
  id: string
  name: string
  x: number
  y: number
  isEnter?: boolean
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string | Node
  target: string | Node
  isDashed: boolean
}

interface ForceGraphProps {
  nodes: Node[]
  links: Link[]
  width?: number
  height?: number
  onNodeClick?: (nodeId: string) => void
  selectedNode?: string | null
}

export default function ForceGraph({
  nodes,
  links,
  width = window.innerWidth / 2,
  height = window.innerHeight,
  onNodeClick,
  selectedNode
}: ForceGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  // Track if we've already shifted
  const hasShiftedRef = useRef<boolean>(false)
  
  // Determine if we should shift the graph
  const shouldShift = useMemo(() => {
    // Don't shift if no selection or no SVG
    if (!selectedNode || !svgRef.current) {
      hasShiftedRef.current = false // Reset when no selection
      return false
    }
    
    // Prevent multiple shifts
    if (hasShiftedRef.current) {
      return true // Keep shifted if already shifted
    }
    
    const found = nodes.find(n => n.id === selectedNode)
    if (!found || found.x == null) return false
    
    // Special handling for the middle node (purpose)
    if (found.id === "purpose") {
      console.log('Handling purpose node - always shift')
      hasShiftedRef.current = true
      return true
    }
    
    // Get center of screen
    const screenCenter = window.innerWidth / 2
    
    // Approximate node position on screen
    const svg = svgRef.current
    const svgRect = svg.getBoundingClientRect()
    const svgCenterX = svgRect.left + svgRect.width / 2
    
    // Adjust node position to screen coordinate
    const nodeScreenX = svgCenterX + found.x
    
    // Check if node is in left half of screen
    console.log('Node position:', nodeScreenX, 'Screen center:', screenCenter)
    const needsShift = nodeScreenX > screenCenter
    
    // Remember that we've shifted
    if (needsShift) {
      hasShiftedRef.current = true
    }
    
    return needsShift
  }, [selectedNode, nodes])
  
  // Reset the shifted state when selection changes
  useEffect(() => {
    if (!selectedNode) {
      hasShiftedRef.current = false
    }
  }, [selectedNode])

  useEffect(() => {
    if (!svgRef.current) return

    function calculateIntersection(x1: number, y1: number, x2: number, y2: number, boxSize: number) {
      const dx = x2 - x1
      const dy = y2 - y1
      const length = Math.sqrt(dx * dx + dy * dy)
      const normalizedDx = dx / length
      const normalizedDy = dy / length
      return {
        x: x2 - normalizedDx * boxSize,
        y: y2 - normalizedDy * boxSize
      }
    }

    // Clear out any existing SVG
    d3.select(svgRef.current).selectAll("*").remove()

    const svg = d3.select(svgRef.current)
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", [-width / 2, -height / 2, width, height])

    // -- GRID BACKGROUND: define pattern, radial gradient, and mask --
    const defs = svg.append("defs")

    // 1) A repeating grid pattern
    const gridSize = 30
    defs.append("pattern")
      .attr("id", "grid-pattern")
      .attr("width", gridSize)
      .attr("height", gridSize)
      .attr("patternUnits", "userSpaceOnUse")
      .append("path")
      .attr("d", `M ${gridSize} 0 L 0 0 0 ${gridSize}`)
      .attr("fill", "none")
      .attr("stroke", "#666")       // Subtle grid color
      .attr("stroke-width", 0.4)    // Reduced stroke width for finer lines

    // 2) A radial gradient that goes from opaque in center to transparent at edges
    const radialGradient = defs.append("radialGradient")
      .attr("id", "grid-fade")
      .attr("cx", "50%")
      .attr("cy", "50%")
      .attr("r", "50%")

    radialGradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "white")
      .attr("stop-opacity", 1)

    radialGradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "white")
      .attr("stop-opacity", 0)

    // 3) A mask that uses this gradient
    defs.append("mask")
      .attr("id", "grid-mask")
      .append("rect")
      .attr("x", -width / 2)
      .attr("y", -height / 2)
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "url(#grid-fade)")

    // 4) Add a big rectangle behind everything to show the grid, masked by the radial gradient
    svg.append("rect")
      .attr("x", -width / 2)
      .attr("y", -height / 2)
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "url(#grid-pattern)")
      .attr("mask", "url(#grid-mask)")
      .lower()
    // -- END GRID BACKGROUND --

    // Build simulation
    const simulation = d3.forceSimulation<Node>(nodes)
      .force("link", d3.forceLink<Node, Link>(links).id(d => d.id).distance(150))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("collision", d3.forceCollide().radius(30))

    // Create the links
    const link = svg.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", d => d.isDashed ? "#757575" : "#0b9b79")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", d => d.isDashed ? "5,5" : "none")
      .style("opacity", d => {
        if (!selectedNode) return 1
        if (selectedNode === "purpose") return 0.2
        return (d.source as Node).id === selectedNode || (d.target as Node).id === selectedNode ? 1 : 0.2
      })

    // Create the nodes
    const node = svg.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .classed("node", true)
      .style("cursor", "pointer")
      .on("click", (_, d) => {
        if (onNodeClick) onNodeClick(d.id)
      })
      .call(drag(simulation) as any)

    // Add patterns for the 'enter' icon
    defs.append("pattern")
      .attr("id", "union-pattern")
      .attr("width", 1)
      .attr("height", 1)
      .append("image")
      .attr("href", "/Union.svg")
      .attr("width", 34)
      .attr("height", 34)

    // Add patterns for non-enter icons
    const iconFiles = {
      "purpose": "icon2.svg",
      "how": "icon1.svg",
      "involved": "icon3.svg",
      "team": "icon4.svg"
    }

    Object.entries(iconFiles).forEach(([nodeId, iconFile]) => {
      defs.append("pattern")
        .attr("id", `${nodeId}-pattern`)
        .attr("width", 1)
        .attr("height", 1)
        .append("image")
        .attr("href", `/${iconFile}`)
        .attr("width", 40)
        .attr("height", 40)
    })

    // Add icons for non-ENTER nodes
    node.filter(d => !d.isEnter)
      .append("rect")
      .attr("class", "enter-button")
      .attr("x", -20)
      .attr("y", -20)
      .attr("width", 40)
      .attr("height", 40)
      .attr("fill", d => `url(#${d.id}-pattern)`)

    // Add transparent box around Union image for ENTER node
    node.filter(d => d.isEnter === true)
      .append("rect")
      .attr("x", -25)
      .attr("y", -25)
      .attr("width", 50)
      .attr("height", 50)
      .attr("fill", "transparent")
      .attr("rx", 4)

    // Add Union image for ENTER node
    node.filter(d => d.isEnter === true)
      .append("rect")
      .attr("class", "enter-icon")
      .attr("x", -17)
      .attr("y", -17)
      .attr("width", 34)
      .attr("height", 34)
      .attr("fill", "url(#union-pattern)")

    // Add green box under ENTER node
    node.filter(d => d.isEnter === true)
      .append("rect")
      .attr("class", "enter-label")
      .attr("x", -35)
      .attr("y", 25)
      .attr("width", 70)
      .attr("height", 24)
      .attr("fill", "#0b9b79")

    // Add white background for text labels (visible on hover or when selected)
    node.append("rect")
      .attr("x", d => d.isEnter ? -40 : 30)
      .attr("y", d => d.isEnter ? 35 : -15)
      .attr("width", d => getBackgroundWidth(d.id, d.isEnter, d.name))
      .attr("height", 30)
      .attr("fill", "white")
      .attr("class", "text-bg")
      .style("opacity", d => d.isEnter ? 0 : 0) // Initially hidden for all nodes

    // Labels
    node.append("text")
      .attr("class", "handjet")
      .attr("font-size", "24px")
      .attr("text-anchor", d => d.isEnter ? "middle" : "start")
      .attr("x", d => d.isEnter ? 0 : 30)
      .attr("y", d => d.isEnter ? 43 : "0.35em")  // Reduced from 50 for ENTER node
      .attr("fill", d => {
        if (d.id === "enter") return "black"
        return "white"
      })
      .text(d => d.name)

    // Add hover behavior to nodes
    node.on("mouseenter", function() {
      const thisNode = d3.select(this);
      const nodeData = thisNode.datum() as Node;
      
      if (nodeData.isEnter) {
        // Change color of icon on hover
        thisNode.select(".enter-icon")
          .transition()
          .duration(200)
          .attr("fill", "url(#union-pattern)")
          .style("filter", "brightness(1.3)"); // Brighten the icon
          
        // Change green label color on hover
        thisNode.select(".enter-label")
          .transition()
          .duration(200)
          .attr("fill", "#30c0a0"); // Lighter green on hover
          
        return;
      }

      // Regular hover effect for other nodes
      thisNode.select(".text-bg")
        .transition()
        .duration(200)
        .style("opacity", 1);
        
      thisNode.select("text")
        .transition()
        .duration(200)
        .attr("fill", "black");
    })
    .on("mouseleave", function() {
      const thisNode = d3.select(this);
      const nodeData = thisNode.datum() as Node;
      
      if (nodeData.isEnter) {
        // Remove icon brightness effect
        thisNode.select(".enter-icon")
          .transition()
          .duration(200)
          .style("filter", null);
          
        // Return label to original color
        thisNode.select(".enter-label")
          .transition()
          .duration(200)
          .attr("fill", "#0b9b79"); // Original green
          
        return;
      }
      
      // Keep background for selected node
      if (selectedNode === nodeData.id) return;
      
      thisNode.select(".text-bg")
        .transition()
        .duration(200)
        .style("opacity", 0);
        
      thisNode.select("text")
        .transition()
        .duration(200)
        .attr("fill", "white");
    });

    simulation.on("tick", () => {
      link
        .attr("x1", d => {
          if ((d.source as Node).id === "enter") {
            const intersection = calculateIntersection(
              (d.source as Node).x, (d.source as Node).y,
              (d.target as Node).x, (d.target as Node).y,
              110
            )
            return intersection.x
          }
          return (d.source as Node).x
        })
        .attr("y1", d => {
          if ((d.source as Node).id === "enter") {
            const intersection = calculateIntersection(
              (d.source as Node).x, (d.source as Node).y,
              (d.target as Node).x, (d.target as Node).y,
              110
            )
            return intersection.y
          }
          return (d.source as Node).y
        })
        .attr("x2", d => (d.target as Node).x)
        .attr("y2", d => (d.target as Node).y)

      node.attr("transform", d => `translate(${d.x},${d.y})`)
    })

    function drag(simulation: d3.Simulation<Node, undefined>) {
      function dragstarted(event: d3.D3DragEvent<SVGElement, Node, any>, d: Node) {
        if (!event.active) simulation.alphaTarget(0.3).restart()
        d.fx = d.x
        d.fy = d.y
      }
      function dragged(event: d3.D3DragEvent<SVGElement, Node, any>, d: Node) {
        d.fx = event.x
        d.fy = event.y
      }
      function dragended(event: d3.D3DragEvent<SVGElement, Node, any>, d: Node) {
        if (!event.active) simulation.alphaTarget(0)
        d.fx = null
        d.fy = null
      }
      return d3.drag<SVGElement, Node>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended)
    }

    // Cleanup
    return () => {
      simulation.stop()
    }
  // Run only once unless nodes/links shape actually changes
  }, [])

  // -- Update click handlers if onNodeClick changes --
  useEffect(() => {
    if (!svgRef.current) return
    d3.select(svgRef.current)
      .selectAll<SVGGElement, Node>(".node")
      .on("click", (_, d) => {
        if (onNodeClick) onNodeClick(d.id)
      })
  }, [onNodeClick])

  // -- Re-style based on selectedNode --
  useEffect(() => {
    const svg = d3.select(svgRef.current)
    svg.selectAll("line").style("opacity", d => {
      const link = d as Link
      if (!selectedNode) return 1
      if (selectedNode === "purpose") return 0.2
      return (link.source as Node).id === selectedNode || (link.target as Node).id === selectedNode ? 1 : 0.2
    })
    svg.selectAll("g.node").style("opacity", d => {
      const node = d as Node
      if (!selectedNode) return 1
      return node.id === selectedNode ? 1 : 0.2
    })
  }, [selectedNode])

  // Function to get specific widths for each node's background
  function getBackgroundWidth(nodeId: string, isEnter: boolean = false, name: string = ""): number {
    // Custom widths for specific nodes
    const customWidths: Record<string, number> = {
      "purpose": 100,
      "how": 150,
      "involved": 100,
      "team": 75,
      "enter": 80
    };
    
    // If we have a custom width defined, use it
    if (customWidths[nodeId]) {
      return customWidths[nodeId];
    }
    
    // Otherwise use the formula based on text length
    return isEnter ? 80 : name.length * 10 - 7;
  }

  useEffect(() => {
    console.log("Simulation useEffect (runs only once)")
  }, [])

  return (
    <svg
      ref={svgRef}
      className="w-full h-full transition-transform duration-500 ease-in-out"
      style={{
        transform: (selectedNode && shouldShift) ? 'translateX(-200px)' : 'translateX(0)'
      }}
    />
  )
}