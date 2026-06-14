import asyncio
import httpx
import uuid
import sys
import json
import time

BASE_URL = "http://localhost:8000/api/v1"

async def run_e2e():
    async with httpx.AsyncClient(timeout=45.0) as client:
        # 1. Register a test user
        uid = uuid.uuid4().hex[:8]
        email = f"e2e_{uid}@company.com"
        password = "SecurePassword_123"
        print(f"Registering user {email}...")
        
        reg_payload = {
            "email": email,
            "password": password,
            "full_name": "E2E Test User",
            "organization_name": f"E2E Testing Org {uid}"
        }
        
        res = await client.post(f"{BASE_URL}/auth/register", json=reg_payload)
        if res.status_code != 201:
            print(f"Registration failed: {res.status_code} {res.text}")
            return
            
        auth_data = res.json()
        token = auth_data["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("Registration successful! Token obtained.")

        # 2. Create a knowledge base
        print("Creating a new knowledge base...")
        kb_payload = {
            "name": f"E2E Test KB {uid}",
            "description": "Created during E2E integration test run"
        }
        res = await client.post(f"{BASE_URL}/kb", json=kb_payload, headers=headers)
        if res.status_code != 201:
            print(f"Failed to create KB: {res.status_code} {res.text}")
            return
        kb_id = res.json()["id"]
        print(f"Created KB with ID: {kb_id}")

        # 3. Create and upload a document containing a unique secret
        secret_code = f"SECRET-CODE-{uuid.uuid4().hex[:6].upper()}"
        document_text = f"VerbaFlow AI automated testing logs. The secret validation code for this session is '{secret_code}'."
        print(f"Uploading document with secret code: '{secret_code}'...")
        
        files = {
            "file": (
                "secret_validation_doc.txt",
                document_text.encode("utf-8"),
                "text/plain"
            )
        }
        
        res = await client.post(f"{BASE_URL}/kb/{kb_id}/documents", files=files, headers=headers)
        if res.status_code != 201:
            print(f"Document upload failed: {res.status_code} {res.text}")
            return
            
        doc_data = res.json()
        doc_id = doc_data["id"]
        print(f"Document uploaded successfully! ID: {doc_id}. Starting polling for status READY...")

        # 4. Poll document status
        start_time = time.time()
        is_ready = False
        while time.time() - start_time < 60:  # 60 second timeout for ingestion
            res = await client.get(f"{BASE_URL}/kb/{kb_id}/documents", headers=headers)
            if res.status_code == 200:
                docs = res.json()
                matching_doc = next((d for d in docs if d["id"] == doc_id), None)
                if matching_doc:
                    status = matching_doc["status"]
                    progress = matching_doc.get("ingestion_progress", 0)
                    print(f"Polling document status: {status} ({progress}%)")
                    if status == "READY":
                        is_ready = True
                        break
                    elif status == "FAILED":
                        print(f"Document ingestion failed: {matching_doc.get('error_message')}")
                        return
            await asyncio.sleep(1.5)
            
        if not is_ready:
            print("Document ingestion timed out (did not reach READY within 60s).")
            return

        print("Document is READY! Initiating chat session...")

        # 5. Create a chat session
        chat_payload = {
            "title": "E2E Integration Test Chat",
            "kb_id": kb_id
        }
        res = await client.post(f"{BASE_URL}/chats", json=chat_payload, headers=headers)
        if res.status_code != 201:
            print(f"Failed to create chat: {res.status_code} {res.text}")
            return
            
        chat_id = res.json()["id"]
        print(f"Created chat with ID: {chat_id}")

        # 6. Submit query and stream response
        print("Submitting query: 'What is the secret validation code for this session?'...")
        query_payload = {
            "message": "What is the secret validation code for this session?",
            "stream": True
        }
        
        async with client.stream("POST", f"{BASE_URL}/chats/{chat_id}/messages", json=query_payload, headers=headers) as response:
            if response.status_code != 200:
                print(f"Query request failed: {response.status_code}")
                body = await response.aread()
                print(body.decode("utf-8"))
                return
                
            async for line in response.aiter_lines():
                if not line.strip():
                    continue
                if line.startswith("data:"):
                    data_str = line[5:].strip()
                    try:
                        event = json.loads(data_str)
                        if event.get("type") == "token":
                            content = event.get("token", "")
                            sys.stdout.write(content)
                            sys.stdout.flush()
                        elif event.get("type") == "done":
                            print("\n\nStream complete!")
                            print(f"Model Used: {event.get('model_used')}")
                            print(f"Response Tokens: {event.get('token_count')}")
                            print(f"Total Latency: {event.get('latency_ms')} ms")
                            citations = event.get('citations', [])
                            print(f"Citations returned: {len(citations)}")
                            for idx, cit in enumerate(citations, 1):
                                print(f"  [{idx}] File: '{cit.get('document_name')}' (Score: {cit.get('similarity_score')})")
                        elif event.get("type") == "diagnostics":
                            print(f"\nDiagnostics metrics: {event.get('diagnostics')}")
                    except Exception as e:
                        print(f"\nError parsing event line: {line} -> {e}")

if __name__ == "__main__":
    asyncio.run(run_e2e())
