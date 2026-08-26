import "./Centres.css";
import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase";

const DEFAULT_POSITION = [26.8467, 80.9462];
const CACHE_TTL_MS = 5 * 60 * 1_000;
const centreCache = new Map();
const locationCache = new Map();

function cacheKey(lat, lng) {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

function formatCentres(features, label) {
  return features
    .map((place) => {
      const [placeLng, placeLat] = place.geometry?.coordinates ?? [];

      if (placeLat == null || placeLng == null) return null;

      const properties = place.properties ?? {};

      return {
        id: String(
          properties.place_id ??
            properties.datasource?.raw_id ??
            `${placeLat}-${placeLng}`,
        ),
        name: properties.name ?? "Healthcare centre",
        city: properties.city ?? label,
        type: properties.categories?.join(", ") ?? "Healthcare",
        address: properties.formatted ?? "Address unavailable",
        lat: placeLat,
        lng: placeLng,
      };
    })
    .filter(Boolean)
    .slice(0, 10);
}

function RecenterMap({ position }) {
  const map = useMap();

  useEffect(() => {
    map.setView(position, 11);
  }, [map, position]);

  return null;
}

function Centres() {
  const [user, setUser] = useState(null);
  const [savedCentreIds, setSavedCentreIds] = useState([]);
  const [search, setSearch] = useState("");
  const [centres, setCentres] = useState([]);
  const [mapPosition, setMapPosition] = useState(DEFAULT_POSITION);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchedPlace, setSearchedPlace] = useState("");

  const navigate = useNavigate();
  const requestId = useRef(0);
  const hasUserSearch = useRef(false);

  useEffect(() => {
    let stopSavedCentres = () => {};

    const stopAuth = onAuthStateChanged(auth, (currentUser) => {
      stopSavedCentres();
      setUser(currentUser);

      if (!currentUser) {
        setSavedCentreIds([]);
        return;
      }

      stopSavedCentres = onSnapshot(
        collection(db, "users", currentUser.uid, "savedCentres"),
        (snapshot) => {
          setSavedCentreIds(snapshot.docs.map((item) => item.id));
        },
      );
    });

    return () => {
      stopAuth();
      stopSavedCentres();
    };
  }, []);

  async function toggleSavedCentre(centre) {
    if (!user) {
      navigate("/login");
      return;
    }

    const savedCentreRef = doc(
      db,
      "users",
      user.uid,
      "savedCentres",
      String(centre.id),
    );

    if (savedCentreIds.includes(String(centre.id))) {
      await deleteDoc(savedCentreRef);
      return;
    }

    await setDoc(savedCentreRef, {
      name: centre.name,
      city: centre.city ?? "Unknown city",
      type: centre.type ?? "Healthcare",
      address: centre.address ?? "Address unavailable",
      lat: centre.lat ?? null,
      lng: centre.lng ?? null,
      savedAt: serverTimestamp(),
    });
  }

  const fetchCentres = useCallback(async (lat, lng, label) => {
    const currentRequest = ++requestId.current;
    const key = cacheKey(lat, lng);
    const cached = centreCache.get(key);

    setError("");
    setMapPosition([lat, lng]);
    setSearchedPlace(label);

    if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
      setCentres(cached.centres);
      setLoading(false);

      if (cached.centres.length === 0) {
        setError(
          `No healthcare or rehabilitation centres were found near ${label}.`,
        );
      }

      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/centres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng }),
      });

      if (!response.ok) throw new Error("Could not load centres");

      const data = await response.json();
      const nearbyCentres = formatCentres(data.features ?? [], label);

      centreCache.set(key, {
        createdAt: Date.now(),
        centres: nearbyCentres,
      });

      if (currentRequest !== requestId.current) return;

      setCentres(nearbyCentres);

      if (nearbyCentres.length === 0) {
        setError(
          `No healthcare or rehabilitation centres were found near ${label}.`,
        );
      }
    } catch {
      if (currentRequest !== requestId.current) return;
      setError("Could not fetch centres. Please try again shortly.");
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported. Search for a city instead.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!hasUserSearch.current) {
          fetchCentres(coords.latitude, coords.longitude, "your location");
        }
      },
      () => {
        if (!hasUserSearch.current) {
          setError("Location access was denied. Search for a city instead.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 300_000,
      },
    );
  }, [fetchCentres]);

  async function handleSearch(event) {
    event.preventDefault();

    hasUserSearch.current = true;
    const lookupRequest = ++requestId.current;
    const place = search.trim();

    if (!place) {
      setError("Enter a city or area to search.");
      setLoading(false);
      return;
    }

    const normalizedPlace = place.toLowerCase();
    const cachedLocation = locationCache.get(normalizedPlace);

    if (
      cachedLocation &&
      Date.now() - cachedLocation.createdAt < CACHE_TTL_MS
    ) {
      await fetchCentres(
        cachedLocation.lat,
        cachedLocation.lng,
        cachedLocation.label,
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(place)}`,
        { headers: { Accept: "application/json" } },
      );

      if (!response.ok) throw new Error("Location lookup failed");

      const locations = await response.json();

      if (lookupRequest !== requestId.current) return;

      if (!locations.length) {
        setError(`Could not find “${place}”. Try a more specific city name.`);
        return;
      }

      const location = locations[0];
      const result = {
        createdAt: Date.now(),
        lat: Number(location.lat),
        lng: Number(location.lon),
        label: location.display_name,
      };

      locationCache.set(normalizedPlace, result);

      await fetchCentres(result.lat, result.lng, result.label);
    } catch {
      if (lookupRequest !== requestId.current) return;
      setError("Could not find that location. Please try again.");
    } finally {
      if (lookupRequest === requestId.current) {
        setLoading(false);
      }
    }
  }

  const resultLabel = useMemo(
    () =>
      searchedPlace === "your location" ? "near you" : `near ${searchedPlace}`,
    [searchedPlace],
  );

  return (
    <div className="centres-page">
      <h1>Find Rehabilitation Centres</h1>

      <form onSubmit={handleSearch}>
        <input
          className="search-box"
          type="search"
          placeholder="Search a city or area, e.g. Delhi"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button className="search-button" type="submit" disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {loading && <p>Finding rehabilitation centres...</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && centres.length > 0 && <p>Showing centres {resultLabel}.</p>}

      <MapContainer
        center={DEFAULT_POSITION}
        zoom={11}
        style={{
          height: "400px",
          width: "100%",
          marginTop: "30px",
          borderRadius: "12px",
        }}
      >
        <RecenterMap position={mapPosition} />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {centres.map((centre) => (
          <Marker key={centre.id} position={[centre.lat, centre.lng]}>
            <Popup>
              <strong>{centre.name}</strong>
              <br />
              {centre.address}
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="centres-grid">
        {centres.map((centre) => (
          <article key={centre.id} className="centre-card">
            <h2>{centre.name}</h2>

            <p>
              <strong>City:</strong> {centre.city}
            </p>
            <p>
              <strong>Type:</strong> {centre.type}
            </p>
            <p>
              <strong>Address:</strong> {centre.address}
            </p>

            <a
              href={`https://www.google.com/maps?q=${centre.lat},${centre.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              View on Maps
            </a>

            <button
              className="save-centre-button"
              onClick={() => toggleSavedCentre(centre)}
            >
              {savedCentreIds.includes(String(centre.id))
                ? "♥ Saved"
                : "♡ Save centre"}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

export default Centres;
