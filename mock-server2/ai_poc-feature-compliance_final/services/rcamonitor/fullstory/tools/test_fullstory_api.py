import requests
import base64

# API Key 설정

API_KEY="na1.by0yNDBEQUQtbmExL2ZhYnJpbi5jYWJyZXJhQGxnZS5jb206r6wC7HaFm89UFPL5rNyfCeq6fzeprI2o0xYeL1Rxt5ku/JAZMJZ5"

# Base64 인코딩 (Fullstory는 Basic Auth 방식 사용)
encoded_key = base64.b64encode(f"{API_KEY}:".encode()).decode()

# Headers 설정
headers = {
    "Authorization": f"Basic {encoded_key}",
    "Content-Type": "application/json"
}

# 1. 간단한 이벤트 생성 테스트 (Standard key로도 가능)
def test_create_event():
    url = "https://api.fullstory.com/v2/events"
    
    payload = {
        "user": {
            "uid": "test-user-123"
        },
        "name": "Test Event",
        "properties": {
            "test_property": "test_value"
        },
        "timestamp": "2025-01-29T12:00:00Z"
    }
    
    response = requests.post(url, json=payload, headers=headers)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
    return response

# 2. Audit Trails 테스트 - Blocking 설정 조회 (Standard key로도 가능)
def test_get_blocking_settings():
    url = "https://api.fullstory.com/settings/recording/v1/blocking"
    
    response = requests.get(url, headers=headers)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
    return response

# 실행
if __name__ == "__main__":
    print("=== Fullstory API Test ===\n")
    
    print("Test 1: Blocking Settings 조회")
    test_get_blocking_settings()
    
    print("\n" + "="*50 + "\n")
    
    print("Test 2: Event 생성")
    test_create_event()