"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { useState, useEffect } from "react"
import { Slide } from '../data/slides'

interface SlideShowProps {
  slides: Slide[]
  selectedNode: string | null
  onClose?: () => void
}

export default function SlideShow({ slides, selectedNode, onClose }: SlideShowProps) {
  const [currentSlide, setCurrentSlide] = useState(0)

  // Reset slide index when selected node changes
  useEffect(() => {
    setCurrentSlide(0)
  }, [selectedNode])

  if (!selectedNode || !slides || slides.length === 0) return null

  const currentSlideData = slides[currentSlide]
  if (!currentSlideData) return null

  const handlePrevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1)
    }
  }

  const handleNextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(prev => prev + 1)
    }
  }

  const getFigureNumber = () => {
    // Count how many slides with figures come before the current slide
    let figureCount = 0;
    for (let i = 0; i <= currentSlide; i++) {
      if (slides[i].figure) {
        figureCount++;
      }
    }
    return figureCount;
  }

  return (
    <div className="h-[70%] w-[75%] bg-black p-8 flex flex-col mx-auto mt-[15%] relative">
      {/* Close button */}
      <span 
        onClick={onClose}
        className="absolute -top-5 right-2 handjet text-[60px] text-[#757575] hover:text-white transition-colors cursor-pointer"
      >
        ×
      </span>

      {/* Header with figure number and title */}
      <div className="flex flex-col space-y-4 mb-8">
        <div className="flex items-center space-x-2">
          <span className="text-[#757575] handjet text-[36px]">{String(currentSlide + 1).padStart(2, '0')}</span>
        </div>
        <div className="bg-white w-full py-[1px] px-4">
          <h2 className="text-black handjet text-[26px]">{currentSlideData.title}</h2>
        </div>
      </div>

      {/* Content */}
      <div className="flex-grow overflow-auto">
        <p className="text-white text-[16px] mb-8 font-inter">{currentSlideData.content}</p>
        {currentSlideData.figure && (
          <div className="mt-8">
            <img 
              src={currentSlideData.figure} 
              alt={`Figure for ${currentSlideData.title}`}
              className="max-w-full"
            />
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8">
        <div 
          onClick={currentSlide > 0 ? handlePrevSlide : undefined}
          className={`flex items-center space-x-2 ${
            currentSlide > 0 
              ? 'cursor-pointer hover:text-white' 
              : 'opacity-50 cursor-not-allowed'
          }`}
        >
          <ChevronLeft className="w-4 h-4 text-[#757575]" />
          <span className={`handjet text-[24px] ${currentSlide > 0 ? 'text-[#757575] hover:text-white transition-colors' : 'text-[#757575]'}`}>
            Back
          </span>
        </div>
        {currentSlideData.figure && (
          <div className="text-[#757575] text-[24px] handjet">
            Fig {String(getFigureNumber()).padStart(2, '0')}
          </div>
        )}
        <div 
          onClick={currentSlide < slides.length - 1 ? handleNextSlide : undefined}
          className={`flex items-center space-x-2 ${
            currentSlide < slides.length - 1 
              ? 'cursor-pointer hover:text-white' 
              : 'opacity-50 cursor-not-allowed'
          }`}
        >
          <span className={`handjet text-[24px] ${currentSlide < slides.length - 1 ? 'text-[#757575] hover:text-white transition-colors' : 'text-[#757575]'}`}>
            Next
          </span>
          <ChevronRight className="w-4 h-4 text-[24px] text-[#757575]" />
        </div>
      </div>
    </div>
  )
}
