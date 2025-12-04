import requests
import json

API_URL = "http://localhost:8765/api/v1/memories/"
API_KEY = "sk-momemory-wBLPWow-vOKTWPSoEWlId6B39fheh6H5znd_LaWvGSM"

def add_memory_via_api():
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "text": "这个项目的品牌主色调是紫色：RGB的值是：118, 52, 249",
        "app": "openmemory", # Default app
        "infer": True
    }
    
    print(f"Sending request to {API_URL}...")
    try:
        response = requests.post(API_URL, headers=headers, json=payload)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ Memory successfully added via API. It should now appear in the UI.")
        else:
            print("❌ Failed to add memory via API.")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    add_memory_via_api()

