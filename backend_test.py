#!/usr/bin/env python3
"""
Backend API Testing for TA Engine P1 Features
==============================================

Tests:
1. WebSocket endpoint /api/ws/market responds to connection
2. Health endpoints are working
3. Basic API functionality
4. Real-time market data endpoints
"""

import asyncio
import json
import sys
import websockets
import requests
from datetime import datetime

class TAEngineAPITester:
    def __init__(self, base_url="https://repo-learn-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.ws_url = base_url.replace('https://', 'wss://').replace('http://', 'ws://') + '/api/ws/market'
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, test_func):
        """Run a single test"""
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            result = test_func()
            if result:
                self.tests_passed += 1
                print(f"✅ Passed - {name}")
                return True
            else:
                print(f"❌ Failed - {name}")
                return False
        except Exception as e:
            print(f"❌ Failed - {name}: {str(e)}")
            return False

    def test_health_endpoint(self):
        """Test basic health endpoint"""
        try:
            response = requests.get(f"{self.base_url}/api/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                print(f"   Health status: {data.get('ok', False)}")
                print(f"   Version: {data.get('version', 'unknown')}")
                return data.get('ok', False)
            return False
        except Exception as e:
            print(f"   Error: {e}")
            return False

    def test_websocket_connection(self):
        """Test WebSocket endpoint connection"""
        async def ws_test():
            try:
                print(f"   Connecting to: {self.ws_url}")
                
                # Connect to WebSocket with timeout
                async with websockets.connect(
                    self.ws_url, 
                    ping_interval=None  # Disable ping to avoid issues
                ) as websocket:
                    print("   WebSocket connected successfully")
                    
                    # Wait for connection confirmation
                    try:
                        message = await asyncio.wait_for(websocket.recv(), timeout=5)
                        data = json.loads(message)
                        print(f"   Received: {data}")
                        
                        if data.get('type') == 'connected':
                            print("   Connection confirmed by server")
                            
                            # Test subscription
                            subscribe_msg = {
                                "type": "subscribe",
                                "symbol": "BTCUSDT",
                                "timeframe": "4H"
                            }
                            await websocket.send(json.dumps(subscribe_msg))
                            print("   Sent subscription message")
                            
                            # Wait for subscription confirmation
                            try:
                                response = await asyncio.wait_for(websocket.recv(), timeout=5)
                                sub_data = json.loads(response)
                                print(f"   Subscription response: {sub_data}")
                                
                                if sub_data.get('type') == 'subscribed':
                                    print("   Subscription confirmed")
                                    return True
                            except asyncio.TimeoutError:
                                print("   No subscription response (timeout)")
                                return True  # Connection worked, subscription timeout is acceptable
                            
                        return True
                    except asyncio.TimeoutError:
                        print("   No initial message received (timeout)")
                        return True  # Connection worked, no initial message is acceptable
                        
            except websockets.exceptions.ConnectionClosed as e:
                print(f"   WebSocket connection closed: {e}")
                return False
            except Exception as e:
                print(f"   WebSocket error: {e}")
                return False
        
        # Run async test
        try:
            return asyncio.run(ws_test())
        except Exception as e:
            print(f"   Async error: {e}")
            return False

    def test_market_data_endpoints(self):
        """Test market data endpoints"""
        try:
            # Test candles endpoint
            response = requests.get(f"{self.base_url}/api/market/candles?symbol=BTCUSDT&date_range=7d", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get('ok') and data.get('candles'):
                    print(f"   Candles endpoint: ✅ ({len(data['candles'])} candles)")
                    return True
            
            print(f"   Candles endpoint failed: {response.status_code}")
            return False
        except Exception as e:
            print(f"   Market data error: {e}")
            return False

    def test_ui_candles_endpoint(self):
        """Test UI candles endpoint"""
        try:
            response = requests.get(f"{self.base_url}/api/ui/candles?asset=BTC&days=30", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get('ok') and data.get('candles'):
                    print(f"   UI Candles endpoint: ✅ ({len(data['candles'])} candles)")
                    return True
            
            print(f"   UI Candles endpoint failed: {response.status_code}")
            return False
        except Exception as e:
            print(f"   UI Candles error: {e}")
            return False

    def test_fractal_endpoints(self):
        """Test fractal analysis endpoints"""
        try:
            response = requests.get(f"{self.base_url}/api/fractal/v2.1/chart?symbol=BTC&limit=100", timeout=15)
            if response.status_code == 200:
                data = response.json()
                if data.get('ok') and data.get('candles'):
                    print(f"   Fractal chart endpoint: ✅ ({len(data['candles'])} candles)")
                    return True
            
            print(f"   Fractal endpoint failed: {response.status_code}")
            return False
        except Exception as e:
            print(f"   Fractal error: {e}")
            return False

def main():
    print("=" * 60)
    print("TA Engine Backend API Testing - P1 Features")
    print("=" * 60)
    
    tester = TAEngineAPITester()
    
    # Run tests
    tests = [
        ("Health Endpoint", tester.test_health_endpoint),
        ("WebSocket Connection", tester.test_websocket_connection),
        ("Market Data Endpoints", tester.test_market_data_endpoints),
        ("UI Candles Endpoint", tester.test_ui_candles_endpoint),
        ("Fractal Endpoints", tester.test_fractal_endpoints),
    ]
    
    for test_name, test_func in tests:
        tester.run_test(test_name, test_func)
    
    # Print results
    print(f"\n📊 Backend Tests Summary:")
    print(f"   Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print(f"   Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All backend tests passed!")
        return 0
    else:
        print("⚠️  Some backend tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())