import React, { useEffect, useMemo, useState } from "react";
import { ShoppingCart, Trash2, Send, Search, ImageOff } from "lucide-react";
import { departments, hiddenProductsRaw } from "./products";

const WHATSAPP_NUMBER = "34670716744";

const normalizeForCompare = (text) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ]+/gi, "")
    .trim();

const normalizeText = (text) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const productMatchesSearch = (product, searchText) => {
  const normalizedProduct = normalizeText(product);
  const searchWords = normalizeText(searchText)
    .split(/[^a-z0-9ñ]+/i)
    .filter(Boolean);

  return searchWords.every((word) => normalizedProduct.includes(word));
};

// 🟢 GENERADOR AUTOMÁTICO DE NOMBRE DE IMAGEN
const getImageFileName = (productName) =>
  productName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// 🟢 URL FINAL DE LA IMAGEN
const getProductImageUrl = (productName) =>
  `/images/${getImageFileName(productName)}.jpg`;

// 🟢 COMPONENTE FOTO
function ProductPhoto({ productName }) {
  const [error, setError] = useState(false);
  const src = getProductImageUrl(productName);

  if (error) {
    return (
      <div style={styles.photoBox}>
        <ImageOff size={20} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={productName}
      style={styles.productImage}
      onError={() => setError(true)}
    />
  );
}

const visibleProducts = departments.flatMap((dep) =>
  dep.products.map((name) => ({
    id: `${dep.name}-${name}`,
    name,
    department: dep.name
  }))
);

const visibleProductNames = new Set(
  visibleProducts.map((p) => normalizeForCompare(p.name))
);

const hiddenProducts = [...new Set(hiddenProductsRaw)]
  .filter((p) => !visibleProductNames.has(normalizeForCompare(p)))
  .sort((a, b) => a.localeCompare(b, "es"));

const products = [
  ...visibleProducts,
  ...hiddenProducts.map((name) => ({
    id: `hidden-${name}`,
    name,
    department: "BUSCADOS"
  }))
];

export default function App() {
  const [quantities, setQuantities] = useState({});
  const [search, setSearch] = useState("");

  const filteredDepartments = useMemo(() => {
    const clean = search.trim();

    const deps = departments
      .map((d) => ({
        ...d,
        products: clean
          ? d.products.filter((p) => productMatchesSearch(p, clean))
          : d.products
      }))
      .filter((d) => d.products.length > 0);

    if (clean) {
      const hiddenMatches = hiddenProducts.filter((p) =>
        productMatchesSearch(p, clean)
      );

      if (hiddenMatches.length) {
        deps.push({ name: "BUSCADOS", products: hiddenMatches });
      }
    }

    return deps;
  }, [search]);

  const updateQty = (id, field, val) => {
    const clean = val.replace(/[^0-9]/g, "");
    setQuantities((q) => ({
      ...q,
      [id]: { ...q[id], [field]: clean }
    }));
  };

  const selected = products.filter((p) => {
    const q = quantities[p.id] || {};
    return Number(q.cajas || 0) > 0 || Number(q.unidades || 0) > 0;
  });

  const sendOrder = () => {
    if (!selected.length) return alert("Añade productos");

    const text = selected
      .map((p) => {
        const q = quantities[p.id];
        return `${p.name} → ${q.cajas || 0} cajas / ${q.unidades || 0} uds`;
      })
      .join("\n");

    window.open(
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`,
      "_blank"
    );
  };

  return (
    <div style={styles.page}>
      <h1>Pedidos con Fotos</h1>

      <input
        placeholder="Buscar..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={styles.search}
      />

      {filteredDepartments.map((dep) => (
        <div key={dep.name}>
          <h2>{dep.name}</h2>

          {dep.products.map((name) => {
            const id = `${dep.name}-${name}`;
            return (
              <div key={id} style={styles.row}>
                <ProductPhoto productName={name} />

                <div style={styles.qtyRow}>
                  <input
                    placeholder="Cajas"
                    value={quantities[id]?.cajas || ""}
                    onChange={(e) =>
                      updateQty(id, "cajas", e.target.value)
                    }
                  />
                  <input
                    placeholder="Unid"
                    value={quantities[id]?.unidades || ""}
                    onChange={(e) =>
                      updateQty(id, "unidades", e.target.value)
                    }
                  />
                </div>

                <div style={styles.name}>{name}</div>
              </div>
            );
          })}
        </div>
      ))}

      <button onClick={sendOrder} style={styles.button}>
        Enviar pedido
      </button>
    </div>
  );
}

const styles = {
  page: { padding: 10, fontFamily: "Arial" },

  search: {
    width: "100%",
    padding: 10,
    marginBottom: 10
  },

  row: {
    border: "1px solid #ddd",
    padding: 10,
    marginBottom: 10,
    borderRadius: 10
  },

  productImage: {
    width: "100%",
    height: 120,
    objectFit: "cover",
    borderRadius: 10
  },

  photoBox: {
    height: 120,
    background: "#eee",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },

  qtyRow: {
    display: "flex",
    gap: 10,
    marginTop: 10
  },

  name: {
    marginTop: 10,
    fontWeight: "bold"
  },

  button: {
    width: "100%",
    padding: 15,
    background: "black",
    color: "white",
    borderRadius: 10
  }
};
