const fs = require("fs");

const filePath = "src/App.jsx";

let content = fs.readFileSync(filePath, "utf8");

let counter = 1;

content = content.replace(
  /products:\s*\[((?:.|\n)*?)\]/g,
  (match, productsBlock) => {
    const converted = productsBlock.replace(
      /"([^"]+)"/g,
      (_, productName) => {
        return `{ idnum: ${counter++}, name: "${productName}" }`;
      }
    );

    return `products: [${converted}]`;
  }
);

fs.writeFileSync(filePath, content);

console.log("✅ Productos convertidos con idnum co
