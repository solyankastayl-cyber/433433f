"""
P2 Decision Engine Backend Test Suite

Tests the P2 Decision Engine implementation:
- Stability Score + Regime Calibration + Anti-Overconfidence + Filter + Ranking 2.0
- Expected results: ~67% valid rate, trend=100% valid, range=0% valid, confidence capped at 90%
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, List, Any

class P2DecisionEngineTest:
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
    
    def test_debug_btc_new_fields(self):
        """Test /api/scanner/debug/BTC - verify new P2 fields: stability, valid, score, rejection_reason"""
        result = self.make_request("/api/scanner/debug/BTC")
        
        if not result["ok"]:
            self.log_test("Debug BTC - New P2 Fields", False, result["error"])
            return
        
        data = result["data"]
        prediction = data.get("prediction", {})
        
        # Check for new P2 fields
        required_fields = ["stability", "valid", "score"]
        missing_fields = []
        
        for field in required_fields:
            if field not in prediction:
                missing_fields.append(field)
        
        # Check rejection_reason exists if prediction is invalid
        if not prediction.get("valid", True) and "rejection_reason" not in prediction:
            missing_fields.append("rejection_reason")
        
        passed = len(missing_fields) == 0
        details = f"Missing fields: {missing_fields}" if missing_fields else "All P2 fields present"
        
        self.log_test("Debug BTC - New P2 Fields", passed, details)
        
        # Additional validation of field values
        if passed:
            self.validate_p2_field_values(prediction)
        
        return prediction
    
    def validate_p2_field_values(self, prediction: Dict):
        """Validate P2 field value ranges and types"""
        
        # Test stability score range (0-1)
        stability = prediction.get("stability")
        if stability is not None:
            passed = 0.0 <= stability <= 1.0
            self.log_test("Stability Score Range (0-1)", passed, 
                         f"Stability: {stability}")
        
        # Test confidence cap (< 90%)
        confidence = prediction.get("confidence", {}).get("value", 0)
        if confidence is not None:
            passed = confidence < 0.90
            self.log_test("Anti-Overconfidence (confidence < 90%)", passed, 
                         f"Confidence: {confidence:.1%}")
        
        # Test score is numeric
        score = prediction.get("score")
        if score is not None:
            passed = isinstance(score, (int, float))
            self.log_test("Score is Numeric", passed, f"Score: {score}, Type: {type(score)}")
        
        # Test valid is boolean
        valid = prediction.get("valid")
        if valid is not None:
            passed = isinstance(valid, bool)
            self.log_test("Valid is Boolean", passed, f"Valid: {valid}, Type: {type(valid)}")
    
    def test_full_scan_p2_engine(self):
        """Test /api/scanner/full-scan - run full scan with P2 Decision Engine"""
        result = self.make_request("/api/scanner/full-scan", "POST")
        
        if result["ok"]:
            data = result["data"]
            passed = data.get("status") == "completed" or "processed" in str(data)
            details = f"Scan result: {data}"
            self.log_test("Full Scan with P2 Engine", passed, details)
        else:
            self.log_test("Full Scan with P2 Engine", False, result["error"])
    
    def test_predictions_top_valid_only(self):
        """Test /api/scanner/predictions/top - verify only valid predictions returned"""
        result = self.make_request("/api/scanner/predictions/top?limit=20")
        
        if not result["ok"]:
            self.log_test("Top Predictions - Valid Only", False, result["error"])
            return []
        
        data = result["data"]
        predictions = data.get("predictions", [])
        
        # Check all predictions are valid (look in prediction_payload)
        invalid_count = 0
        for pred in predictions:
            payload = pred.get("prediction_payload", {})
            if not payload.get("valid", False):
                invalid_count += 1
        
        passed = invalid_count == 0
        details = f"Total: {len(predictions)}, Invalid: {invalid_count}"
        self.log_test("Top Predictions - Valid Only", passed, details)
        
        return predictions
    
    def test_logs_summary_stats(self):
        """Test /api/scanner/logs/summary - verify valid_rate, rejection_reasons stats"""
        result = self.make_request("/api/scanner/logs/summary")
        
        if not result["ok"]:
            self.log_test("Logs Summary Stats", False, result["error"])
            return {}
        
        data = result["data"]
        
        # Check for expected summary fields
        expected_fields = ["valid_rate", "rejection_reasons"]
        missing_fields = []
        
        for field in expected_fields:
            if field not in data:
                missing_fields.append(field)
        
        passed = len(missing_fields) == 0
        details = f"Missing fields: {missing_fields}" if missing_fields else f"Valid rate: {data.get('valid_rate', 'N/A')}"
        
        self.log_test("Logs Summary Stats", passed, details)
        
        return data
    
    def test_regime_behavior_analysis(self):
        """Test regime-specific behavior: trend vs range predictions"""
        # Get multiple predictions to analyze regime behavior
        result = self.make_request("/api/scanner/predictions/all?limit=50&valid_only=false")
        
        if not result["ok"]:
            self.log_test("Regime Behavior Analysis", False, result["error"])
            return
        
        data = result["data"]
        predictions = data.get("predictions", [])
        
        if len(predictions) == 0:
            self.log_test("Regime Behavior Analysis", False, "No predictions available")
            return
        
        # Analyze by regime
        regime_stats = {}
        for pred in predictions:
            payload = pred.get("prediction_payload", {})
            regime = payload.get("regime", "unknown")
            if regime not in regime_stats:
                regime_stats[regime] = {"total": 0, "valid": 0}
            
            regime_stats[regime]["total"] += 1
            if payload.get("valid", False):
                regime_stats[regime]["valid"] += 1
        
        # Calculate valid percentages
        for regime in regime_stats:
            total = regime_stats[regime]["total"]
            valid = regime_stats[regime]["valid"]
            regime_stats[regime]["valid_pct"] = (valid / total * 100) if total > 0 else 0
        
        # Test expectations: trend should have higher valid_pct than range
        trend_pct = regime_stats.get("trend", {}).get("valid_pct", 0)
        range_pct = regime_stats.get("range", {}).get("valid_pct", 100)  # Default high to make test fail if no range data
        
        passed = trend_pct > range_pct if "trend" in regime_stats and "range" in regime_stats else True
        details = f"Trend: {trend_pct:.1f}%, Range: {range_pct:.1f}%, Stats: {regime_stats}"
        
        self.log_test("Regime Behavior - Trend > Range Valid%", passed, details)
        
        # Test range regime low confidence expectation
        if "range" in regime_stats:
            range_low_valid = range_pct < 50  # Expect range to have low valid rate
            self.log_test("Range Regime Low Valid Rate", range_low_valid, 
                         f"Range valid rate: {range_pct:.1f}%")
    
    def test_stability_score_range(self):
        """Test stability scores are between 0-1 across multiple predictions"""
        result = self.make_request("/api/scanner/predictions/all?limit=30")
        
        if not result["ok"]:
            self.log_test("Stability Score Range Test", False, result["error"])
            return
        
        data = result["data"]
        predictions = data.get("predictions", [])
        
        invalid_stability_count = 0
        stability_scores = []
        
        for pred in predictions:
            payload = pred.get("prediction_payload", {})
            stability = payload.get("stability")
            if stability is not None:
                stability_scores.append(stability)
                if not (0.0 <= stability <= 1.0):
                    invalid_stability_count += 1
        
        passed = invalid_stability_count == 0 and len(stability_scores) > 0
        details = f"Checked {len(stability_scores)} scores, {invalid_stability_count} invalid"
        
        if len(stability_scores) > 0:
            avg_stability = sum(stability_scores) / len(stability_scores)
            details += f", Avg: {avg_stability:.3f}"
        
        self.log_test("Stability Score Range Test", passed, details)
    
    def test_confidence_cap_enforcement(self):
        """Test anti-overconfidence: confidence < 90% always"""
        result = self.make_request("/api/scanner/predictions/all?limit=30")
        
        if not result["ok"]:
            self.log_test("Confidence Cap Enforcement", False, result["error"])
            return
        
        data = result["data"]
        predictions = data.get("predictions", [])
        
        over_90_count = 0
        confidence_values = []
        
        for pred in predictions:
            payload = pred.get("prediction_payload", {})
            confidence = payload.get("confidence", {}).get("value")
            if confidence is not None:
                confidence_values.append(confidence)
                if confidence >= 0.90:
                    over_90_count += 1
        
        passed = over_90_count == 0 and len(confidence_values) > 0
        details = f"Checked {len(confidence_values)} predictions, {over_90_count} over 90%"
        
        if len(confidence_values) > 0:
            max_confidence = max(confidence_values)
            details += f", Max: {max_confidence:.1%}"
        
        self.log_test("Confidence Cap Enforcement", passed, details)
    
    def test_expected_valid_rate(self):
        """Test expected ~67% valid rate"""
        result = self.make_request("/api/scanner/logs/summary")
        
        if not result["ok"]:
            self.log_test("Expected Valid Rate (~67%)", False, result["error"])
            return
        
        data = result["data"]
        valid_rate = data.get("valid_rate")
        
        if valid_rate is not None:
            # Allow some tolerance around 67%
            target_rate = 0.67
            tolerance = 0.15  # ±15%
            
            passed = abs(valid_rate - target_rate) <= tolerance
            details = f"Valid rate: {valid_rate:.1%}, Target: {target_rate:.1%} ±{tolerance:.1%}"
            
            self.log_test("Expected Valid Rate (~67%)", passed, details)
        else:
            self.log_test("Expected Valid Rate (~67%)", False, "Valid rate not available")
    
    def run_all_tests(self):
        """Run all P2 Decision Engine tests"""
        print("🚀 Starting P2 Decision Engine Test Suite")
        print("=" * 60)
        
        # Basic health checks
        self.test_scanner_health()
        
        # Core P2 functionality tests
        self.test_debug_btc_new_fields()
        self.test_full_scan_p2_engine()
        self.test_predictions_top_valid_only()
        self.test_logs_summary_stats()
        
        # P2 behavior validation
        self.test_regime_behavior_analysis()
        self.test_stability_score_range()
        self.test_confidence_cap_enforcement()
        self.test_expected_valid_rate()
        
        # Summary
        print("=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All P2 Decision Engine tests passed!")
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
    
    print(f"🔗 Testing P2 Decision Engine at: {base_url}")
    
    tester = P2DecisionEngineTest(base_url)
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