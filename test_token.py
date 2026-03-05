import requests

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Content-Type": "application/json",
    "Accept": "application/json"
}

print("Logging in...")
login_res = requests.post(
    "https://witty-plant-049bca810.6.azurestaticapps.net/api/auth/login",
    json={"email": "admin@sgm.com", "password": "admin123"},
    headers=headers
)
print("Login status:", login_res.status_code)
print("Login text:", login_res.text[:200])
if login_res.status_code == 200:
    token = login_res.json().get("access_token")
    from jose import jwt
    decoded = jwt.decode(token, "", options={"verify_signature": False})
    print("Local Decoded Token:", decoded)

    headers["Authorization"] = f"Bearer {token}"
    print("\nFetching users...")
    users_res = requests.get(
        "https://witty-plant-049bca810.6.azurestaticapps.net/api/users/",
        headers=headers
    )
    print("Users status:", users_res.status_code)
    print("Users response:", users_res.text)
