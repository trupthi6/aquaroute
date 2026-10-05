# AquaRoute Routing Engine & Cost Model (Module 3 Specification)

This specification defines the exact routing algorithms, graph topology, and flood-risk cost model for AquaRoute (SIH26085).
Module 4 (offline safe routing in client-side TypeScript) must replicate these calculations to achieve bit-for-bit parity.

---

## 1. Graph Representation

- **Type:** Directed multigraph ($G = (V, E)$), implemented with NetworkX `MultiDiGraph`.
- **Nodes ($V$):** Terminal endpoints of road segments, keyed by string node identifiers (`from_node`, `to_node`), with geographic coordinates `(lat, lon)` in WGS84 (`EPSG:4326`).
- **Edges ($E$):**
  - For each physical road segment between nodes $u$ and $v$:
    - Directed edge $u \to v$ is created.
    - If `oneway` is `false`, directed edge $v \to u$ is also created (with coordinates reversed).
  - Parallel edges between identical terminal node pairs are keyed by `segment_id`.
  - Stored edge attributes: `segment_id`, `length_m`, `travel_time_s`, `speed_kmh`, `coords` (continuous `[lon, lat]` tuples).

---

## 2. Speed Limits & Traversal Time

Speeds ($v_{\text{km/h}}$) are assigned according to road category and physical classification:

| Road Classification / Highway Tag | Speed ($v_{\text{km/h}}$) |
|---|---|
| `flyover` | 35.0 |
| `arterial`, `motorway`, `trunk`, `primary`, `secondary`, links | 30.0 |
| `underpass`, `tertiary`, `tertiary_link` | 25.0 |
| `residential`, `unclassified`, `lakeside`, default | 20.0 |

Traversal time in seconds:
$$T_{\text{travel\_s}} = \frac{L_{\text{m}}}{v_{\text{km/h}} / 3.6}$$

---

## 3. Cost Model & Edge Penalties

Each road segment evaluated at simulated time offset $t$ under view mode (`now` or `peak`) yields:
- Risk probability $r \in [0.0, 1.0]$: `risk_probability` (`now`) or `peak_risk_probability` (`peak`).
- Risk class $\text{cls} \in \{\text{LOW}, \text{MEDIUM}, \text{HIGH}, \text{CRITICAL}\}$: `risk_class` (`now`) or `peak_risk_class` (`peak`).
- Relative lowness $\text{low} \in [0.0, 1.0]$: from static features normalized to catchment elevation min/max.
- Drainage deficit $\text{deficit} \in [0.0, 1.0]$: from static drain distance and capacity.

### Constants

```python
ALPHA = 6.0
BETA = 0.5
GAMMA = 0.3
HIGH_MULT = 4.0
```

### Risk Penalty Multiplier ($F$)

$$F = 1.0 + r \times (\alpha + \beta \times \text{low} + \gamma \times \text{deficit})$$

If $\text{cls} == \text{"HIGH"}$, the factor is amplified:
$$F \leftarrow F \times \text{HIGH\_MULT}$$

### Traversal Cost Calculation

- **Fastest Route (ignores flood risk, respects physical blocks):**
  $$\text{Cost}_{\text{fastest}} = \begin{cases}
  \infty (\text{hidden}), & \text{if } \text{is\_blocked} \\
  T_{\text{travel\_s}}, & \text{otherwise}
  \end{cases}$$
  Where $\text{is\_blocked} = (\text{segment\_id} \in \text{blocked\_ids}) \lor \text{verified\_block}$.

- **Safe Route (avoids high/critical flood risk and blocks):**
  $$\text{Cost}_{\text{safe}} = \begin{cases}
  \infty (\text{hidden}), & \text{if } \text{is\_blocked} \lor (\text{cls} == \text{"CRITICAL"}) \\
  T_{\text{travel\_s}} \times F, & \text{otherwise}
  \end{cases}$$

---

## 4. Snapping & Route Recommendations

1. **Snapping:** Queries snap coordinates $(lat, lon)$ to the nearest graph node via Haversine great-circle distance.
   - If distance $> 500\text{ m}$, reject with HTTP 422.
   - If origin and destination snap to the identical node, reject with HTTP 422.
2. **Shortest Path Computation:** Evaluated using Dijkstra's algorithm. For parallel edges between $u$ and $v$, the edge with minimum cost is selected.
3. **Recommendation Decision:**
   - If the safe graph yields no path: recommendation is `NO_SAFE_ROUTE`, `safest` is `null`, and `fastest` is returned with a warning.
   - Otherwise, recommendation is `SAFER_ROUTE` if:
     $$\text{safest.segment\_ids} \ne \text{fastest.segment\_ids}$$
     $$\text{AND } \Big(\text{fastest contains HIGH or CRITICAL} \lor (\text{fastest.mean\_risk} - \text{safest.mean\_risk} \ge 0.10)\Big)$$
   - Otherwise, recommendation is `FASTEST_IS_SAFE`, and `safest` equals `fastest`.
