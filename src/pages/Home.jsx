import "./Home.css";

function Home() {
  return (
    <div className="home">
      <section className="hero">
        <h1>RehabConnect</h1>

        <p>
          Helping people find rehabilitation centres, access exercise programs,
          track recovery, and discover affordable assistive devices.
        </p>

        <button>Get Started</button>
      </section>

      <section className="features">
        <div className="card">
          <h2>Find Centres</h2>
          <p>Locate nearby rehabilitation centres and specialists.</p>
        </div>

        <div className="card">
          <h2>Exercise Library</h2>
          <p>Watch guided exercises for different rehabilitation needs.</p>
        </div>

        <div className="card">
          <h2>Progress Tracker</h2>
          <p>Track recovery with daily and weekly progress reports.</p>
        </div>

        <div className="card">
          <h2>Marketplace</h2>
          <p>Discover affordable rehabilitation equipment.</p>
        </div>

        <div className="card">
          <h2>AI Assistant</h2>
          <p>Get quick answers and rehabilitation recommendations.</p>
        </div>
      </section>
    </div>
  );
}

export default Home;
