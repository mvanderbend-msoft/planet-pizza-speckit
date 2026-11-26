# Quickstart: Verify Track Your Abduction

**Feature**: `001-order-tracking`. No test runner exists (Constitution VI).
Verification is a green build, `curl` against the running API, and a short browser
walkthrough.

## 0. Build and run

```powershell
npm run build          # MUST pass (backend + frontend type-check)
npm run dev            # backend :3001, frontend :5173
```

If the backend errors on the `orders` table after pulling, stop it, delete
`backend/data/app.db*`, and restart.

## 1. Create an order and capture the token

```powershell
$o = Invoke-RestMethod -Method Post http://localhost:3001/api/orders -ContentType 'application/json' -Body '{"customer":{"name":"Fox Mulder","email":"Earthling@Example.com","address":"Hangar 18"},"items":[{"productId":1,"quantity":2}]}'
$o.id; $o.tracking_stage; $o.access_token.Length   # -> <id>, confirmed, 43
$o.PSObject.Properties.Name -contains 'access_token_hash'   # -> False
```

## 2. Tracking by number + email (Stories 1 and 2)

```powershell
$track = 'http://localhost:3001/api/orders/track'
# match: different case + spaces + "#0" prefix
curl.exe -s -X POST $track -H 'Content-Type: application/json' -d "{\"order_number\":\"#0$($o.id)\",\"email\":\" earthling@example.com \"}"
#   -> 200, tracking_stage "confirmed", items with line_total_cents, total_cents; NO name/email/address

# wrong email vs non-existent number: body MUST be identical, timings comparable
curl.exe -s -w ' %{http_code} %{time_total}\n' -X POST $track -H 'Content-Type: application/json' -d "{\"order_number\":$($o.id),\"email\":\"scully@fbi.gov\"}"
curl.exe -s -w ' %{http_code} %{time_total}\n' -X POST $track -H 'Content-Type: application/json' -d '{"order_number":999999,"email":"scully@fbi.gov"}'
#   -> both: {"error":"Order not found"} 404

# invalid input -> 400 (never 404)
curl.exe -s -w ' %{http_code}\n' -X POST $track -H 'Content-Type: application/json' -d '{"order_number":"4.2","email":"x@y.z"}'
curl.exe -s -w ' %{http_code}\n' -X POST $track -H 'Content-Type: application/json' -d '{"order_number":"-1","email":"x@y.z"}'
curl.exe -s -w ' %{http_code}\n' -X POST $track -H 'Content-Type: application/json' -d '{"order_number":"42","email":"not-an-email"}'
```

## 3. Number-only gap is closed (FR-013)

```powershell
curl.exe -s -w ' %{http_code}\n' "http://localhost:3001/api/orders/$($o.id)"                                          # 404 Order not found
curl.exe -s -w ' %{http_code}\n' -H "X-Order-Access-Token: $($o.access_token)" "http://localhost:3001/api/orders/$($o.id)"  # 200 full order
curl.exe -s -w ' %{http_code}\n' -X POST $track -H 'Content-Type: application/json' -d "{\"order_number\":$($o.id),\"access_token\":\"$($o.access_token)\"}"  # 200 tracking
```

## 4. Rate limit (FR-009)

Restart the backend first, or wait 2 minutes, so the bucket is empty.

```powershell
1..12 | % { curl.exe -s -o NUL -w "%{http_code} " -X POST $track -H 'Content-Type: application/json' -d '{"order_number":1,"email":"a@b.co"}' }
#   -> ten 404s then 429 429 (with Retry-After header); still 429 for ~60s, then normal
```

## 5. Browser walkthrough (http://localhost:5173)

1. Add a pizza, check out with `Earthling@Example.com`. The confirmation page shows
   full details and a **Track your abduction** link.
2. Click the link. `/track/<id>` shows the timeline straight away (stage 1 current,
   2–4 upcoming), with the items and total. There's no form submit, and no email in
   the URL.
3. Use the **Track Your Abduction** nav entry from any page. The form is empty.
   Enter the number plus ` earthling@example.com ` to get the same result. Then
   enter a wrong email to see the `noMatch` copy, and confirm the previous result
   is replaced.
4. Open `/order/<id>` and `/track/<id>` in a private window. You get no details,
   and the form is shown with the number pre-filled.
5. Stop the backend and submit. You see `signalLost`, which is different from
   `noMatch`.
6. Optional: to check the 24h expiry, set `access_expires_at` in the past with
   `sqlite3`, or edit the `localStorage` entry. The confirmation page then falls
   back to the form.
