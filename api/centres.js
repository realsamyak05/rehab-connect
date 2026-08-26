const SEARCH_RADIUS_METRES = 5_000;
const CACHE_TTL_MS = 5 * 60 * 1_000;
const centreCache = new Map();

function cacheKey(lat, lng) {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

async function getCentres(lat, lng) {
  const key = cacheKey(lat, lng);
  const cached = centreCache.get(key);

  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    return cached.data;
  }

  if (!process.env.GEOAPIFY_KEY) {
    throw new Error("GEOAPIFY_KEY is not configured");
  }

  const params = new URLSearchParams({
    categories: "healthcare",
    filter: `circle:${lng},${lat},${SEARCH_RADIUS_METRES}`,
    limit: "10",
    apiKey: process.env.GEOAPIFY_KEY,
  });

  const request = fetch(
    `https://api.geoapify.com/v2/places?${params.toString()}`,
    { headers: { Accept: "application/json" } },
  ).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Geoapify responded with ${response.status}`);
    }

    const data = await response.json();
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
