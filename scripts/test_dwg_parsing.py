#!/usr/bin/env python3
"""
Test script to trigger re-parsing of DWG files
"""
import requests
import sys

API_URL = "http://localhost:8000"

def get_token():
    """Login and get access token"""
    response = requests.post(
        f"{API_URL}/api/v1/auth/login",
        json={"email": "test@example.com", "password": "test123"}
    )
    if response.status_code == 200:
        return response.json()["access_token"]
    else:
        print(f"Login failed: {response.text}")
        sys.exit(1)

def reparse_file(file_id: str, token: str):
    """Trigger file re-parsing"""
    response = requests.post(
        f"{API_URL}/api/v1/files/{file_id}/reparse",
        headers={"Authorization": f"Bearer {token}"}
    )
    if response.status_code == 200:
        print(f"✓ File {file_id} queued for reparsing")
        return response.json()
    else:
        print(f"✗ Failed to reparse file {file_id}: {response.text}")
        return None

def get_dwg_files(token: str):
    """Get all DWG files"""
    response = requests.get(
        f"{API_URL}/api/v1/files",
        headers={"Authorization": f"Bearer {token}"}
    )
    if response.status_code == 200:
        all_files = response.json()
        dwg_files = [f for f in all_files if f.get('filename', '').lower().endswith('.dwg')]
        return dwg_files
    else:
        print(f"Failed to get files: {response.text}")
        return []

if __name__ == "__main__":
    print("🔄 Testing DWG parsing with LibreDWG conversion...")
    
    token = get_token()
    print("✓ Authenticated")
    
    dwg_files = get_dwg_files(token)
    print(f"Found {len(dwg_files)} DWG file(s)")
    
    for file in dwg_files:
        print(f"\nFile: {file['filename']}")
        print(f"  ID: {file['id']}")
        print(f"  Metadata exists: {file.get('file_metadata') is not None}")
        
        # Trigger reparse
        reparse_file(file['id'], token)
