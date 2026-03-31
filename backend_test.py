#!/usr/bin/env python3
"""
Backend API Testing for Trading Application
==========================================

Tests the key API endpoints:
1. /api/health - Health check
2. /api/ta-engine/pattern-v2/BTC - Pattern detection API
3. Timeframe functionality
"""

import requests
import sys
import json
from datetime import datetime

class TradingAPITester:
    def __init__(self, base_url="https://project-build-46.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.results = []

    def log_result(self, test_name, success, details="", response_data=None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        if response_data:
            result["response_sample"] = response_data
        
        self.results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}")
        if details:
            print(f"    {details}")

    def test_health_endpoint(self):
        """Test /api/health endpoint"""
        try:
            url = f"{self.base_url}/api/health"
            response = requests.get(url, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("ok") is True:
                    self.log_result(
                        "Health endpoint returns ok:true", 
                        True, 
                        f"Status: {response.status_code}, Response: {data}",
                        data
                    )
                    return True
                else:
                    self.log_result(
                        "Health endpoint returns ok:true", 
                        False, 
                        f"Expected ok:true, got: {data}"
                    )
            else:
                self.log_result(
                    "Health endpoint returns ok:true", 
                    False, 
                    f"HTTP {response.status_code}: {response.text[:200]}"
                )
        except Exception as e:
            self.log_result(
                "Health endpoint returns ok:true", 
                False, 
                f"Request failed: {str(e)}"
            )
        return False

    def test_pattern_api(self, symbol="BTC", timeframe="4H"):
        """Test /api/ta-engine/pattern-v2/{symbol} endpoint"""
        try:
            url = f"{self.base_url}/api/ta-engine/pattern-v2/{symbol}"
            params = {"timeframe": timeframe}
            
            response = requests.get(url, params=params, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if response has expected structure
                has_patterns = bool(data.get("dominant") or data.get("primary_pattern"))
                has_ok_status = data.get("ok") is True
                
                if has_ok_status and has_patterns:
                    pattern_info = data.get("dominant") or data.get("primary_pattern") or {}
                    pattern_type = pattern_info.get("type", "unknown")
                    confidence = pattern_info.get("confidence", 0)
                    
                    self.log_result(
                        f"Pattern API /api/ta-engine/pattern-v2/{symbol} works and returns patterns",
                        True,
                        f"Pattern: {pattern_type}, Confidence: {confidence:.2f}",
                        {
                            "pattern_type": pattern_type,
                            "confidence": confidence,
                            "timeframe": timeframe
                        }
                    )
                    return True
                else:
                    self.log_result(
                        f"Pattern API /api/ta-engine/pattern-v2/{symbol} works and returns patterns",
                        False,
                        f"Missing patterns or ok status. Keys: {list(data.keys())}"
                    )
            else:
                self.log_result(
                    f"Pattern API /api/ta-engine/pattern-v2/{symbol} works and returns patterns",
                    False,
                    f"HTTP {response.status_code}: {response.text[:200]}"
                )
        except Exception as e:
            self.log_result(
                f"Pattern API /api/ta-engine/pattern-v2/{symbol} works and returns patterns",
                False,
                f"Request failed: {str(e)}"
            )
        return False

    def test_timeframe_functionality(self, symbol="BTC"):
        """Test different timeframes work properly"""
        timeframes = ["4H", "1D", "7D", "1M", "6M", "1Y"]
        successful_timeframes = []
        
        for tf in timeframes:
            try:
                url = f"{self.base_url}/api/ta-engine/pattern-v2/{symbol}"
                params = {"timeframe": tf}
                
                response = requests.get(url, params=params, timeout=30)
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("ok"):
                        successful_timeframes.append(tf)
                        print(f"    ✓ {tf} timeframe working")
                    else:
                        print(f"    ✗ {tf} timeframe returned ok:false")
                else:
                    print(f"    ✗ {tf} timeframe HTTP {response.status_code}")
            except Exception as e:
                print(f"    ✗ {tf} timeframe failed: {str(e)}")
        
        success = len(successful_timeframes) >= 4  # At least 4 out of 6 should work
        self.log_result(
            "Timeframe switcher (4H, 1D, 7D, 1M, 6M, 1Y) works properly",
            success,
            f"Working timeframes: {successful_timeframes} ({len(successful_timeframes)}/6)",
            {"working_timeframes": successful_timeframes}
        )
        return success

    def run_all_tests(self):
        """Run all backend tests"""
        print("=" * 60)
        print("BACKEND API TESTING")
        print("=" * 60)
        
        # Test 1: Health endpoint
        self.test_health_endpoint()
        
        # Test 2: Pattern API for BTC
        self.test_pattern_api("BTC", "4H")
        
        # Test 3: Timeframe functionality
        self.test_timeframe_functionality("BTC")
        
        # Summary
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        # Show failed tests
        failed_tests = [r for r in self.results if not r["success"]]
        if failed_tests:
            print("\nFAILED TESTS:")
            for test in failed_tests:
                print(f"  ❌ {test['test']}: {test['details']}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = TradingAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())