import { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface NodeData {
  website: string;
  user: string;
  nextNode: string | null;
  visitNumber: number;
  visitTime: number;
  avgTime: number;
  type: string;
  x: number;
  y: number;
}

interface GraphProps {
  data: NodeData[];
}

export default function NodeGraph({ data }: GraphProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current)
      .attr('width', window.innerWidth)
      .attr('height', window.innerHeight)

    svg.selectAll("*").remove();

    // red edges
    data.forEach(node => {
      if (node.nextNode) {
        const nextNode = data.find(d => d.website === node.nextNode);
        if (nextNode) {
          svg.append('line')
            .attr('x1', node.x * 8) 
            .attr('y1', node.y * 8)
            .attr('x2', nextNode.x * 8)
            .attr('y2', nextNode.y * 8)
            .attr('stroke', '#FF6363')
            .attr('stroke-width', 1);
        }
      }
    });

    //nodes
    svg.selectAll('.node')
      .data(data)
      .enter().append('circle')
      .attr('class', 'node')
      .attr('cx', d => d.x * 8)  
      .attr('cy', d => d.y * 8)
      .attr('r', d => Math.min(d.visitNumber, 20))  // radius scaled by visitNumber (max 20)
      .attr('stroke', '#539167')
      .attr('stroke-width', 2)
      .on('click', function (_, d) {
        setSelectedNode(d);
      });

    //text labels
    svg.selectAll('.node-label')
      .data(data.filter(d => d.visitNumber > 20))
      .enter().append('text')
      .attr('class', 'node-label')
      .attr('x', d => d.x * 8)
      .attr('y', d => d.y * 8)
      .attr('dy', -40)
      .attr('text-anchor', 'middle')
      .attr('fill', '#539167')
      .text(d => d.website)
      .style('font-family', 'Instrument Serif, serif') 
      .style('font-size', '32px')
      .style('font-style', 'italic');

  }, [data]);

  return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <svg ref={svgRef} />
    
          {/* Display the selected node's information */}
          {selectedNode && (
            <div
              style={{
                position: 'absolute',
                top: `${selectedNode.y * 8 + 20}px`,  // Position below the node
                left: `${selectedNode.x * 8 - 50}px`, // Center it with respect to the node
                color: 'white',
                fontSize: '16px',
                background: 'rgba(0, 0, 0, 0.7)',  // Background with opacity for readability
                padding: '10px',
                borderRadius: '8px',
                width: '200px',
              }}
            >
              <p><strong>Website:</strong> {selectedNode.website}</p>
              <p><strong>Visit Number:</strong> {selectedNode.visitNumber}</p>
              <p><strong>Visit Time:</strong> {selectedNode.visitTime} minutes</p>
              <p><strong>Average Time:</strong> {selectedNode.avgTime} minutes</p>
              <p><strong>Type:</strong> {selectedNode.type}</p>
            </div>
          )}
        </div>
  );
}
