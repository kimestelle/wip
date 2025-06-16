import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { Circle as CircleType, CircleProps } from '../types';

const Circle: React.FC<CircleProps> = ({ circle, onDragStart, onDrag, onDragEnd }) => {
    const circleRef = useRef<SVGCircleElement>(null);
    const textRef = useRef<SVGTextElement>(null);

    useEffect(() => {
        const element = circleRef.current;
        if (!element) return;

        const dragBehavior = d3.drag<SVGCircleElement, CircleType>()
            .on('start', (event) => {
                event.sourceEvent.stopPropagation();
                onDragStart(event, circle);
            })
            .on('drag', (event) => {
                event.sourceEvent.stopPropagation();
                onDrag(event, circle);
            })
            .on('end', (event) => {
                event.sourceEvent.stopPropagation();
                onDragEnd(event, circle);
            });

        d3.select(element)
            .datum(circle)
            .call(dragBehavior);

        return () => {
            d3.select(element).on('.drag', null);
        };
    }, [circle, onDragStart, onDrag, onDragEnd]);

    return (
        <g>
            <circle
                ref={circleRef}
                cx={circle.x}
                cy={circle.y}
                r={circle.r}
                fill="transparent"
                stroke={circle.isDragging ? '#000' : '#ccc'}
                strokeWidth={2}
                strokeDasharray={circle.isDragging ? '5,5' : 'none'}
            />
            <text
                ref={textRef}
                x={circle.x}
                y={circle.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="12"
                fill="#666"
            >
                {circle.label}
            </text>
        </g>
    );
};

export default Circle; 