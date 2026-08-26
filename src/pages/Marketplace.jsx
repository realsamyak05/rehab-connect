import { useMemo, useState } from "react";
import products from "../data/products";
import "./Marketplace.css";

function Marketplace() {
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = useMemo(() => {
    const counts = products.reduce((acc, p) => {
      acc[p.category] = (acc[p.category] || 0) + 1;
      return acc;
    }, {});
    const sorted = Object.keys(counts).sort();
    return [
      { name: "All", count: products.length },
      ...sorted.map((name) => ({ name, count: counts[name] })),
    ];
  }, []);

  const visibleProducts = useMemo(() => {
    if (selectedCategory === "All") return products;
    return products.filter((p) => p.category === selectedCategory);
  }, [selectedCategory]);

  return (
    <div className="marketplace">
      <h1>Marketplace</h1>
      <p className="marketplace-note">
        Mobility aids, supports, and recovery tools, hand-picked for
        rehabilitation.
      </p>

      <div className="category-filter">
        {categories.map((cat) => (
          <button
            key={cat.name}
            className={`category-chip ${
              selectedCategory === cat.name ? "active" : ""
            }`}
            onClick={() => setSelectedCategory(cat.name)}
          >
            {cat.name} <span className="chip-count">{cat.count}</span>
          </button>
        ))}
      </div>

      <div className="products-grid">
        {visibleProducts.map((product) => (
          <div key={product.id} className="product-card">
            <div className="product-image-wrap">
              <img src={product.image} alt={product.name} />
              <span className="product-category-badge">{product.category}</span>
            </div>

            <div className="product-body">
              <h2>{product.name}</h2>

              <p className="product-price">
                ₹{product.price.toLocaleString("en-IN")}
              </p>

              <a
                className="view-product-button"
                href={product.link}
                target="_blank"
                rel="noreferrer"
              >
                View Product
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Marketplace;
