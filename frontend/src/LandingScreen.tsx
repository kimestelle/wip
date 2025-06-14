"use client"

import { Plus } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import ForceGraph from './components/ForceGraph'
import SlideShow from './components/SlideShow'
import { slides, NodeId } from './data/slides'

import PostProcessOverlay from "./components/PostProcessOverlay"

export default function InternetAtlas() {
  const [selectedNode, setSelectedNode] = useState<NodeId | null>(null)
  const navigate = useNavigate()

  // Define the nodes and links
  const nodes = [
    { id: "purpose", name: "Our purpose", x: 0, y: 0 },
    { id: "how", name: "How does it work?", x: 100, y: -100 },
    { id: "involved", name: "Get Involved", x: 100, y: 0 },
    { id: "team", name: "Our team", x: 100, y: 100 },
    { id: "enter", name: "ENTER", x: -100, y: 0, isEnter: true }
  ]

  const links = [
    { source: "purpose", target: "how", isDashed: true },
    { source: "purpose", target: "involved", isDashed: true },
    { source: "purpose", target: "team", isDashed: true },
    { source: "enter", target: "purpose", isDashed: false }
  ]

  const handleNodeClick = (nodeId: string) => {
    if (nodeId === "enter") {
      // First highlight the ENTER node
      setSelectedNode("enter" as NodeId)
      // Then navigate after a short delay to show the highlight
      setTimeout(() => {
        navigate('/visualization')
      }, 300)
      return
    }
    setSelectedNode(prevNode => prevNode === nodeId ? null : nodeId as NodeId)
  }

  return (
    <div className="relative w-full h-screen bg-black text-white overflow-hidden">
      {!selectedNode && (
        <PostProcessOverlay />
      )}
      {/* Corner plus symbols */}
      <div className="absolute top-8 left-8 z-[11]">
        <Plus className="text-[#757575] w-8 h-8" />
      </div>
      <div className="absolute top-8 right-8 z-[11]">
        <Plus className="text-[#757575] w-8 h-8" />
      </div>
      <div className="absolute bottom-8 left-8 z-[11]">
        <Plus className="text-[#757575] w-8 h-8" />
      </div>
      <div className="absolute bottom-8 right-8 z-[11]">
        <Plus className="text-[#757575] w-8 h-8" />
      </div>

      {/* Header */}
      <div className="absolute top-8 left-24 flex items-center space-x-4 z-[11]">
        <h1 className="text-[28px] tracking-wider handjet">INTERNET ATLAS</h1>
        <span className="text-[#757575] handjet text-[28px]">For the cyber voyagers</span>
      </div>

      {/* Main content */}
      <div className="w-full h-full">
        {/* Force Graph - now spans full width */}
        <div className="absolute inset-0 z-[11]">
          <ForceGraph 
            nodes={nodes} 
            links={links} 
            onNodeClick={handleNodeClick}
            selectedNode={selectedNode}
          />
        </div>

        {/* Right side - Slides */}
        {selectedNode && slides[selectedNode] && (
          <div className="absolute right-0 w-1/2 h-full z-[11]">
            <SlideShow 
              slides={slides[selectedNode]} 
              selectedNode={selectedNode}
              onClose={() => setSelectedNode(null)}
            />
          </div>
        )}
      </div>
    </div>
  )
}