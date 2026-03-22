import requests
import json

def test_stream():
    url = "http://localhost:8000/ingest_stream"
    payload = {
        "user_id": "test_agent_user",
        "text": "I want to learn to play the electric guitar and master the blues in 6 months."
    }
    
    print(f"Starting stream for: {payload['text']}")
    response = requests.post(url, json=payload, stream=True)
    
    if response.status_code != 200:
        print(f"Error: {response.status_code}")
        print(response.text)
        return

    for line in response.iter_lines():
        if line:
            decoded_line = line.decode('utf-8')
            if decoded_line.startswith("data: "):
                data = json.loads(decoded_line[6:])
                print(f"Received: {data['type']}")
                if data['type'] == 'error':
                    print(f"ERROR: {data.get('message') or data.get('error')}")
                if data['type'] == 'structured':
                    print(f"Structured Focus: {data.get('focus')}")

if __name__ == "__main__":
    test_stream()
