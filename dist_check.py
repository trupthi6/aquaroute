"""Print risk class distribution for all scenario+offset combos via the live API."""
import json, urllib.request, urllib.parse

BASE = "http://localhost:8000"

combos = [
    ("normal",        120),
    ("normal",        180),
    ("moderate_rain", 180),
    ("moderate_rain", 240),
    ("heavy_rain",    180),
    ("heavy_rain",    240),
    ("extreme_rain",  210),
    ("extreme_rain",  270),
]

def post(path, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(f"{BASE}{path}", data=data,
                                  headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.load(r)

def get(path):
    with urllib.request.urlopen(f"{BASE}{path}", timeout=10) as r:
        return json.load(r)

print(f"{'Scenario':<20} {'@min':>5}  {'LOW':>5} {'MED':>5} {'HIGH':>5} {'CRIT':>5} {'total':>6}")
print("-" * 60)

for scenario, offset in combos:
    post("/api/v1/scenario", {"scenario": scenario, "now_offset_min": offset})
    risk = get("/api/v1/risk")
    counts = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
    for f in risk["features"]:
        rc = f["properties"]["risk_class"]
        counts[rc] = counts.get(rc, 0) + 1
    total = len(risk["features"])
    print(f"{scenario:<20} {offset:>5}  {counts['LOW']:>5} {counts['MEDIUM']:>5} {counts['HIGH']:>5} {counts['CRITICAL']:>5} {total:>6}")

# Top 5 at heavy_rain@240
print("\nTop 5 segments at heavy_rain@240 (by risk_probability):")
post("/api/v1/scenario", {"scenario": "heavy_rain", "now_offset_min": 240})
risk = get("/api/v1/risk")
segs = sorted(risk["features"], key=lambda f: f["properties"]["risk_probability"], reverse=True)[:5]
for f in segs:
    p = f["properties"]
    print(f"  {p['segment_id']:<10} {p['name']:<40} {p['risk_class']:<10} {p['risk_probability']:.4f}")
