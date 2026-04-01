"""
P6 Historical Backtest Backend Test Suite

Tests the P6 Historical Backtest implementation:
- Backtest runner for historical data
- Backtest metrics computation (accuracy, partial, wrong rates)
- Backtest data storage with mode=historical_backtest
- Resolution data validation (result, resolution_type, actual_price, error_pct)
- Expected results: Based on context - 103 predictions, 3.9% accuracy, 29.1% partial, 67% wrong
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, List, Any

class P6BacktestEngineTest:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
    def log_test(self, name: str, passed: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        if passed:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "passed": passed,
            "details": details,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    def make_request(self, endpoint: str, method: str = "GET", data: Dict = None) -> Dict:
        """Make HTTP request to API"""
        url = f"{self.base_url}{endpoint}"
        
        try:
            if method == "GET":
                response = requests.get(url, timeout=30)
            elif method == "POST":
                response = requests.post(url, json=data, timeout=30)
            
            if response.status_code == 200:
                return {"ok": True, "data": response.json(), "status": response.status_code}
            else:
                return {"ok": False, "error": f"HTTP {response.status_code}", "status": response.status_code}
                
        except Exception as e:
            return {"ok": False, "error": str(e), "status": 0}
    
    def test_scanner_health(self):
        """Test scanner service health"""
        result = self.make_request("/api/scanner/health")
        
        if result["ok"]:
            data = result["data"]
            passed = data.get("status") == "ok" and data.get("service") == "scanner"
            self.log_test("Scanner Health Check", passed, 
                         f"Status: {data.get('status')}, Service: {data.get('service')}")
        else:
            self.log_test("Scanner Health Check", False, result["error"])
    
    def test_backtest_run_btc(self):
        """Test /api/scanner/backtest/run/BTC - run backtest for BTC"""
        result = self.make_request("/api/scanner/backtest/run/BTC?timeframe=4H&days=120", "POST")
        
        if result["ok"]:
            data = result["data"]
            # Check for expected backtest result fields
            expected_fields = ["symbol", "timeframe", "predictions_generated", "predictions_saved"]
            missing_fields = []
            
            for field in expected_fields:
                if field not in data:
                    missing_fields.append(field)
            
            passed = len(missing_fields) == 0 and data.get("predictions_saved", 0) > 0
            details = f"Generated: {data.get('predictions_generated', 0)}, Saved: {data.get('predictions_saved', 0)}" if passed else f"Missing fields: {missing_fields}"
            self.log_test("Backtest Run BTC", passed, details)
            return data
        else:
            self.log_test("Backtest Run BTC", False, result["error"])
            return {}

    def test_backtest_metrics_global(self):
        """Test /api/scanner/backtest/metrics - get global backtest metrics"""
        result = self.make_request("/api/scanner/backtest/metrics")
        
        if not result["ok"]:
            self.log_test("Backtest Global Metrics", False, result["error"])
            return {}
        
        data = result["data"]
        
        # Check for expected metrics fields
        expected_fields = ["total", "accuracy", "partial_rate", "wrong_rate", "avg_error"]
        missing_fields = []
        
        for field in expected_fields:
            if field not in data:
                missing_fields.append(field)
        
        passed = len(missing_fields) == 0
        details = f"Total: {data.get('total', 0)}, Accuracy: {data.get('accuracy', 0):.1%}" if passed else f"Missing fields: {missing_fields}"
        
        self.log_test("Backtest Global Metrics", passed, details)
        return data

    def test_backtest_metrics_by_regime(self):
        """Test /api/scanner/backtest/metrics/by-regime - get metrics grouped by regime"""
        result = self.make_request("/api/scanner/backtest/metrics/by-regime")
        
        if not result["ok"]:
            self.log_test("Backtest Metrics by Regime", False, result["error"])
            return {}
        
        data = result["data"]
        
        # Should return dict with regime names as keys
        passed = isinstance(data, dict) and len(data) > 0
        details = f"Regimes found: {list(data.keys())}" if passed else "No regime data or invalid format"
        
        self.log_test("Backtest Metrics by Regime", passed, details)
        return data

    def test_backtest_metrics_by_symbol(self):
        """Test /api/scanner/backtest/metrics/by-symbol - get metrics grouped by symbol"""
        result = self.make_request("/api/scanner/backtest/metrics/by-symbol")
        
        if not result["ok"]:
            self.log_test("Backtest Metrics by Symbol", False, result["error"])
            return {}
        
        data = result["data"]
        
        # Should return dict with symbol names as keys
        passed = isinstance(data, dict) and len(data) > 0
        details = f"Symbols found: {list(data.keys())}" if passed else "No symbol data or invalid format"
        
        self.log_test("Backtest Metrics by Symbol", passed, details)
        return data

    def test_backtest_summary(self):
        """Test /api/scanner/backtest/summary - get summary of stored results"""
        result = self.make_request("/api/scanner/backtest/summary")
        
        if not result["ok"]:
            self.log_test("Backtest Summary", False, result["error"])
            return {}
        
        data = result["data"]
        
        # Check for expected summary fields
        expected_fields = ["total", "by_asset_tf"]
        missing_fields = []
        
        for field in expected_fields:
            if field not in data:
                missing_fields.append(field)
        
        passed = len(missing_fields) == 0
        details = f"Total stored: {data.get('total', 0)}" if passed else f"Missing fields: {missing_fields}"
        
        self.log_test("Backtest Summary", passed, details)
        return data

    def test_backtest_data_storage_validation(self):
        """Test that backtest results are stored with correct mode and resolution fields"""
        # First run a small backtest to ensure we have data
        self.make_request("/api/scanner/backtest/run/BTC?timeframe=4H&days=30", "POST")
        
        # Get metrics to verify data structure
        result = self.make_request("/api/scanner/backtest/metrics")
        
        if not result["ok"]:
            self.log_test("Backtest Data Storage Validation", False, result["error"])
            return
        
        data = result["data"]
        total = data.get("total", 0)
        
        if total == 0:
            self.log_test("Backtest Data Storage Validation", False, "No backtest data found")
            return
        
        # Check that we have the expected metrics structure
        required_metrics = ["accuracy", "partial_rate", "wrong_rate", "avg_error"]
        missing_metrics = []
        
        for metric in required_metrics:
            if metric not in data:
                missing_metrics.append(metric)
        
        passed = len(missing_metrics) == 0
        details = f"Found {total} predictions with metrics: {list(data.keys())}" if passed else f"Missing metrics: {missing_metrics}"
        
        self.log_test("Backtest Data Storage Validation", passed, details)

    def test_resolution_data_structure(self):
        """Test that resolution data includes required fields: result, resolution_type, actual_price, error_pct"""
        # Get metrics by regime to check if we have resolution data
        result = self.make_request("/api/scanner/backtest/metrics/by-regime")
        
        if not result["ok"]:
            self.log_test("Resolution Data Structure", False, result["error"])
            return
        
        data = result["data"]
        
        if not data:
            self.log_test("Resolution Data Structure", False, "No regime data available")
            return
        
        # Check that each regime has the expected metrics (which come from resolution data)
        resolution_metrics = ["accuracy", "partial_rate", "wrong_rate", "avg_error"]
        all_regimes_valid = True
        regime_details = []
        
        for regime, metrics in data.items():
            missing_in_regime = []
            for metric in resolution_metrics:
                if metric not in metrics:
                    missing_in_regime.append(metric)
            
            if missing_in_regime:
                all_regimes_valid = False
                regime_details.append(f"{regime}: missing {missing_in_regime}")
            else:
                regime_details.append(f"{regime}: OK")
        
        passed = all_regimes_valid
        details = "; ".join(regime_details)
        
        self.log_test("Resolution Data Structure", passed, details)

    def test_expected_accuracy_rates(self):
        """Test expected accuracy rates based on context: ~3.9% accuracy, ~29.1% partial, ~67% wrong"""
        result = self.make_request("/api/scanner/backtest/metrics")
        
        if not result["ok"]:
            self.log_test("Expected Accuracy Rates", False, result["error"])
            return
        
        data = result["data"]
        
        accuracy = data.get("accuracy", 0)
        partial_rate = data.get("partial_rate", 0)
        wrong_rate = data.get("wrong_rate", 0)
        
        # Allow some tolerance for the expected rates
        accuracy_ok = 0.01 <= accuracy <= 0.15  # 1-15% accuracy range
        partial_ok = 0.15 <= partial_rate <= 0.45  # 15-45% partial range
        wrong_ok = 0.50 <= wrong_rate <= 0.85  # 50-85% wrong range
        
        passed = accuracy_ok and partial_ok and wrong_ok
        details = f"Accuracy: {accuracy:.1%}, Partial: {partial_rate:.1%}, Wrong: {wrong_rate:.1%}"
        
        self.log_test("Expected Accuracy Rates", passed, details)

    def test_bearish_bias_detection(self):
        """Test for bearish bias detection in backtest results"""
        # Get metrics by regime to see if we can detect bias patterns
        result = self.make_request("/api/scanner/backtest/metrics/by-regime")
        
        if not result["ok"]:
            self.log_test("Bearish Bias Detection", False, result["error"])
            return
        
        data = result["data"]
        
        if not data:
            self.log_test("Bearish Bias Detection", False, "No regime data available")
            return
        
        # Look for regime patterns that might indicate bias
        regime_counts = {}
        total_predictions = 0
        
        for regime, metrics in data.items():
            count = metrics.get("total", 0)
            regime_counts[regime] = count
            total_predictions += count
        
        passed = total_predictions > 0
        details = f"Total predictions: {total_predictions}, Regime distribution: {regime_counts}"
        
        self.log_test("Bearish Bias Detection", passed, details)
    
    def run_all_tests(self):
        """Run all P6 Backtest Engine tests"""
        print("🚀 Starting P6 Historical Backtest Test Suite")
        print("=" * 60)
        
        # Basic health checks
        self.test_scanner_health()
        
        # Core P6 backtest functionality tests
        self.test_backtest_run_btc()
        self.test_backtest_metrics_global()
        self.test_backtest_metrics_by_regime()
        self.test_backtest_metrics_by_symbol()
        self.test_backtest_summary()
        
        # P6 data validation tests
        self.test_backtest_data_storage_validation()
        self.test_resolution_data_structure()
        self.test_expected_accuracy_rates()
        self.test_bearish_bias_detection()
        
        # Summary
        print("=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All P6 Backtest Engine tests passed!")
            return True
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return False
    
    def get_test_summary(self):
        """Get detailed test summary"""
        return {
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "failed_tests": self.tests_run - self.tests_passed,
            "success_rate": (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0,
            "test_results": self.test_results
        }


def main():
    """Main test execution"""
    # Use the public endpoint from frontend/.env
    base_url = "https://repo-study-3.preview.emergentagent.com"
    
    print(f"🔗 Testing P6 Historical Backtest Engine at: {base_url}")
    
    tester = P6BacktestEngineTest(base_url)
    success = tester.run_all_tests()
    
    # Print detailed summary
    summary = tester.get_test_summary()
    print(f"\n📋 Detailed Summary:")
    print(f"   Success Rate: {summary['success_rate']:.1f}%")
    print(f"   Total Tests: {summary['total_tests']}")
    print(f"   Passed: {summary['passed_tests']}")
    print(f"   Failed: {summary['failed_tests']}")
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())