// Base interfaces for UI elements
export interface Position {
    x: number;
    y: number;
}

export interface Dimensions {
    width: number;
    height: number;
}

// Base metadata that's always loaded
export interface BaseMetadata {
    id: string;
    name: string;
    coverImage?: string;
    color: string;
}

// Extended metadata that can be loaded lazily
export interface ExtendedMetadata {
    description?: string;
    tags?: string[];
    createdAt: Date;
    updatedAt: Date;
    // Add more fields as needed
}

// UI-specific interfaces
export interface Item {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    circles: string[]; // IDs of circles this item belongs to
    isDragging: boolean;
}

// Circle type definitions
export interface Circle {
    id: string;
    label: string;
    x: number;
    y: number;
    r: number; // radius
    elements: string[]; // IDs of items in this circle
    isDragging: boolean;
    children?: string[];  // IDs of child circles
    parents?: string[];   // IDs of parent circles (for intersections)
}

// Component props
export interface CircleProps {
    circle: Circle;
    onDragStart: (event: d3.D3DragEvent<SVGElement, Circle, Circle>, circle: Circle) => void;
    onDrag: (event: d3.D3DragEvent<SVGElement, Circle, Circle>, circle: Circle) => void;
    onDragEnd: (event: d3.D3DragEvent<SVGElement, Circle, Circle>, circle: Circle) => void;
}

// State management interfaces
export interface VennDiagramState {
    items: Item[];
    circles: Circle[];
    isDragging: boolean;
}

// Event handlers
export interface DragHandlers {
    onDragStart: (event: d3.D3DragEvent<SVGElement, Item | Circle, Item | Circle>, element: Item | Circle) => void;
    onDrag: (event: d3.D3DragEvent<SVGElement, Item | Circle, Item | Circle>, element: Item | Circle) => void;
    onDragEnd: (event: d3.D3DragEvent<SVGElement, Item | Circle, Item | Circle>, element: Item | Circle) => void;
}

// Component props
export interface VennDiagramProps {
    initialState?: Partial<VennDiagramState>;
    onStateChange?: (state: VennDiagramState) => void;
    onElementSelect?: (element: Item | Circle) => void;
    onMetadataRequest?: (id: string, type: 'item' | 'circle') => Promise<ExtendedMetadata>;
} 