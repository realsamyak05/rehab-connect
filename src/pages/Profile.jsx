import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  onAuthStateChanged,
  updateProfile as updateAuthProfile,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import "./Profile.css";

const EXERCISE_CATEGORIES = [
  "Arm",
  "Leg",
  "Back",
  "Shoulder",
  "Hand",
  "Balance",
  "Neck",
];

function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [name, setName] = useState("");
  const [recoveryGoal, setRecoveryGoal] = useState("");
  const [preferredCategory, setPreferredCategory] = useState(
    EXERCISE_CATEGORIES[0],
  );

  useEffect(() => {
    const stopAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setLoading(false);
        return;
      }

      setLoading(true);

      const profileRef = doc(db, "users", currentUser.uid);
      const profileSnapshot = await getDoc(profileRef);
      const data = profileSnapshot.exists() ? profileSnapshot.data() : {};

      setName(currentUser.displayName || data.name || "");
      setRecoveryGoal(data.recoveryGoal || "");
      setPreferredCategory(data.preferredCategory || EXERCISE_CATEGORIES[0]);

      setLoading(false);
    });

    return stopAuth;
  }, []);

  async function handleSave(event) {
    event.preventDefault();
    if (!user) return;

    setSaving(true);
    setMessage("");

    try {
      const trimmedName = name.trim();

      if (trimmedName && trimmedName !== user.displayName) {
        await updateAuthProfile(user, { displayName: trimmedName });
      }

      await setDoc(
        doc(db, "users", user.uid),
        {
          name: trimmedName,
          email: user.email,
          recoveryGoal: recoveryGoal.trim(),
          preferredCategory,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      setMessage("Profile updated.");
    } catch {
      setMessage("Could not save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="profile-page">Loading your profile...</main>;
  }

  if (!user) {
    return (
      <main className="profile-page">
        <h1>My Profile</h1>
        <p>Log in to edit your profile.</p>
        <Link className="profile-login-link" to="/login">
          Log in
        </Link>
      </main>
    );
  }

  return (
    <main className="profile-page">
      <h1>My Profile</h1>
      <p className="profile-subtitle">
        Update your details, recovery goal, and preferred exercise category.
      </p>

      <form className="profile-card" onSubmit={handleSave}>
        <label>
          Name
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your name"
          />
        </label>

        <label>
          Recovery goal
          <textarea
            value={recoveryGoal}
            onChange={(event) => setRecoveryGoal(event.target.value)}
            placeholder="e.g. Regain full mobility in my left knee within 3 months"
            rows={4}
          />
        </label>

        <label>
          Preferred exercise category
          <select
            value={preferredCategory}
            onChange={(event) => setPreferredCategory(event.target.value)}
          >
            {EXERCISE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        {message && <p className="profile-message">{message}</p>}

        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </button>
      </form>
    </main>
  );
}

export default Profile;
