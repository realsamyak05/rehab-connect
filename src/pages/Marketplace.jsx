import products from "../data/products";
import "./Marketplace.css";

function Marketplace() {
  return (
    <div className="marketplace">
      <h1>Marketplace</h1>

      <div className="products-grid">
        {products.map((product) => (
          <div key={product.id} className="product-card">
            <img src={product.image} alt={product.name} />

            <h2>{product.name}</h2>

            <p>₹{product.price}</p>

            <button>View Product</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Marketplace;
