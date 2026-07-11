import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
import "./SavedCentres.css";

function SavedCentres() {
  const [user, setUser] = useState(null);
  const [centres, setCentres] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stopSavedCentres = () => {};

    const stopAuth = onAuthStateChanged(auth, (currentUser) => {
      stopSavedCentres();
      setUser(currentUser);

      if (!currentUser) {
        setCentres([]);
        setLoading(false);
        return;
      }

      stopSavedCentres = onSnapshot(
        collection(db, "users", currentUser.uid, "savedCentres"),
        (snapshot) => {
          setCentres(
            snapshot.docs.map((item) => ({
              id: item.id,
              ...item.data(),
            })),
          );
          setLoading(false);
        },
      );
    });

    return () => {
      stopAuth();
      stopSavedCentres();
    };
  }, []);

  async function removeCentre(id) {
    await deleteDoc(doc(db, "users", user.uid, "savedCentres", id));
  }

  if (loading) {
    return <main className="saved-centres-page">Loading saved centres...</main>;
  }

  if (!user) {
    return (
      <main className="saved-centres-page">
        <h1>Saved Centres</h1>
        <p>Log in to save and view rehabilitation centres.</p>
        <Link className="login-to-save" to="/login">
          Log in
        </Link>
      </main>
    );
  }

  return (
    <main className="saved-centres-page">
      <h1>Saved Centres</h1>

      {centres.length === 0 ? (
        <p>You have not saved any centres yet.</p>
      ) : (
        <div className="saved-centres-grid">
          {centres.map((centre) => (
            <article key={centre.id} className="saved-centre-card">
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

              {centre.lat && centre.lng && (
                <a
                  href={`https://www.google.com/maps?q=${centre.lat},${centre.lng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on Maps
                </a>
              )}

              <button onClick={() => removeCentre(centre.id)}>Remove</button>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

export default SavedCentres;
