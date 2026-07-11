import "./Centres.css";
import { useState } from "react";
import centresData from "../data/centres";

function Centres() {
  const [search, setSearch] = useState("");

  const filteredCentres = centresData.filter((centre) =>
    centre.city.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="centres-page">
      <h1>Find Rehabilitation Centres</h1>

      <input
        className="search-box"
        type="text"
        placeholder="Search by city..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          marginTop: "20px",
          padding: "10px",
          width: "300px",
          fontSize: "16px",
        }}
      />

      <div className="centres-grid">
        {filteredCentres.map((centre) => (
          <div key={centre.id} className="centre-card">
            <img
              src={centre.image}
              alt={centre.name}
              className="centre-image"
            />
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
          </div>
        ))}
      </div>
    </div>
  );
}

export default Centres;
