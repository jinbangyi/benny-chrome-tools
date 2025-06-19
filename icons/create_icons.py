#!/usr/bin/env python3
"""
Simple script to create basic icons for the Chrome extension
"""

from PIL import Image, ImageDraw
import os

def create_icon(size, filename):
    # Create a new image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw a simple network/monitor icon
    # Background circle
    margin = size // 8
    draw.ellipse([margin, margin, size-margin, size-margin], 
                fill=(0, 124, 186, 255), outline=(0, 90, 140, 255), width=2)
    
    # Network lines
    center = size // 2
    line_width = max(1, size // 16)
    
    # Horizontal lines
    for i in range(3):
        y = center - size//6 + i * size//6
        x1 = center - size//4
        x2 = center + size//4
        draw.line([x1, y, x2, y], fill=(255, 255, 255, 255), width=line_width)
    
    # Vertical connecting lines
    for i in range(2):
        x = center - size//8 + i * size//4
        y1 = center - size//6
        y2 = center + size//6
        draw.line([x, y1, x, y2], fill=(255, 255, 255, 255), width=line_width)
    
    # Save the image
    img.save(filename, 'PNG')
    print(f"Created {filename} ({size}x{size})")

def main():
    # Create icons in different sizes
    sizes = [16, 32, 48, 128]
    
    for size in sizes:
        filename = f"icon{size}.png"
        create_icon(size, filename)

if __name__ == "__main__":
    main()