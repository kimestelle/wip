'use client';
import { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react';

interface CircleSelectorProps {
  onSelect?: (value: string) => void;
  isLateral: boolean;
  selectedValue: string;
}

export default function CircleSelector({ onSelect, isLateral, selectedValue }: CircleSelectorProps) {
  const categories = ['piece', 'heavy', 'organic', 'ash', 'light', 'soft', 'silk', 'smooth', 'sharp', 'fuzzy'];
  const radius = 250;
  const increment = 360 / categories.length;

  const circleRef = useRef<HTMLDivElement | null>(null);
  const isDragging = useRef(false);
  const startAngle = useRef(0);
  const initialAngle = useRef(0);
  const currentDragAngle = useRef(0);

  const selectedIndex = categories.indexOf(selectedValue);
  const [angle, setAngle] = useState(-selectedIndex * increment);

  // Sync angle with selectedValue on mount and update
  useEffect(() => {
    const targetAngle = -categories.indexOf(selectedValue) * increment;
    if (angle !== targetAngle) setAngle(targetAngle);
  }, [selectedValue, categories, increment]);

  // Apply transforms to children when angle or selection changes
  useLayoutEffect(() => {
    const centerIndex = categories.indexOf(selectedValue);
    if (circleRef.current) {
      Array.from(circleRef.current.children).forEach((child, index) => {
        const baseAngle = index * increment;
        const element = child as HTMLDivElement;
        let rotation = baseAngle;

        if (index === (centerIndex + 1) % categories.length) {
          rotation -= increment * 0.3;
        } else if (index === (centerIndex - 1 + categories.length) % categories.length) {
          rotation += increment * 0.3;
        }

        element.style.transform = `rotate(${rotation}deg) translateY(-${radius}px)`;
      });
    }
  }, [angle, selectedValue, categories, increment, radius]);

  const getAngleFromMouse = (x: number, y: number) => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    return Math.atan2(y - cy, x - cx) * (180 / Math.PI);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    startAngle.current = getAngleFromMouse(e.clientX, e.clientY);
    initialAngle.current = angle;
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;
    const current = getAngleFromMouse(e.clientX, e.clientY);
    const delta = current - startAngle.current;
    const updated = initialAngle.current - delta * 4;
    setAngle(updated);
    currentDragAngle.current = updated;
  }, []);

  const snapToNearestWord = useCallback(() => {
    let raw = currentDragAngle.current % 360;
    if (raw < 0) raw += 360;
    const nearest = Math.round(raw / increment) % categories.length;
    const newIndex = (categories.length - nearest) % categories.length;
    const newValue = categories[newIndex];

    if (newValue !== selectedValue) {
      onSelect?.(newValue);
    } else {
      setAngle(-newIndex * increment);
    }
  }, [categories, increment, onSelect, selectedValue]);

  const handleMouseUp = useCallback(() => {
    if (isDragging.current) {
      isDragging.current = false;
      snapToNearestWord();
    }
  }, [snapToNearestWord]);

  const handleWordClick = (index: number) => {
    const value = categories[index];
    if (value !== selectedValue) {
      setAngle(-index * increment);
      onSelect?.(value);
    }
  };

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div
      className="relative z-[30] circle-selector instrument-serif flex justify-center items-center cursor-pointer w-[450px] h-[450px] rounded-full m-auto"
      onMouseDown={handleMouseDown}
    >
      <div
        className="absolute w-[400px] h-[400px] rounded-[100%] bg-white large-shadow"
        style={{ transform: 'translate(-50%, -50%)', left: '50%', top: '50%' }}
      />
      <div
        ref={circleRef}
        className="absolute flex justify-center items-center w-full h-full"
        style={{ transform: `rotate(${angle}deg)`, transformOrigin: 'center center' }}
      >
        {categories.map((item, index) => (
          <div
            key={index}
            className="absolute text-center text-lg cursor-pointer select-none"
            style={{ transformOrigin: 'center center', transition: 'color 0.3s, opacity 0.3s' }}
            onClick={() => handleWordClick(index)}
          >
            <p
              className={isLateral ? 'rotate-90' : 'rotate-180'}
              style={{
                color: index === selectedIndex ? '#ffffff' : '#757575',
                opacity: index === selectedIndex ? 1 : 0.7,
              }}
            >
              {item} <span className="text-xs ml-2 text-white opacity-100">{index + 1}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Pointer arrows */}
      <div
        className="absolute -top-18 w-[15px] h-[12px] rotate-180"
        style={{
          backgroundImage: !isLateral ? 'url(/red-arrow.svg)' : 'url(/pink-arrow.svg)',
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <div
        className="absolute top-[33px] w-[12px] h-[12px] rotate-180"
        style={{
          backgroundImage: 'url(/cross.svg)',
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
    </div>
  );
}
