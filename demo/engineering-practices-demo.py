# AI Debugger Mentor - Graphite Engineering Practices Demo
# This file demonstrates good and bad engineering practices

import os
import sys
from typing import List, Optional
import unittest


class GoodPracticesExample:
    """
    This class demonstrates good engineering practices that will score well
    in the Graphite engineering analysis.
    """
    
    def __init__(self, name: str) -> None:
        self.name = name
        self.items: List[str] = []
    
    def add_item(self, item: str) -> bool:
        """Add an item to the collection.
        
        Args:
            item: The item to add
            
        Returns:
            True if item was added successfully
        """
        if not item or item.strip() == "":
            return False
        
        self.items.append(item.strip())
        return True
    
    def get_items_count(self) -> int:
        """Get the number of items in the collection."""
        return len(self.items)
    
    def find_item(self, search_term: str) -> Optional[str]:
        """Find an item containing the search term.
        
        Args:
            search_term: Term to search for
            
        Returns:
            First matching item or None if not found
        """
        for item in self.items:
            if search_term.lower() in item.lower():
                return item
        return None


class BadPracticesExample:
    # No docstring, poor naming, no type hints
    def __init__(self, n):
        self.n = n
        self.d = {}  # Unclear variable names
    
    # Very long function that does too many things
    def process_data(self, data, flag1, flag2, flag3, special_mode, debug_mode, override_safety, use_cache, validate_input, transform_output):
        if flag1: result = []
        else: result = {}
        for i in data:
            if flag2 and flag3 and special_mode and not debug_mode: temp = i * 2
            elif override_safety or (use_cache and validate_input): temp = i + 1
            else: temp = i
            if transform_output: temp = str(temp).upper() if isinstance(temp, str) else temp
            if isinstance(result, list): result.append(temp)
            else: result[len(result)] = temp
        return result  # No error handling, unclear return type


# Good practice: Comprehensive test coverage
class TestGoodPractices(unittest.TestCase):
    """Test cases for GoodPracticesExample."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.example = GoodPracticesExample("test")
    
    def test_add_item_success(self):
        """Test successful item addition."""
        result = self.example.add_item("test item")
        self.assertTrue(result)
        self.assertEqual(self.example.get_items_count(), 1)
    
    def test_add_empty_item_fails(self):
        """Test that empty items are rejected."""
        result = self.example.add_item("")
        self.assertFalse(result)
        self.assertEqual(self.example.get_items_count(), 0)
    
    def test_find_item_exists(self):
        """Test finding an existing item."""
        self.example.add_item("hello world")
        result = self.example.find_item("world")
        self.assertEqual(result, "hello world")
    
    def test_find_item_not_exists(self):
        """Test finding a non-existent item."""
        result = self.example.find_item("missing")
        self.assertIsNone(result)


# Engineering practices this file demonstrates:
# ✅ Type hints throughout
# ✅ Comprehensive docstrings
# ✅ Unit tests with good coverage
# ✅ Clear function names and purposes
# ✅ Proper error handling
# ✅ Consistent code style
# ✅ Small, focused functions
# ✅ Good variable naming

# Bad practices shown for contrast:
# ❌ No type hints
# ❌ No documentation
# ❌ Overly complex functions
# ❌ Poor variable naming
# ❌ No error handling
# ❌ Unclear return types

if __name__ == "__main__":
    # Good practice: Proper main guard
    unittest.main()
