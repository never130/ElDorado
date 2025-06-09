#!/usr/bin/env python3
"""Test script to verify the new números enteros model loads correctly"""

import sys
import os
sys.path.append('.')

try:
    from utils.image_processing import ImageProcessor
    print("✅ ImageProcessor imported successfully")
    
    processor = ImageProcessor()
    print("✅ New números enteros model loaded successfully!")
    print(f"Model classes: {len(processor.model.names)} classes")
    print(f"Classes: {list(processor.model.names.values())}")
    print(f"Model path: {processor.model.ckpt_path}")
    
    # Test basic model info
    print("\n📊 Model Information:")
    print(f"- Model type: {type(processor.model).__name__}")
    print(f"- Confidence threshold: {processor.min_confidence}")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
