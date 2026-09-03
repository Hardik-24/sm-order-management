import time
import requests
import json
import sys

# ==============================================================================
# CONFIGURATION - CHANGE THESE!
# ==============================================================================

# 1. Replace with your actual Vercel app URL once deployed
#    (e.g., "https://my-app.vercel.app/api/inventory")
BASE_URL = "http://localhost:3000/api/inventory" 

# 2. Must exactly match the secret key in server/api/inventory/webhook.post.ts
SECRET_API_KEY = "super-secret-key-123"

# ==============================================================================

def get_data_from_busy():
    """
    Replace this function with your actual logic to connect to Busy Accounting 
    and export the data!
    """
    print("[*] Exporting data from Busy...")
    time.sleep(2) # Simulating export delay
    
    # FORMAT REQUIREMENT: Must be a list of dictionaries with at least 'sku' and 'stock'.
    # 'name', 'category', and 'price' are optional but highly recommended to auto-create new items!
    return [
        {"sku": "ITEM-001", "name": "18mm MDF", "category": "MDF", "price": 1200, "stock": 450},
        {"sku": "ITEM-002", "name": "Fevicol 1kg", "category": "Hardware", "price": 250, "stock": 0}
    ]

def upload_to_vercel(data):
    """
    Pushes the exported JSON data to your Nuxt/Vercel App.
    """
    print("[*] Uploading to Vercel/Supabase...")
    webhook_url = f"{BASE_URL}/webhook"
    
    try:
        response = requests.post(
            webhook_url, 
            json={"items": data}, 
            headers={"Authorization": f"Bearer {SECRET_API_KEY}"}
        )
        if response.status_code == 200:
            print("[+] Sync Successful!", response.json())
        else:
            print("[-] Upload Failed:", response.status_code, response.text)
    except Exception as e:
        print("[-] Connection Error:", e)

def check_sync_status():
    """
    Checks if the user clicked the 'Load Stock' button on the website.
    """
    try:
        status_url = f"{BASE_URL}/sync-status"
        response = requests.get(status_url, timeout=5)
        if response.status_code == 200:
            return response.json().get('syncRequested', False)
    except:
        pass
    return False

def main():
    print("==================================================")
    print("  Silicon Marketing - Busy Auto-Sync Background   ")
    print("==================================================")
    print(f"Listening for sync requests from: {BASE_URL}")
    print("Press Ctrl+C to exit.\n")
    
    try:
        while True:
            # 1. Ask Vercel: "Did the user click the button?"
            if check_sync_status():
                print("\n[!] Sync Requested by Website!")
                
                # 2. Get the data from your Busy software
                stock_data = get_data_from_busy()
                
                # 3. Push it to Vercel/Supabase
                upload_to_vercel(stock_data)
                
                print("[*] Resuming background listening...\n")
            
            # Wait 3 seconds before checking again (don't hammer the server)
            time.sleep(3)
            
    except KeyboardInterrupt:
        print("\n[!] Shutting down sync listener.")
        sys.exit(0)

if __name__ == "__main__":
    main()
