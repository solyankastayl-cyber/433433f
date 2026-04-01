#!/usr/bin/env python3
"""
Scanner Engine Backend API Testing
==================================

Tests all Scanner Engine endpoints for P0 implementation:
1. /api/scanner/health - scanner service health check
2. /api/scanner/assets - list active assets
3. /api/scanner/assets/seed - seed top 50 crypto assets
4. /api/scanner/debug/{symbol} - test real TA + Prediction for single asset
5. /api/scanner/full-scan - run full scan with real TA/Prediction
6. /api/scanner/predictions/top - get top ranked publishable predictions
7. /api/scanner/logs/summary - check logging and verify directions aren't always same

Key verification points:
- Pattern types are varied (not all same pattern)
- Direction changes when pattern changes
- Not all predictions are bullish/bearish
- Confidence varies
"""

import requests
import sys
import time
from datetime import datetime
from typing import Dict, Any, List

class ScannerAPITester:
    def __init__(self, base_url="https://repo-study-3.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def run_test(self, name, test_func, expected_status=200):
        """Run a single API test"""
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            success, response_data = test_func()
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - {name}")
                self.test_results.append({"test": name, "status": "PASSED", "data": response_data})
                return True, response_data
            else:
                print(f"❌ Failed - {name}")
                self.test_results.append({"test": name, "status": "FAILED", "data": response_data})
                return False, response_data
        except Exception as e:
            print(f"❌ Failed - {name}: {str(e)}")
            self.test_results.append({"test": name, "status": "ERROR", "error": str(e)})
            return False, {}

    def test_scanner_health(self):
        """Test scanner health endpoint"""
        try:
            response = requests.get(f"{self.base_url}/api/scanner/health", timeout=10)
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"   Health status: {data.get('status', 'unknown')}")
                print(f"   Service: {data.get('service', 'unknown')}")
                print(f"   Timestamp: {data.get('timestamp', 'unknown')}")
                return True, data
            else:
                print(f"   Error response: {response.text}")
                return False, {"error": response.text}
        except Exception as e:
            print(f"   Error: {e}")
            return False, {"error": str(e)}

    def test_get_assets(self):
        """Test get assets endpoint"""
        try:
            response = requests.get(f"{self.base_url}/api/scanner/assets?limit=10", timeout=10)
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                count = data.get('count', 0)
                assets = data.get('assets', [])
                print(f"   Assets count: {count}")
                if assets:
                    print(f"   Sample asset: {assets[0] if assets else 'None'}")
                return True, data
            else:
                print(f"   Error response: {response.text}")
                return False, {"error": response.text}
        except Exception as e:
            print(f"   Error: {e}")
            return False, {"error": str(e)}

    def test_seed_assets(self):
        """Test seed assets endpoint"""
        try:
            response = requests.post(f"{self.base_url}/api/scanner/assets/seed", timeout=15)
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"   Seed status: {data.get('status', 'unknown')}")
                print(f"   Assets seeded: {data.get('count', 0)}")
                return True, data
            else:
                print(f"   Error response: {response.text}")
                return False, {"error": response.text}
        except Exception as e:
            print(f"   Error: {e}")
            return False, {"error": str(e)}

    def test_debug_single_asset(self, symbol="BTC"):
        """Test debug single asset endpoint with real TA + Prediction"""
        try:
            response = requests.get(f"{self.base_url}/api/scanner/debug/{symbol}?timeframe=4H", timeout=30)
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"   Symbol: {data.get('symbol', 'unknown')}")
                print(f"   Timeframe: {data.get('timeframe', 'unknown')}")
                
                # Check TA summary
                ta_summary = data.get('ta_summary', {})
                print(f"   Pattern: {ta_summary.get('pattern', 'unknown')}")
                print(f"   Structure: {ta_summary.get('structure', 'unknown')}")
                print(f"   Price: {ta_summary.get('price', 'unknown')}")
                print(f"   TA Source: {ta_summary.get('ta_source', 'unknown')}")
                print(f"   TA Regime: {ta_summary.get('ta_regime', 'unknown')}")
                
                # Check prediction
                prediction = data.get('prediction', {})
                direction = prediction.get('direction', {})
                confidence = prediction.get('confidence', {})
                print(f"   Prediction Direction: {direction.get('label', 'unknown')} (score: {direction.get('score', 0)})")
                print(f"   Confidence: {confidence.get('label', 'unknown')} ({confidence.get('value', 0)})")
                
                return True, data
            else:
                print(f"   Error response: {response.text}")
                return False, {"error": response.text}
        except Exception as e:
            print(f"   Error: {e}")
            return False, {"error": str(e)}

    def test_full_scan(self):
        """Test full scan endpoint"""
        try:
            # Use smaller asset limit for testing
            response = requests.post(f"{self.base_url}/api/scanner/full-scan?asset_limit=5", timeout=60)
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"   Scan result: {data}")
                return True, data
            else:
                print(f"   Error response: {response.text}")
                return False, {"error": response.text}
        except Exception as e:
            print(f"   Error: {e}")
            return False, {"error": str(e)}

    def test_top_predictions(self):
        """Test top predictions endpoint"""
        try:
            response = requests.get(f"{self.base_url}/api/scanner/predictions/top?limit=10", timeout=15)
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                count = data.get('count', 0)
                predictions = data.get('predictions', [])
                print(f"   Predictions count: {count}")
                
                if predictions:
                    # Analyze prediction diversity - predictions are nested in prediction_payload
                    directions = [p.get('prediction_payload', {}).get('direction', {}).get('label', 'unknown') for p in predictions]
                    patterns = [p.get('prediction_payload', {}).get('_ta_pattern', 'unknown') for p in predictions]
                    confidences = [p.get('prediction_payload', {}).get('confidence', {}).get('value', 0) for p in predictions]
                    
                    print(f"   Directions: {set(directions)}")
                    print(f"   Patterns: {set(patterns)}")
                    print(f"   Confidence range: {min(confidences):.2f} - {max(confidences):.2f}")
                    
                    # Check for diversity (P0 requirement)
                    direction_diversity = len(set(directions)) > 1
                    pattern_diversity = len(set(patterns)) > 1
                    confidence_diversity = max(confidences) - min(confidences) > 0.1
                    
                    print(f"   Direction diversity: {'✅' if direction_diversity else '❌'}")
                    print(f"   Pattern diversity: {'✅' if pattern_diversity else '❌'}")
                    print(f"   Confidence diversity: {'✅' if confidence_diversity else '❌'}")
                
                return True, data
            else:
                print(f"   Error response: {response.text}")
                return False, {"error": response.text}
        except Exception as e:
            print(f"   Error: {e}")
            return False, {"error": str(e)}

    def test_logs_summary(self):
        """Test logs summary endpoint - verify logging is working and directions vary"""
        try:
            response = requests.get(f"{self.base_url}/api/scanner/logs/summary", timeout=10)
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                total_scans = data.get('total_scans', 0)
                print(f"   Total scans: {total_scans}")
                
                if total_scans > 0:
                    direction_dist = data.get('direction_distribution', {})
                    pattern_dist = data.get('pattern_distribution', {})
                    avg_confidence = data.get('avg_confidence', 0)
                    
                    print(f"   Direction distribution: {direction_dist}")
                    print(f"   Pattern distribution: {pattern_dist}")
                    print(f"   Average confidence: {avg_confidence}")
                    
                    # Check for bias issues (P0 requirement)
                    always_bullish = data.get('always_bullish', False)
                    always_bearish = data.get('always_bearish', False)
                    
                    print(f"   Always bullish: {'❌' if always_bullish else '✅'}")
                    print(f"   Always bearish: {'❌' if always_bearish else '✅'}")
                    
                    if always_bullish or always_bearish:
                        print("   ⚠️  WARNING: Predictions show bias - all same direction!")
                
                return True, data
            else:
                print(f"   Error response: {response.text}")
                return False, {"error": response.text}
        except Exception as e:
            print(f"   Error: {e}")
            return False, {"error": str(e)}

    def test_recent_logs(self):
        """Test recent logs endpoint"""
        try:
            response = requests.get(f"{self.base_url}/api/scanner/logs/recent?limit=5", timeout=10)
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                count = data.get('count', 0)
                logs = data.get('logs', [])
                print(f"   Recent logs count: {count}")
                
                if logs:
                    print(f"   Sample log: {logs[0] if logs else 'None'}")
                
                return True, data
            else:
                print(f"   Error response: {response.text}")
                return False, {"error": response.text}
        except Exception as e:
            print(f"   Error: {e}")
            return False, {"error": str(e)}

    def analyze_prediction_diversity(self):
        """Analyze overall prediction diversity from test results"""
        print(f"\n📊 Analyzing Prediction Diversity...")
        
        # Get data from previous tests
        top_predictions_result = None
        logs_summary_result = None
        
        for result in self.test_results:
            if result["test"] == "Top Predictions" and result["status"] == "PASSED":
                top_predictions_result = result["data"]
            elif result["test"] == "Logs Summary" and result["status"] == "PASSED":
                logs_summary_result = result["data"]
        
        diversity_issues = []
        
        # Check top predictions diversity
        if top_predictions_result:
            predictions = top_predictions_result.get('predictions', [])
            if predictions:
                directions = [p.get('prediction_payload', {}).get('direction', {}).get('label', 'unknown') for p in predictions]
                patterns = [p.get('prediction_payload', {}).get('_ta_pattern', 'unknown') for p in predictions]
                
                if len(set(directions)) <= 1:
                    diversity_issues.append("All predictions have same direction")
                if len(set(patterns)) <= 1:
                    diversity_issues.append("All predictions have same pattern")
        
        # Check logs summary for bias
        if logs_summary_result:
            if logs_summary_result.get('always_bullish', False):
                diversity_issues.append("Historical logs show always bullish bias")
            if logs_summary_result.get('always_bearish', False):
                diversity_issues.append("Historical logs show always bearish bias")
        
        if diversity_issues:
            print(f"   ⚠️  Diversity Issues Found:")
            for issue in diversity_issues:
                print(f"      - {issue}")
            return False
        else:
            print(f"   ✅ Prediction diversity looks good")
            return True

def main():
    print("=" * 70)
    print("Scanner Engine Backend API Testing - P0 Implementation")
    print("=" * 70)
    
    tester = ScannerAPITester()
    
    # Run tests in logical order
    tests = [
        ("Scanner Health", tester.test_scanner_health),
        ("Get Assets", tester.test_get_assets),
        ("Seed Assets", tester.test_seed_assets),
        ("Debug Single Asset (BTC)", lambda: tester.test_debug_single_asset("BTC")),
        ("Debug Single Asset (ETH)", lambda: tester.test_debug_single_asset("ETH")),
        ("Recent Logs", tester.test_recent_logs),
        ("Full Scan", tester.test_full_scan),
        ("Top Predictions", tester.test_top_predictions),
        ("Logs Summary", tester.test_logs_summary),
    ]
    
    for test_name, test_func in tests:
        success, data = tester.run_test(test_name, test_func)
        # Add small delay between tests to avoid overwhelming the server
        time.sleep(1)
    
    # Analyze prediction diversity
    diversity_ok = tester.analyze_prediction_diversity()
    
    # Print final results
    print(f"\n📊 Scanner Backend Tests Summary:")
    print(f"   Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print(f"   Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    print(f"   Prediction diversity: {'✅' if diversity_ok else '❌'}")
    
    if tester.tests_passed == tester.tests_run and diversity_ok:
        print("🎉 All scanner backend tests passed!")
        return 0
    else:
        print("⚠️  Some scanner backend tests failed or diversity issues found")
        return 1

if __name__ == "__main__":
    sys.exit(main())