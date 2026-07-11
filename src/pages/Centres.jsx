import "./Centres.css";
import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useMemo, useState } from "react";
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
const SEARCH_RADIUS_METRES = 10_000;

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
  const navigate = useNavigate();

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
  const [search, setSearch] = useState("");
  const [centres, setCentres] = useState([]);
  const [mapPosition, setMapPosition] = useState(DEFAULT_POSITION);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchedPlace, setSearchedPlace] = useState("");

  const fetchCentres = useCallback(async (lat, lng, label) => {
    setLoading(true);
    setError("");
    setCentres([]);
    setMapPosition([lat, lng]);
    setSearchedPlace(label);

    const query = `
      [out:json][timeout:25];
      (
        nwr["amenity"="hospital"](around:${SEARCH_RADIUS_METRES},${lat},${lng});
        nwr["healthcare"~"rehabilitation|clinic|hospital|centre",i](around:${SEARCH_RADIUS_METRES},${lat},${lng});
      );
      out center 20;
    `;

    try {
      const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: query,
      });
      if (!response.ok) throw new Error("Could not load centres");

      const data = await response.json();
      const nearbyCentres = data.elements
        .map((place) => {
          const placeLat = place.lat ?? place.center?.lat;
          const placeLng = place.lon ?? place.center?.lon;
          if (placeLat == null || placeLng == null) return null;

          const tags = place.tags ?? {};
          return {
            id: `${place.type}-${place.id}`,
            name: tags.name ?? "Healthcare centre",
            city: tags["addr:city"] ?? label,
            type: tags.healthcare ?? tags.amenity ?? "Healthcare",
            address:
              (tags["addr:full"] ??
                [tags["addr:housenumber"], tags["addr:street"]]
                  .filter(Boolean)
                  .join(" ")) ||
              "Address unavailable",
            lat: placeLat,
            lng: placeLng,
          };
        })
        .filter(Boolean)
        .slice(0, 10);

      setCentres(nearbyCentres);
      if (nearbyCentres.length === 0) {
        setError(
          `No healthcare or rehabilitation centres were found near ${label}.`,
        );
      }
    } catch {
      setError("Could not fetch centres. Please try again shortly.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported. Search for a city instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        fetchCentres(coords.latitude, coords.longitude, "your location"),
      () => setError("Location access was denied. Search for a city instead."),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 300_000 },
    );
  }, [fetchCentres]);

  async function handleSearch(event) {
    event.preventDefault();
    const place = search.trim();
    if (!place) {
      setError("Enter a city or area to search.");
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
      if (!locations.length) {
        setError(`Could not find “${place}”. Try a more specific city name.`);
        return;
      }

      const location = locations[0];
      await fetchCentres(
        Number(location.lat),
        Number(location.lon),
        location.display_name,
      );
    } catch {
      setError("Could not find that location. Please try again.");
    } finally {
      setLoading(false);
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
