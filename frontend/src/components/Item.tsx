import React from 'react';
import { Item as ItemType } from '../types';

interface ItemProps {
    item: ItemType;
}

const Item: React.FC<ItemProps> = ({ item }) => {
    return (
        <rect
            x={item.x}
            y={item.y}
            width={item.width}
            height={item.height}
            fill={item.color}
            stroke={item.isDragging ? '#000' : 'none'}
            strokeWidth={2}
        />
    );
};

export default Item;