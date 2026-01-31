import unittest
import pandas as pd
import numpy as np

# Mocking the logic from the scripts
def map_port_code_logic(raw_value):
    # Logic from import_us_ports.py
    if pd.isna(raw_value):
        return None
    
    # Simulate pandas reading int
    if isinstance(raw_value, (int, float)):
        return str(int(raw_value)).zfill(4)
    
    # Simulate pandas reading string
    val_str = str(raw_value).strip()
    if val_str.isdigit():
        return val_str.zfill(4)
    
    return val_str

class TestPortMapping(unittest.TestCase):
    def test_integer_code_padding(self):
        # Excel often returns 101 for 0101
        self.assertEqual(map_port_code_logic(101), "0101")
        self.assertEqual(map_port_code_logic(2010), "2010")
        self.assertEqual(map_port_code_logic(5), "0005")

    def test_string_code_padding(self):
        self.assertEqual(map_port_code_logic("101"), "0101")
        self.assertEqual(map_port_code_logic("0101"), "0101")
        self.assertEqual(map_port_code_logic(" 101 "), "0101")

    def test_alphanumeric_code(self):
        # Some codes might be alphanumeric (unlikely for US ports but possible globally)
        self.assertEqual(map_port_code_logic("A101"), "A101")

    def test_float_code(self):
        self.assertEqual(map_port_code_logic(101.0), "0101")

if __name__ == '__main__':
    unittest.main()
