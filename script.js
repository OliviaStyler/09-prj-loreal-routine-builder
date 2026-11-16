/* ---------- 1. Settings ---------- */
// Paste your Cloudflare Worker URL here (no API key needed!)
const WORKER_URL = "https://loreal-worker.u1489117.workers.dev/";

// The system prompt tells the AI who it is and what it may talk about
const SYSTEM_PROMPT = `You are a friendly L'Oréal beauty advisor.
You help with skincare, haircare, makeup, fragrance, grooming, suncare, and the
user's generated routine. When given a list of products, build a clear
step-by-step routine (morning and evening if it makes sense), explain why each
product is used, and give the order of use. Only use the products provided
unless the user asks for suggestions. Use web search when the user asks about
current information, such as new products, availability, ingredients, reviews,
or official L'Oréal brand details, and include links to your sources. If a
question is not related to beauty, personal care, or the user's routine,
politely say you can only help with those topics. Keep answers clear and easy
to read.`;

/* ---------- 2. DOM elements ---------- */
const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateBtn = document.getElementById("generateRoutine");
const clearAllBtn = document.getElementById("clearAll");
const rtlToggle = document.getElementById("rtlToggle");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");

/* ---------- 3. App state ---------- */
let allProducts = []; // every product from products.json
let selectedIds = []; // ids of selected products (saved in localStorage)
const messages = [{ role: "system", content: SYSTEM_PROMPT }]; // full chat history

// Load saved selections from localStorage (if any)
try {
  selectedIds = JSON.parse(localStorage.getItem("selectedIds")) || [];
} catch (error) {
  selectedIds = [];
}

/* ---------- 4. Load products ---------- */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* ---------- 5. Show products in the grid ---------- */
function displayProducts(products) {
  if (products.length === 0) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">No products found</div>
    `;
    return;
  }

  productsContainer.innerHTML = products
    .map((product) => {
      // Add the "selected" class if this product is selected
      const isSelected = selectedIds.includes(product.id);
      return `
        <div class="product-card ${isSelected ? "selected" : ""}"
             data-id="${product.id}" tabindex="0" role="button"
             aria-pressed="${isSelected}">
          <img src="${product.image}" alt="${product.name}">
          <div class="product-info">
            <h3>${product.brand}</h3>
            <p>${product.name}</p>
            <button class="desc-btn" data-desc-id="${product.id}" type="button">
              Details
            </button>
          </div>
          <div class="description" id="desc-${product.id}">
            ${product.description}
          </div>
        </div>
      `;
    })
    .join("");
}
/* ---------- 6. Filter by category AND search text ---------- */
function updateGrid() {
  const category = categoryFilter.value;
  const searchText = productSearch.value.trim().toLowerCase();

  // Show the placeholder until the user picks a category or types a search
  if (!category && !searchText) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        Select a category or search to view products
      </div>
    `;
    return;
  }

  // Split the search into separate words, e.g. "cerave cleanser" -> ["cerave", "cleanser"]
  const searchWords = searchText.split(/\s+/).filter(Boolean);

  const filtered = allProducts.filter((product) => {
    // Category matches if none chosen, or if it equals the chosen one
    const matchesCategory = !category || product.category === category;

    // Combine everything searchable into one lowercase string
    const text =
      `${product.name} ${product.brand} ${product.category} ${product.description}`.toLowerCase();

    // Every typed word must appear somewhere in that text
    const matchesSearch = searchWords.every((word) => text.includes(word));

    return matchesCategory && matchesSearch;
  });

  displayProducts(filtered);
}

categoryFilter.addEventListener("change", updateGrid);
productSearch.addEventListener("input", updateGrid);

/* ---------- 7. Select / unselect products ---------- */
function toggleProduct(id) {
  if (selectedIds.includes(id)) {
    // Remove it
    selectedIds = selectedIds.filter((savedId) => savedId !== id);
  } else {
    // Add it
    selectedIds.push(id);
  }
  saveSelections();
  updateSelectedList();
  updateGrid(); // refresh so the highlight updates
}

function saveSelections() {
  localStorage.setItem("selectedIds", JSON.stringify(selectedIds));
}

/* One click listener for the whole grid (event delegation) */
productsContainer.addEventListener("click", (e) => {
  // Details button: show/hide the description only
  const descBtn = e.target.closest(".desc-btn");
  if (descBtn) {
    const card = descBtn.closest(".product-card");
    card.classList.toggle("show-desc");
    return;
  }

  // Otherwise, a click on the card toggles selection
  const card = e.target.closest(".product-card");
  if (card) {
    toggleProduct(Number(card.dataset.id));
  }
});

/* Keyboard support: Enter or Space selects a focused card */
productsContainer.addEventListener("keydown", (e) => {
  const card = e.target.closest(".product-card");
  if (card && e.target === card && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    toggleProduct(Number(card.dataset.id));
  }
});

/* ---------- 8. Selected products list ---------- */
function updateSelectedList() {
  const selectedProducts = allProducts.filter((p) =>
    selectedIds.includes(p.id),
  );

  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `<p class="empty-note">No products selected yet.</p>`;
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (p) => `
      <div class="selected-item">
        <img src="${p.image}" alt="${p.name}">
        <div class="selected-text">
          <strong>${p.brand}</strong>
          <span>${p.name}</span>
        </div>
        <button class="remove-btn" data-remove-id="${p.id}"
                aria-label="Remove ${p.name}" type="button">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `,
    )
    .join("");
}

/* Remove a single item from the selected list */
selectedProductsList.addEventListener("click", (e) => {
  const btn = e.target.closest(".remove-btn");
  if (btn) {
    toggleProduct(Number(btn.dataset.removeId));
  }
});

/* Clear all selections */
clearAllBtn.addEventListener("click", () => {
  selectedIds = [];
  saveSelections();
  updateSelectedList();
  updateGrid();
});

/* ---------- 9. Chat helpers ---------- */
function addMessage(role, text) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = text; // textContent is safer than innerHTML
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return div;
}
/* ---------- Turn the AI's Markdown into HTML ---------- */
function formatMarkdown(text) {
  // 1. Escape HTML first so nothing unsafe can sneak in
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 2. Links: [text](https://...)
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>',
  );

  // 3. Bold: **text**
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // 4. Italic: *text*
  html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");

  // 5. Go line by line to build headings, lists, and paragraphs
  const lines = html.split("\n");
  let output = "";
  let openList = null; // "ul", "ol", or null

  // Helper that closes a list if one is open
  function closeList() {
    if (openList) {
      output += `</${openList}>`;
      openList = null;
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // Blank line: skip it
    if (trimmed === "") continue;

    // Headings: # Title, ## Title, ### Title
    const heading = trimmed.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      closeList();
      output += `<h4>${heading[1]}</h4>`;
      continue;
    }

    // Divider line: ---
    if (/^-{3,}$/.test(trimmed)) {
      closeList();
      output += "<hr>";
      continue;
    }

    // Numbered list: 1. item
    const numbered = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numbered) {
      if (openList !== "ol") {
        closeList();
        output += "<ol>";
        openList = "ol";
      }
      // value keeps the number correct even if the list gets interrupted
      output += `<li value="${numbered[1]}">${numbered[2]}</li>`;
      continue;
    }

    // Bullet list: - item or * item
    const bullet = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      if (openList !== "ul") {
        closeList();
        output += "<ul>";
        openList = "ul";
      }
      output += `<li>${bullet[1]}</li>`;
      continue;
    }

    // Anything else is a normal paragraph
    closeList();
    output += `<p>${trimmed}</p>`;
  }

  closeList();
  return output;
}

/* ---------- Safely show text inside HTML ---------- */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ---------- Build the "Sources" list from the web search ---------- */
function formatSources(sources) {
  // No sources means the AI didn't search, so show nothing
  if (!sources || sources.length === 0) return "";

  const links = sources
    .map(
      (s) =>
        `<li><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.title)}</a></li>`,
    )
    .join("");

  return `<div class="sources"><strong>Sources</strong><ul>${links}</ul></div>`;
}

/* Send the whole conversation to the Cloudflare Worker */
async function askAI() {
  const thinking = addMessage("assistant", "Searching and thinking…");

  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messages }),
    });

    const data = await response.json();
    const message = data.choices[0].message;
    const reply = message.content;

    // Save the reply so the AI remembers it next time
    messages.push({ role: "assistant", content: reply });

    // Show the formatted reply, then the source links underneath
    thinking.innerHTML = formatMarkdown(reply) + formatSources(message.sources);
  } catch (error) {
    console.error(error);
    thinking.textContent =
      "Sorry, something went wrong. Please try again in a moment.";
    // Remove the failed user message so history stays clean
    messages.pop();
  }
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* ---------- 10. Generate Routine ---------- */
generateBtn.addEventListener("click", async () => {
  const selectedProducts = allProducts.filter((p) =>
    selectedIds.includes(p.id),
  );

  if (selectedProducts.length === 0) {
    addMessage("assistant", "Please select at least one product first.");
    return;
  }

  // Send only the fields the AI needs
  const productData = selectedProducts.map((p) => ({
    name: p.name,
    brand: p.brand,
    category: p.category,
    description: p.description,
  }));

  const prompt = `Please build a personalized routine using these products:\n${JSON.stringify(
    productData,
    null,
    2,
  )}`;

  addMessage("user", "Generate a routine with my selected products.");
  messages.push({ role: "user", content: prompt });
  generateBtn.disabled = true;
  await askAI();
  generateBtn.disabled = false;
});

/* ---------- 11. Follow-up questions ---------- */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = userInput.value.trim();
  if (!text) return;

  addMessage("user", text);
  messages.push({ role: "user", content: text });
  userInput.value = "";

  await askAI();
});

/* ---------- 12. RTL support ---------- */
function setDirection(dir) {
  document.documentElement.dir = dir;
  localStorage.setItem("direction", dir);
}

rtlToggle.addEventListener("click", () => {
  setDirection(document.documentElement.dir === "rtl" ? "ltr" : "rtl");
});

/* ---------- 13. Start the app ---------- */
async function init() {
  setDirection(localStorage.getItem("direction") || "ltr");
  allProducts = await loadProducts();
  updateSelectedList();
  updateGrid();
}

init();
