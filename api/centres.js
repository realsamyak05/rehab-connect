const SEARCH_RADIUS_METRES = 5_000;
const CACHE_TTL_MS = 5 * 60 * 1_000;
const centreCache = new Map();
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

function cacheKey(lat, lng) {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

async function fetchOverpass(query) {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": "RehabConnect Centre Finder",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) return response.json();
      console.warn("Overpass endpoint failed:", endpoint, response.status);
    } catch (error) {
      console.warn("Overpass endpoint could not be reached:", endpoint, error);
    }
  }

  throw new Error("All Overpass endpoints are unavailable");
}

async function getCentres(lat, lng) {
  const key = cacheKey(lat, lng);
  const cached = centreCache.get(key);

  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const query = `
  [out:json][timeout:8];
  (
    nwr["healthcare"="rehabilitation"](around:${SEARCH_RADIUS_METRES},${lat},${lng});
    nwr["amenity"="clinic"](around:${SEARCH_RADIUS_METRES},${lat},${lng});
    nwr["amenity"="hospital"](around:${SEARCH_RADIUS_METRES},${lat},${lng});
  );
  out center 25;
`;

  const request = fetchOverpass(query).then((data) => {
    centreCache.set(key, { createdAt: Date.now(), data });
    return data;
  });

  // Multiple searches for the same nearby area use one network request.
  centreCache.set(key, { createdAt: Date.now(), data: request });

  try {
    return await request;
  } catch (error) {
    centreCache.delete(key);
    throw error;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  } catch {
    return res.status(400).json({ error: "A valid location is required." });
  }

  const lat = Number(body.lat);
  const lng = Number(body.lng);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return res.status(400).json({ error: "A valid location is required." });
  }

  try {
    const data = await getCentres(lat, lng);
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=60",
    );
    return res.status(200).json(data);
  } catch (error) {
    console.error("Centre search error:", error);
    return res.status(502).json({
      error: "The centre-search service is temporarily unavailable.",
    });
  }
}
