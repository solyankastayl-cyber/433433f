#!/usr/bin/env python3
"""
Backend API Testing for TA Engine - Chart Integration
=====================================================
Testing all backend endpoints and functionality
"""

import requests
import sys
import json
from datetime import datetime

class TAEngineAPITester:
    def __init__(self, base_url="https://task-completion-47.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.results = []

    def run_test(self, name, method, endpoint, expected_status=200, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            else:
                response = requests.request(method, url, json=data, headers=headers, timeout=10)

            success = response.status_code == expected_status
            
            result = {
                "name": name,
                "method": method,
                "endpoint": endpoint,
                "expected_status": expected_status,
                "actual_status": response.status_code,
                "success": success,
                "response_size": len(response.text),
                "has_json": False,
                "response_data": None
            }

            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                
                # Try to parse JSON response
                try:
                    json_data = response.json()
                    result["has_json"] = True
                    result["response_data"] = json_data
                    
                    # Print key info for important endpoints
                    if endpoint == "api/health":
                        print(f"   Health: {json_data.get('ok', False)}, Mode: {json_data.get('mode', 'unknown')}")
                    elif "candles" in endpoint:
                        candles = json_data.get('candles', [])
                        print(f"   Candles: {len(candles)} records")
                    elif "fractal" in endpoint:
                        print(f"   Fractal data: {json_data.get('ok', False)}")
                        
                except:
                    print(f"   Response: {response.text[:100]}...")
                    
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")

            self.results.append(result)
            return success, result.get("response_data", {})

        except requests.exceptions.Timeout:
            print(f"❌ Failed - Request timeout (10s)")
            self.results.append({**result, "success": False, "error": "timeout"})
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.results.append({**result, "success": False, "error": str(e)})
            return False, {}

    def test_core_endpoints(self):
        """Test core backend endpoints"""
        print("\n" + "="*60)
        print("TESTING CORE BACKEND ENDPOINTS")
        print("="*60)
        
        # Health check
        self.run_test("Health Check", "GET", "api/health")
        
        # System health
        self.run_test("System Health", "GET", "api/system/health")
        
        # Database health
        self.run_test("Database Health", "GET", "api/system/db-health")
        
        return True

    def test_chart_data_endpoints(self):
        """Test chart data endpoints"""
        print("\n" + "="*60)
        print("TESTING CHART DATA ENDPOINTS")
        print("="*60)
        
        # UI Candles
        self.run_test("UI Candles (BTC)", "GET", "api/ui/candles?asset=BTC&days=30")
        
        # Market Candles
        self.run_test("Market Candles", "GET", "api/market/candles?symbol=BTCUSDT&date_range=7d")
        
        # Fractal Chart
        self.run_test("Fractal Chart", "GET", "api/fractal/v2.1/chart?symbol=BTC&limit=100")
        
        # Fractal Signal
        self.run_test("Fractal Signal", "GET", "api/fractal/v2.1/signal?symbol=BTC")
        
        return True

    def test_ta_analysis_endpoints(self):
        """Test TA analysis endpoints"""
        print("\n" + "="*60)
        print("TESTING TA ANALYSIS ENDPOINTS")
        print("="*60)
        
        # TA Registry
        self.run_test("TA Registry", "GET", "api/ta/registry")
        
        # TA Patterns
        self.run_test("TA Patterns", "GET", "api/ta/patterns")
        
        # TA Analysis
        self.run_test("TA Analysis", "POST", "api/ta/analyze", data={"symbol": "BTCUSDT", "timeframe": "1d"})
        
        return True

    def test_provider_endpoints(self):
        """Test data provider endpoints"""
        print("\n" + "="*60)
        print("TESTING DATA PROVIDER ENDPOINTS")
        print("="*60)
        
        # Provider list
        self.run_test("Provider List", "GET", "api/provider/list")
        
        # Coinbase status
        self.run_test("Coinbase Status", "GET", "api/provider/coinbase/status")
        
        # Coinbase health
        self.run_test("Coinbase Health", "GET", "api/provider/coinbase/health")
        
        # Coinbase ticker
        self.run_test("Coinbase Ticker", "GET", "api/provider/coinbase/ticker/BTC")
        
        return True

    def test_advanced_endpoints(self):
        """Test advanced analysis endpoints"""
        print("\n" + "="*60)
        print("TESTING ADVANCED ANALYSIS ENDPOINTS")
        print("="*60)
        
        # Forecast
        self.run_test("Forecast BTC", "GET", "api/forecast/BTC")
        
        # Fractal Summary
        self.run_test("Fractal Summary", "GET", "api/fractal/summary/BTC")
        
        # Exchange Pressure
        self.run_test("Exchange Pressure", "GET", "api/exchange/pressure?network=ethereum")
        
        # Signals Attribution
        self.run_test("Signals Attribution", "GET", "api/advanced/signals-attribution")
        
        return True

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        
        print(f"📊 Tests run: {self.tests_run}")
        print(f"✅ Tests passed: {self.tests_passed}")
        print(f"❌ Tests failed: {self.tests_run - self.tests_passed}")
        print(f"📈 Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        # Group results by success
        passed = [r for r in self.results if r["success"]]
        failed = [r for r in self.results if not r["success"]]
        
        if passed:
            print(f"\n✅ PASSED TESTS ({len(passed)}):")
            for result in passed:
                print(f"   • {result['name']} - {result['method']} {result['endpoint']}")
        
        if failed:
            print(f"\n❌ FAILED TESTS ({len(failed)}):")
            for result in failed:
                error_info = f" ({result.get('error', 'status error')})" if result.get('error') else f" (got {result['actual_status']})"
                print(f"   • {result['name']} - {result['method']} {result['endpoint']}{error_info}")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test runner"""
    print("TA Engine - Chart Integration Backend Testing")
    print("=" * 60)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    tester = TAEngineAPITester()
    
    # Run all test suites
    try:
        tester.test_core_endpoints()
        tester.test_chart_data_endpoints()
        tester.test_ta_analysis_endpoints()
        tester.test_provider_endpoints()
        tester.test_advanced_endpoints()
        
        # Print final summary
        all_passed = tester.print_summary()
        
        print(f"\nCompleted at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        return 0 if all_passed else 1
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Testing interrupted by user")
        return 1
    except Exception as e:
        print(f"\n\n💥 Testing failed with error: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())