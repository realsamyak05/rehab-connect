const SEARCH_RADIUS_METRES = 10_000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const body =
    typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

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

  const query = `
    [out:json][timeout:25];
    (
      nwr["amenity"="hospital"](around:${SEARCH_RADIUS_METRES},${lat},${lng});
      nwr["healthcare"~"rehabilitation|clinic|hospital|centre",i](around:${SEARCH_RADIUS_METRES},${lat},${lng});
    );
    out center 20;
  `;

  try {
    const overpassResponse = await fetch(
      "https://overpass.kumi.systems/api/interpreter",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": "RehabConnect Centre Finder",
        },
        body: `data=${encodeURIComponent(query)}`,
      },
    );

    if (!overpassResponse.ok) {
      console.error("Overpass error:", overpassResponse.status);
      return res.status(502).json({
        error: "The centre-search service is temporarily unavailable.",
      });
    }

    const data = await overpassResponse.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error("Centre search error:", error);
    return res.status(502).json({
      error: "The centre-search service is temporarily unavailable.",
    });
  }
}
