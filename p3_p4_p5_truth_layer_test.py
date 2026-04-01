"""
P3/P4/P5 Truth Layer Backend Test Suite

Tests the P3/P4/P5 Truth Layer implementation:
- P3: Outcome Tracking & Real Calibration
- P4: Calibration Engine V2
- P5: Anti-Drift Stability Engine

Expected behavior: Since no real time has passed, outcome resolution will show 'still_pending'.
API endpoints for metrics/calibration/stability exist but return empty until outcomes are resolved.
"""

import requests
import sys
import json
import time
from datetime import datetime
from typing import Dict, List, Any, Optional

class P3P4P5TruthLayerTest:
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
                return {"ok": False, "error": f"HTTP {response.status_code}", "status": response.status_code, "response_text": response.text}
                
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
    
    def test_full_scan_p3_fields(self):
        """Test /api/scanner/full-scan - verify predictions have regime, model, status=pending, resolution=null"""
        print("\n🔍 Testing P3 Full Scan - Prediction Structure...")
        
        # First trigger a full scan
        result = self.make_request("/api/scanner/full-scan", "POST")
        
        if not result["ok"]:
            self.log_test("Full Scan - P3 Structure", False, f"Full scan failed: {result['error']}")
            return
        
        # Wait a moment for scan to complete
        time.sleep(2)
        
        # Get predictions to verify structure
        pred_result = self.make_request("/api/scanner/predictions/all?limit=10")
        
        if not pred_result["ok"]:
            self.log_test("Full Scan - P3 Structure", False, f"Failed to get predictions: {pred_result['error']}")
            return
        
        data = pred_result["data"]
        predictions = data.get("predictions", [])
        
        if len(predictions) == 0:
            self.log_test("Full Scan - P3 Structure", False, "No predictions found after full scan")
            return
        
        # Check P3 fields in predictions
        missing_fields = []
        p3_fields_found = {"regime": 0, "model": 0, "status": 0, "resolution": 0}
        
        for pred in predictions:
            # Check top-level fields
            if "regime" in pred:
                p3_fields_found["regime"] += 1
            if "model" in pred:
                p3_fields_found["model"] += 1
            if "status" in pred:
                p3_fields_found["status"] += 1
                # Verify status is pending
                if pred["status"] != "pending":
                    missing_fields.append(f"status not pending: {pred['status']}")
            if "resolution" in pred:
                p3_fields_found["resolution"] += 1
                # Verify resolution is null
                if pred["resolution"] is not None:
                    missing_fields.append(f"resolution not null: {pred['resolution']}")
        
        # Check if most predictions have required fields
        total_preds = len(predictions)
        required_coverage = 0.8  # 80% of predictions should have these fields
        
        for field, count in p3_fields_found.items():
            coverage = count / total_preds if total_preds > 0 else 0
            if coverage < required_coverage:
                missing_fields.append(f"{field} coverage: {coverage:.1%} < {required_coverage:.1%}")
        
        passed = len(missing_fields) == 0
        details = f"Checked {total_preds} predictions. " + (f"Issues: {missing_fields}" if missing_fields else "All P3 fields present")
        
        self.log_test("Full Scan - P3 Structure", passed, details)
        
        return predictions
    
    def test_predictions_all_p3_p4_p5_fields(self):
        """Test /api/scanner/predictions/all - verify prediction structure has all P3/P4/P5 fields"""
        print("\n🔍 Testing P3/P4/P5 Prediction Fields...")
        
        result = self.make_request("/api/scanner/predictions/all?limit=20")
        
        if not result["ok"]:
            self.log_test("Predictions All - P3/P4/P5 Fields", False, result["error"])
            return
        
        data = result["data"]
        predictions = data.get("predictions", [])
        
        if len(predictions) == 0:
            self.log_test("Predictions All - P3/P4/P5 Fields", False, "No predictions available")
            return
        
        # Check for P3/P4/P5 fields
        p3_fields = ["regime", "model", "status", "resolution", "created_at"]
        p4_fields = ["prediction_payload"]  # Contains calibration-related data
        p5_fields = ["latest"]  # Stability tracking field
        
        all_fields = p3_fields + p4_fields + p5_fields
        field_coverage = {field: 0 for field in all_fields}
        
        for pred in predictions:
            for field in all_fields:
                if field in pred:
                    field_coverage[field] += 1
        
        # Calculate coverage percentages
        total_preds = len(predictions)
        missing_fields = []
        
        for field, count in field_coverage.items():
            coverage = count / total_preds if total_preds > 0 else 0
            if coverage < 0.8:  # Expect 80% coverage
                missing_fields.append(f"{field}: {coverage:.1%}")
        
        passed = len(missing_fields) == 0
        details = f"Checked {total_preds} predictions. " + (f"Low coverage: {missing_fields}" if missing_fields else "All P3/P4/P5 fields present")
        
        self.log_test("Predictions All - P3/P4/P5 Fields", passed, details)
        
        return predictions
    
    def test_metrics_no_outcomes_yet(self):
        """Test /api/scanner/metrics - should return no_metrics_yet (no outcomes yet)"""
        print("\n🔍 Testing P3 Metrics - No Outcomes Yet...")
        
        result = self.make_request("/api/scanner/metrics")
        
        if not result["ok"]:
            self.log_test("Metrics - No Outcomes Yet", False, result["error"])
            return
        
        data = result["data"]
        
        # Should return no_metrics_yet or empty metrics since no outcomes resolved yet
        expected_responses = [
            data.get("status") == "no_metrics_yet",
            "no_metrics_yet" in str(data),
            data.get("global", {}).get("total", 0) == 0,
            len(data) == 0 or (len(data) == 1 and "status" in data)
        ]
        
        passed = any(expected_responses)
        details = f"Response: {data}"
        
        self.log_test("Metrics - No Outcomes Yet", passed, details)
        
        return data
    
    def test_calibration_status_empty(self):
        """Test /api/scanner/calibration/status - should return empty (no outcomes yet)"""
        print("\n🔍 Testing P4 Calibration Status - Empty...")
        
        result = self.make_request("/api/scanner/calibration/status")
        
        if not result["ok"]:
            self.log_test("Calibration Status - Empty", False, result["error"])
            return
        
        data = result["data"]
        
        # Should return empty dict or minimal data since no outcomes resolved yet
        expected_empty = [
            len(data) == 0,
            data == {},
            all(not v for v in data.values()) if isinstance(data, dict) else False
        ]
        
        passed = any(expected_empty)
        details = f"Response: {data}"
        
        self.log_test("Calibration Status - Empty", passed, details)
        
        return data
    
    def test_stability_status_empty(self):
        """Test /api/scanner/stability/status - should return empty (no outcomes yet)"""
        print("\n🔍 Testing P5 Stability Status - Empty...")
        
        result = self.make_request("/api/scanner/stability/status")
        
        if not result["ok"]:
            self.log_test("Stability Status - Empty", False, result["error"])
            return
        
        data = result["data"]
        
        # Should return empty dict or minimal data since no outcomes resolved yet
        expected_empty = [
            len(data) == 0,
            data == {},
            all(not v for v in data.values()) if isinstance(data, dict) else False
        ]
        
        passed = any(expected_empty)
        details = f"Response: {data}"
        
        self.log_test("Stability Status - Empty", passed, details)
        
        return data
    
    def test_outcome_resolution_worker(self):
        """Test /api/scanner/outcomes/resolve - test outcome resolution worker"""
        print("\n🔍 Testing P3 Outcome Resolution Worker...")
        
        result = self.make_request("/api/scanner/outcomes/resolve", "POST")
        
        if not result["ok"]:
            self.log_test("Outcome Resolution Worker", False, result["error"])
            return
        
        data = result["data"]
        
        # Should return status and stats
        expected_fields = ["status", "stats"]
        has_required_fields = all(field in data for field in expected_fields)
        
        # Status should be complete
        status_ok = data.get("status") == "complete"
        
        passed = has_required_fields and status_ok
        details = f"Status: {data.get('status')}, Stats: {data.get('stats')}"
        
        self.log_test("Outcome Resolution Worker", passed, details)
        
        return data
    
    def test_calibration_recalibrate(self):
        """Test /api/scanner/calibration/recalibrate - test recalibration"""
        print("\n🔍 Testing P4 Calibration Recalibrate...")
        
        result = self.make_request("/api/scanner/calibration/recalibrate", "POST")
        
        if not result["ok"]:
            self.log_test("Calibration Recalibrate", False, result["error"])
            return
        
        data = result["data"]
        
        # Should return status and calibration data
        expected_fields = ["status", "regime_weights", "model_weights"]
        has_required_fields = all(field in data for field in expected_fields)
        
        # Status should be recalibrated
        status_ok = data.get("status") == "recalibrated"
        
        passed = has_required_fields and status_ok
        details = f"Status: {data.get('status')}, Regime weights: {len(data.get('regime_weights', {}))}, Model weights: {len(data.get('model_weights', {}))}"
        
        self.log_test("Calibration Recalibrate", passed, details)
        
        return data
    
    def test_stability_rebuild(self):
        """Test /api/scanner/stability/rebuild - test stability rebuild"""
        print("\n🔍 Testing P5 Stability Rebuild...")
        
        result = self.make_request("/api/scanner/stability/rebuild", "POST")
        
        if not result["ok"]:
            self.log_test("Stability Rebuild", False, result["error"])
            return
        
        data = result["data"]
        
        # Should return status and stability data
        expected_fields = ["status", "model_health", "calibration_guard"]
        has_required_fields = all(field in data for field in expected_fields)
        
        # Status should be rebuilt
        status_ok = data.get("status") == "rebuilt"
        
        passed = has_required_fields and status_ok
        details = f"Status: {data.get('status')}, Model health: {len(data.get('model_health', {}))}, Calibration guard: {data.get('calibration_guard', {})}"
        
        self.log_test("Stability Rebuild", passed, details)
        
        return data
    
    def test_metrics_compute_snapshot(self):
        """Test /api/scanner/metrics/compute - compute metrics snapshot"""
        print("\n🔍 Testing P3 Metrics Compute Snapshot...")
        
        result = self.make_request("/api/scanner/metrics/compute", "POST")
        
        if not result["ok"]:
            self.log_test("Metrics Compute Snapshot", False, result["error"])
            return
        
        data = result["data"]
        
        # Should return status and global metrics
        expected_fields = ["status", "global"]
        has_required_fields = all(field in data for field in expected_fields)
        
        # Status should be computed
        status_ok = data.get("status") == "computed"
        
        passed = has_required_fields and status_ok
        details = f"Status: {data.get('status')}, Global metrics: {data.get('global', {})}"
        
        self.log_test("Metrics Compute Snapshot", passed, details)
        
        return data
    
    def test_integration_workflow(self):
        """Test complete P3/P4/P5 integration workflow"""
        print("\n🔍 Testing P3/P4/P5 Integration Workflow...")
        
        workflow_steps = []
        
        # Step 1: Run outcome resolution
        print("  Step 1: Running outcome resolution...")
        outcome_result = self.test_outcome_resolution_worker()
        workflow_steps.append(("outcome_resolution", outcome_result is not None))
        
        # Step 2: Compute metrics
        print("  Step 2: Computing metrics...")
        metrics_result = self.test_metrics_compute_snapshot()
        workflow_steps.append(("metrics_compute", metrics_result is not None))
        
        # Step 3: Recalibrate
        print("  Step 3: Recalibrating...")
        calibration_result = self.test_calibration_recalibrate()
        workflow_steps.append(("calibration", calibration_result is not None))
        
        # Step 4: Rebuild stability
        print("  Step 4: Rebuilding stability...")
        stability_result = self.test_stability_rebuild()
        workflow_steps.append(("stability", stability_result is not None))
        
        # Check workflow success
        successful_steps = sum(1 for _, success in workflow_steps if success)
        total_steps = len(workflow_steps)
        
        passed = successful_steps == total_steps
        details = f"Completed {successful_steps}/{total_steps} workflow steps: {workflow_steps}"
        
        self.log_test("P3/P4/P5 Integration Workflow", passed, details)
    
    def run_all_tests(self):
        """Run all P3/P4/P5 Truth Layer tests"""
        print("🚀 Starting P3/P4/P5 Truth Layer Test Suite")
        print("=" * 70)
        
        # Basic health check
        self.test_scanner_health()
        
        # P3: Outcome Tracking tests
        print("\n📊 P3: OUTCOME TRACKING & METRICS")
        print("-" * 40)
        self.test_full_scan_p3_fields()
        self.test_predictions_all_p3_p4_p5_fields()
        self.test_metrics_no_outcomes_yet()
        self.test_outcome_resolution_worker()
        self.test_metrics_compute_snapshot()
        
        # P4: Calibration tests
        print("\n⚖️  P4: CALIBRATION ENGINE")
        print("-" * 40)
        self.test_calibration_status_empty()
        self.test_calibration_recalibrate()
        
        # P5: Stability tests
        print("\n🛡️  P5: STABILITY & ANTI-DRIFT")
        print("-" * 40)
        self.test_stability_status_empty()
        self.test_stability_rebuild()
        
        # Integration workflow test
        print("\n🔄 INTEGRATION WORKFLOW")
        print("-" * 40)
        self.test_integration_workflow()
        
        # Summary
        print("=" * 70)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All P3/P4/P5 Truth Layer tests passed!")
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
    
    print(f"🔗 Testing P3/P4/P5 Truth Layer at: {base_url}")
    
    tester = P3P4P5TruthLayerTest(base_url)
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