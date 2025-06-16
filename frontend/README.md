# Venn Diagram App

An interactive Venn diagram application that allows users to create, group, and manipulate circles and items.

## Features

### Circle Management
- Add new circles with items using the "Add Item" button
- Drag circles freely around the canvas
- Circles are rendered with proper z-index (larger circles behind smaller ones)

### Grouping Logic
1. **Group Formation**
   - When two circles overlap, a larger containing circle is created
   - The original circles remain visible inside the larger circle
   - Groups are formed when dragging ends (onDragEnd)
   - Only individual circles (not groups) are checked for overlap

2. **Group Movement**
   - Dragging a group circle moves all its children with it
   - Children maintain their relative positions within the group
   - Groups can be moved as a single unit

3. **Group Breaking**
   - Dragging a circle far enough from its group breaks the connection
   - If a group has only one child left, the group is dissolved
   - The freed circle becomes an individual circle again

### Item Management
- Each circle can contain one or more items
- Items are centered within their circles
- Items move with their containing circles
- Items maintain their relative positions during group movement

### Visual Hierarchy
- Larger circles are rendered behind smaller ones
- All circles (individual and groups) remain visible
- The visual structure clearly shows group relationships

## Technical Implementation

### State Management
- Circles are stored in a map with unique IDs
- Each circle tracks:
  - Position (x, y)
  - Radius (r)
  - Items it contains
  - Children (for group circles)
- Items are stored separately with references to their containing circles

### Drag and Drop
- Uses d3-drag for smooth drag operations
- Handles three types of drag:
  1. Individual circle movement
  2. Group movement (with children)
  3. Circle detachment from groups

### Group Formation
- Overlap is detected using distance between circle centers
- Groups are created with:
  - Center point between overlapping circles
  - Radius large enough to contain both circles
  - References to child circles
  - No items (items stay with their original circles)

## Usage

1. Click "Add Item" to create a new circle with an item
2. Drag circles to move them
3. Drag circles together to form groups
4. Drag circles apart to break groups
5. Drag groups to move all contained circles together

## Technical Architecture

### Core Components

1. **VennDiagram** (Container)
   - Manages the overall layout
   - Handles zoom/pan
   - Coordinates between items and circles

2. **Item**
   - Individual elements
   - Always exists inside a circle (when solo, its own circle is rendered around it)
   - Moves only when its containing circle is dragged

3. **Circle** (Draggable)
   - Contains one or more items/other circles
   - Can be dragged to move all contained items
   - Handles item membership and grouping

### State Management

The application uses Zustand for state management, providing:
- Simple and efficient state updates
- Built-in performance optimizations
- TypeScript support
- DevTools integration

```typescript
interface VennDiagramState {
  items: Item[];
  circles: Circle[];
  isDragging: boolean;
}
```

### Key Algorithms

1. **Circle Formation**
   ```typescript
   function shouldFormCircle(items: Item[]): boolean {
     // Check if items are close enough
     // Return true if they should form a circle
   }
   ```

2. **Item-Circle Membership**
   ```typescript
   function isItemInCircle(item: Item, circle: Circle): boolean {
     // Check if item is within circle's bounds
   }
   ```

3. **Circle Merging**
   ```typescript
   function shouldMergeCircles(circle1: Circle, circle2: Circle): boolean {
     // Check if circles overlap significantly
   }
   ```

## Project Structure

```
src/
├── components/
│   ├── VennDiagram.tsx    # Main container
│   ├── Item.tsx          # Draggable items
│   └── Circle.tsx        # Circle groups
├── hooks/
│   └── useVennDiagram.ts # Core logic
├── store/
│   └── vennDiagramStore.ts # State management
└── types/
    └── index.ts          # Type definitions
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone [repository-url]
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

## Development

### Key Technical Decisions

#### State Management
- Zustand for simplicity and performance
- Atomic state updates
- Throttled updates during drag operations

#### Performance
- D3 for drag operations
- Throttled updates for smooth interactions
- Optimized re-renders

#### User Experience
- Smooth animations
- Clear visual feedback
- Intuitive interactions

### Implementation Strategy

#### Phase 1: Basic Functionality
1. Setup basic structure
   - Create basic components
   - Implement drag and drop
   - Add basic styling

2. Implement core features
   - Item dragging
   - Circle formation
   - Basic grouping

#### Phase 2: Enhanced Features
1. Improve interactions
   - Smooth animations
   - Better drag behavior
   - Visual feedback

2. Add advanced features
   - Circle merging
   - Item removal
   - Group operations

#### Phase 3: Polish
1. Performance optimization
   - Throttle updates
   - Optimize renders
   - Add caching

2. User experience
   - Add tooltips
   - Improve visual feedback
   - Add keyboard controls

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- React for the UI framework
- D3 for drag and drop functionality
- Zustand for state management
- TypeScript for type safety
