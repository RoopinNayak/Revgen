// ─────────────────────────────────────────────
// RevGen — Synthetic Merchant Data Seed Script
// ─────────────────────────────────────────────
//
// Generates realistic e-commerce data with
// intentional purchasing patterns for the
// RevGen analytics engine to discover.
//
// Usage (from the database/ directory):
//
//   npm run seed        # Reset + seed the database
//   npm run verify      # Verify data only (no changes)
//
// Or directly:
//
//   node seed.js
//   node seed.js --verify
//
// ─────────────────────────────────────────────

const { Pool } = require('pg');

// Connection string — defaults to RevGen dev database
const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://postgres:dev@localhost:5433/revgen';

const pool = new Pool({ connectionString: DATABASE_URL });

// ─── Deterministic Random Number Generator ──
// Uses mulberry32 so the same seed always
// produces the same dataset. This makes
// debugging and demos reproducible.

const SEED = 42;

function createRNG(seed) {
  let s = seed | 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = createRNG(SEED);

// ─── Helper Functions ───────────────────────

function pick(arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

// Weighted random selection from an array of
// objects that each have a `.weight` property.
function weightedPick(items) {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let roll = rng() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

// Random date within a range (days ago)
function randomDate(daysAgoStart, daysAgoEnd) {
  const now = Date.now();
  const from = now - daysAgoStart * 86400000;
  const to = now - daysAgoEnd * 86400000;
  return new Date(from + rng() * (to - from));
}

// ─── Product Catalog (75 products) ──────────
// popularity: 1 = niche, 2 = average,
//             3 = popular, 5 = top seller

const PRODUCTS = [
  // ── Electronics (12) ──
  { name: 'Bluetooth Speaker', category: 'Electronics', price: 49.99, stock: 120, description: 'Portable wireless speaker with 12-hour battery life and IPX5 water resistance.', popularity: 3 },
  { name: 'Wireless Earbuds', category: 'Electronics', price: 79.99, stock: 200, description: 'True wireless earbuds with active noise cancellation and touch controls.', popularity: 3 },
  { name: 'Smart Watch', category: 'Electronics', price: 199.99, stock: 85, description: 'Fitness-focused smartwatch with heart rate monitoring and GPS tracking.', popularity: 2 },
  { name: 'Fitness Tracker', category: 'Electronics', price: 89.99, stock: 150, description: 'Slim fitness band with step counting, sleep tracking, and 7-day battery.', popularity: 2 },
  { name: 'USB-C Charger', category: 'Electronics', price: 24.99, stock: 300, description: '65W GaN USB-C fast charger compatible with laptops and smartphones.', popularity: 5 },
  { name: 'Power Bank', category: 'Electronics', price: 34.99, stock: 250, description: '20000mAh portable power bank with dual USB-C and USB-A output.', popularity: 3 },
  { name: 'Surge Protector', category: 'Electronics', price: 29.99, stock: 180, description: '6-outlet surge protector with USB ports and 1800-joule protection.', popularity: 2 },
  { name: 'HDMI Cable', category: 'Electronics', price: 12.99, stock: 400, description: '2-meter HDMI 2.1 cable supporting 4K 120Hz and 8K 60Hz.', popularity: 2 },
  { name: 'Headphones', category: 'Electronics', price: 149.99, stock: 130, description: 'Over-ear wireless headphones with ANC, 30-hour battery, and premium audio.', popularity: 5 },
  { name: 'Portable Radio', category: 'Electronics', price: 39.99, stock: 60, description: 'Compact AM/FM radio with Bluetooth connectivity and rechargeable battery.', popularity: 1 },
  { name: 'Digital Alarm Clock', category: 'Electronics', price: 27.99, stock: 90, description: 'LED display alarm clock with dual alarms, USB charging, and dimmer.', popularity: 1 },
  { name: 'Smart Plug', category: 'Electronics', price: 19.99, stock: 220, description: 'Wi-Fi smart plug with voice assistant support and energy monitoring.', popularity: 2 },

  // ── Computers (11) ──
  { name: 'Laptop', category: 'Computers', price: 899.99, stock: 50, description: '15.6-inch laptop with Intel i7, 16GB RAM, 512GB SSD, and FHD display.', popularity: 3 },
  { name: 'Desktop Monitor', category: 'Computers', price: 349.99, stock: 70, description: '27-inch 4K IPS monitor with HDR400, USB-C input, and adjustable stand.', popularity: 2 },
  { name: 'Mechanical Keyboard', category: 'Computers', price: 109.99, stock: 160, description: 'Full-size mechanical keyboard with Cherry MX switches and RGB backlight.', popularity: 3 },
  { name: 'Wireless Mouse', category: 'Computers', price: 39.99, stock: 280, description: 'Ergonomic wireless mouse with 4000 DPI sensor and silent clicks.', popularity: 5 },
  { name: 'Laptop Stand', category: 'Computers', price: 44.99, stock: 140, description: 'Adjustable aluminum laptop stand for improved ergonomics and airflow.', popularity: 2 },
  { name: 'Laptop Bag', category: 'Computers', price: 49.99, stock: 170, description: 'Padded laptop messenger bag fitting up to 15.6-inch with organizer pockets.', popularity: 3 },
  { name: 'Webcam', category: 'Computers', price: 69.99, stock: 110, description: '1080p HD webcam with auto-focus, built-in microphone, and privacy cover.', popularity: 2 },
  { name: 'External SSD', category: 'Computers', price: 89.99, stock: 100, description: '1TB portable SSD with USB 3.2 Gen 2 and read speeds up to 1050MB/s.', popularity: 2 },
  { name: 'USB Hub', category: 'Computers', price: 29.99, stock: 200, description: '7-port USB 3.0 hub with individual power switches and LED indicators.', popularity: 2 },
  { name: 'Laptop Cooling Pad', category: 'Computers', price: 34.99, stock: 90, description: 'Dual-fan cooling pad with adjustable height and blue LED lighting.', popularity: 1 },
  { name: 'Wireless Keyboard', category: 'Computers', price: 59.99, stock: 130, description: 'Compact wireless keyboard with low-profile keys and multi-device pairing.', popularity: 2 },

  // ── Mobile (10) ──
  { name: 'Smartphone', category: 'Mobile', price: 699.99, stock: 80, description: '6.5-inch AMOLED smartphone with 128GB storage, 48MP camera, and 5G.', popularity: 5 },
  { name: 'Phone Case', category: 'Mobile', price: 19.99, stock: 350, description: 'Shockproof clear phone case with raised edges and MagSafe compatibility.', popularity: 5 },
  { name: 'Screen Protector', category: 'Mobile', price: 9.99, stock: 500, description: 'Tempered glass screen protector with 9H hardness and oleophobic coating.', popularity: 3 },
  { name: 'Wireless Charger', category: 'Mobile', price: 34.99, stock: 180, description: '15W Qi wireless charging pad with LED indicator and non-slip base.', popularity: 2 },
  { name: 'Car Phone Mount', category: 'Mobile', price: 17.99, stock: 160, description: 'Magnetic car vent phone mount with 360-degree rotation.', popularity: 2 },
  { name: 'Phone Stand', category: 'Mobile', price: 14.99, stock: 200, description: 'Foldable aluminum phone and tablet stand for desk use.', popularity: 2 },
  { name: 'Portable Battery Case', category: 'Mobile', price: 39.99, stock: 70, description: 'Battery case with 5000mAh capacity for extended phone use.', popularity: 1 },
  { name: 'SIM Card Tool Kit', category: 'Mobile', price: 6.99, stock: 300, description: 'SIM card ejector tool kit with adapter set and storage case.', popularity: 1 },
  { name: 'Phone Grip Ring', category: 'Mobile', price: 8.99, stock: 250, description: 'Magnetic phone grip ring with kickstand and car mount compatibility.', popularity: 1 },
  { name: 'Mobile Gimbal', category: 'Mobile', price: 119.99, stock: 40, description: '3-axis smartphone gimbal stabilizer with gesture control and face tracking.', popularity: 1 },

  // ── Gaming (11) ──
  { name: 'Gaming Laptop', category: 'Gaming', price: 1299.99, stock: 30, description: '16-inch gaming laptop with RTX 4060, 165Hz display, and 1TB SSD.', popularity: 2 },
  { name: 'Gaming Mouse', category: 'Gaming', price: 59.99, stock: 190, description: 'Lightweight gaming mouse with 25K DPI sensor and programmable buttons.', popularity: 3 },
  { name: 'Gaming Keyboard', category: 'Gaming', price: 129.99, stock: 100, description: 'Compact 75-percent gaming keyboard with hot-swappable switches and RGB.', popularity: 2 },
  { name: 'Gaming Headset', category: 'Gaming', price: 89.99, stock: 120, description: '7.1 surround sound gaming headset with detachable noise-canceling mic.', popularity: 2 },
  { name: 'Gaming Monitor', category: 'Gaming', price: 449.99, stock: 45, description: '32-inch curved QHD gaming monitor with 165Hz and 1ms response time.', popularity: 2 },
  { name: 'Game Controller', category: 'Gaming', price: 54.99, stock: 150, description: 'Wireless game controller with hall-effect triggers and customizable buttons.', popularity: 2 },
  { name: 'Mouse Pad XL', category: 'Gaming', price: 24.99, stock: 200, description: 'Extended desk mouse pad (900x400mm) with stitched edges and non-slip rubber.', popularity: 2 },
  { name: 'RGB LED Strip', category: 'Gaming', price: 19.99, stock: 180, description: '2-meter RGB LED light strip with remote control and music sync modes.', popularity: 1 },
  { name: 'Gaming Chair', category: 'Gaming', price: 299.99, stock: 35, description: 'Ergonomic gaming chair with lumbar support, recline, and adjustable armrests.', popularity: 1 },
  { name: 'Capture Card', category: 'Gaming', price: 159.99, stock: 50, description: 'USB 3.0 capture card supporting 4K30 passthrough and 1080p60 recording.', popularity: 1 },
  { name: 'Gaming Desk Mat', category: 'Gaming', price: 29.99, stock: 120, description: 'Full-desk gaming mat with RGB edge lighting and USB passthrough.', popularity: 1 },

  // ── Photography (10) ──
  { name: 'Camera', category: 'Photography', price: 799.99, stock: 40, description: 'Mirrorless digital camera with 24.2MP sensor, 4K video, and Wi-Fi.', popularity: 2 },
  { name: 'Memory Card', category: 'Photography', price: 24.99, stock: 300, description: '128GB UHS-II SD card with 300MB/s read speed for 4K video recording.', popularity: 3 },
  { name: 'Camera Bag', category: 'Photography', price: 59.99, stock: 80, description: 'Weather-resistant camera backpack with padded dividers and laptop sleeve.', popularity: 2 },
  { name: 'Tripod', category: 'Photography', price: 79.99, stock: 70, description: 'Carbon fiber travel tripod with ball head and 360-degree panoramic base.', popularity: 2 },
  { name: 'Camera Lens 50mm', category: 'Photography', price: 249.99, stock: 35, description: '50mm f/1.8 prime lens with fast autofocus and beautiful bokeh.', popularity: 1 },
  { name: 'Camera Lens 85mm', category: 'Photography', price: 349.99, stock: 25, description: '85mm f/1.4 portrait lens with optical stabilization and weather sealing.', popularity: 1 },
  { name: 'Lens Filter Kit', category: 'Photography', price: 39.99, stock: 60, description: 'UV, CPL, and ND filter kit with protective carrying pouch.', popularity: 1 },
  { name: 'Camera Cleaning Kit', category: 'Photography', price: 14.99, stock: 150, description: 'Professional camera cleaning kit with air blower, brush, and lens pen.', popularity: 1 },
  { name: 'Photo Printer', category: 'Photography', price: 199.99, stock: 30, description: 'Compact photo printer with Wi-Fi and 4x6-inch dye-sublimation printing.', popularity: 1 },
  { name: 'Camera Strap', category: 'Photography', price: 19.99, stock: 100, description: 'Padded camera neck strap with quick-release buckles and anti-slip design.', popularity: 1 },

  // ── Home Appliances (11) ──
  { name: 'Coffee Maker', category: 'Home Appliances', price: 89.99, stock: 90, description: '12-cup programmable drip coffee maker with thermal carafe and brew timer.', popularity: 3 },
  { name: 'Coffee Beans 1kg', category: 'Home Appliances', price: 18.99, stock: 400, description: 'Premium medium-roast Arabica coffee beans, single-origin from Colombia.', popularity: 3 },
  { name: 'Air Purifier', category: 'Home Appliances', price: 179.99, stock: 50, description: 'HEPA air purifier for rooms up to 500 sq ft with air quality indicator.', popularity: 2 },
  { name: 'Robot Vacuum', category: 'Home Appliances', price: 349.99, stock: 40, description: 'Smart robot vacuum with LiDAR mapping, 2700Pa suction, and app control.', popularity: 2 },
  { name: 'Electric Kettle', category: 'Home Appliances', price: 39.99, stock: 120, description: '1.7L electric kettle with temperature presets and keep-warm function.', popularity: 2 },
  { name: 'Toaster', category: 'Home Appliances', price: 34.99, stock: 100, description: '2-slice wide-slot toaster with 7 browning settings and defrost mode.', popularity: 2 },
  { name: 'Blender', category: 'Home Appliances', price: 59.99, stock: 80, description: '1000W countertop blender with 64oz pitcher and 4 speed settings.', popularity: 2 },
  { name: 'Rice Cooker', category: 'Home Appliances', price: 49.99, stock: 70, description: '10-cup digital rice cooker with steamer basket and delay timer.', popularity: 1 },
  { name: 'Hand Mixer', category: 'Home Appliances', price: 29.99, stock: 90, description: '5-speed hand mixer with chrome beaters and snap-on storage case.', popularity: 1 },
  { name: 'Air Fryer', category: 'Home Appliances', price: 99.99, stock: 65, description: '5.8QT digital air fryer with 8 cooking presets and non-stick basket.', popularity: 2 },
  { name: 'Slow Cooker', category: 'Home Appliances', price: 44.99, stock: 55, description: '6QT programmable slow cooker with locking lid and 3 cooking modes.', popularity: 1 },

  // ── Accessories (10) ──
  { name: 'Backpack', category: 'Accessories', price: 69.99, stock: 110, description: 'Water-resistant tech backpack with padded laptop compartment and USB port.', popularity: 2 },
  { name: 'Desk Lamp', category: 'Accessories', price: 44.99, stock: 100, description: 'LED desk lamp with 5 brightness levels, color temperature control, and USB port.', popularity: 2 },
  { name: 'Cable Organizer', category: 'Accessories', price: 12.99, stock: 250, description: 'Silicone cable management clips for desk organization, pack of 5.', popularity: 2 },
  { name: 'Desk Organizer', category: 'Accessories', price: 24.99, stock: 120, description: 'Bamboo desk organizer with pen holder, phone stand, and storage slots.', popularity: 1 },
  { name: 'Mousepad', category: 'Accessories', price: 14.99, stock: 230, description: 'Premium cloth mousepad with stitched edges and non-slip rubber base.', popularity: 2 },
  { name: 'Monitor Light Bar', category: 'Accessories', price: 49.99, stock: 80, description: 'Screen-mounted LED light bar with auto-dimming and no screen glare.', popularity: 2 },
  { name: 'Wrist Rest', category: 'Accessories', price: 19.99, stock: 150, description: 'Memory foam keyboard wrist rest with cooling gel and anti-slip base.', popularity: 1 },
  { name: 'Portable Speaker Stand', category: 'Accessories', price: 29.99, stock: 60, description: 'Adjustable tripod stand for portable speakers with universal mount.', popularity: 1 },
  { name: 'Travel Adapter', category: 'Accessories', price: 22.99, stock: 170, description: 'Universal travel power adapter with USB-C and USB-A ports for 150+ countries.', popularity: 2 },
  { name: 'Notebook Stand', category: 'Accessories', price: 37.99, stock: 80, description: 'Portable folding notebook stand with 6 height adjustments and ventilation.', popularity: 1 },
];


// ─── Co-Purchase Patterns ───────────────────
// When a customer buys the "primary" product,
// they have a `rate` chance of also buying
// the "secondary" product in the same order.
//
// These patterns create the cross-sell signals
// that Day 2 analytics will discover.

const CO_PURCHASE_PATTERNS = [
  // ── Strong patterns (the 6 key relationships) ──
  { primary: 'Wireless Mouse',  secondary: 'Mechanical Keyboard', rate: 0.35 },
  { primary: 'Laptop',          secondary: 'Laptop Bag',           rate: 0.30 },
  { primary: 'Smartphone',      secondary: 'Phone Case',           rate: 0.40 },
  { primary: 'Camera',          secondary: 'Memory Card',          rate: 0.35 },
  { primary: 'Gaming Laptop',   secondary: 'Gaming Mouse',         rate: 0.30 },
  { primary: 'Coffee Maker',    secondary: 'Coffee Beans 1kg',     rate: 0.35 },

  // ── Medium patterns (weaker but still meaningful) ──
  { primary: 'Camera',              secondary: 'Camera Bag',       rate: 0.18 },
  { primary: 'Laptop',              secondary: 'Laptop Stand',     rate: 0.15 },
  { primary: 'Smartphone',          secondary: 'Screen Protector', rate: 0.25 },
  { primary: 'Gaming Mouse',        secondary: 'Mouse Pad XL',    rate: 0.20 },
  { primary: 'Mechanical Keyboard', secondary: 'Wrist Rest',      rate: 0.15 },
  { primary: 'Desktop Monitor',     secondary: 'Monitor Light Bar', rate: 0.15 },
  { primary: 'Gaming Laptop',       secondary: 'Gaming Headset',  rate: 0.18 },
  { primary: 'Camera',              secondary: 'Tripod',          rate: 0.15 },
];


// ─── Customer Name Data ─────────────────────

const FIRST_NAMES = [
  'Aarav', 'Aditi', 'Akash', 'Amit', 'Ananya', 'Arjun', 'Arun',
  'Bhavna', 'Chetan', 'Deepa', 'Devika', 'Dhruv', 'Divya',
  'Farhan', 'Gauri', 'Harsh', 'Isha', 'Jaya', 'Kabir', 'Kavya',
  'Kiran', 'Krish', 'Lakshmi', 'Manish', 'Meera', 'Mohan',
  'Nandini', 'Neha', 'Nikhil', 'Nisha', 'Omkar', 'Pallavi',
  'Pooja', 'Priya', 'Rahul', 'Rajesh', 'Ravi', 'Rekha', 'Rohan',
  'Sakshi', 'Sandeep', 'Sanjay', 'Sapna', 'Shreya', 'Siddharth',
  'Simran', 'Sneha', 'Sunil', 'Suman', 'Tanvi', 'Usha', 'Varun',
  'Vidya', 'Vikram', 'Vinay', 'Yash', 'Zara', 'Aditya', 'Ankita',
  'Gaurav',
];

const LAST_NAMES = [
  'Agarwal', 'Bhat', 'Chakraborty', 'Das', 'Desai', 'Doshi',
  'Gupta', 'Iyer', 'Jain', 'Joshi', 'Kapoor', 'Khan', 'Kumar',
  'Mehta', 'Mishra', 'Mukherjee', 'Nair', 'Patel', 'Pillai',
  'Prasad', 'Rao', 'Reddy', 'Saxena', 'Shah', 'Sharma', 'Shetty',
  'Singh', 'Srinivasan', 'Thakur', 'Trivedi', 'Varma', 'Verma',
  'Yadav', 'Banerjee', 'Choudhury', 'Kulkarni', 'Menon', 'Pandey',
  'Rathore', 'Tiwari',
];

const EMAIL_DOMAINS = [
  'email.com', 'mail.in', 'inbox.co', 'webmail.com', 'fastmail.net',
];


// ─── Data Generation ────────────────────────

// Assign IDs and a created_at date to products
function generateProducts() {
  const createdAt = randomDate(250, 230); // ~8 months ago
  return PRODUCTS.map((p, idx) => ({
    id: idx + 1,
    name: p.name,
    category: p.category,
    price: p.price,
    stock: p.stock,
    description: p.description,
    popularity: p.popularity,
    created_at: createdAt,
  }));
}

// Generate ~750 unique customers
function generateCustomers(count) {
  const customers = [];
  const usedEmails = new Set();

  for (let i = 1; i <= count; i++) {
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const name = `${firstName} ${lastName}`;

    // Generate a unique email
    let email;
    let attempt = 0;
    do {
      const suffix = attempt === 0 ? '' : `${attempt}`;
      const domain = pick(EMAIL_DOMAINS);
      email = `${firstName.toLowerCase()}${suffix}.${lastName.toLowerCase()}@${domain}`;
      attempt++;
    } while (usedEmails.has(email));
    usedEmails.add(email);

    // Segment distribution: 25% budget, 55% regular, 20% premium
    const roll = rng();
    let segment;
    if (roll < 0.25) segment = 'budget';
    else if (roll < 0.80) segment = 'regular';
    else segment = 'premium';

    customers.push({
      id: i,
      name,
      email,
      segment,
      created_at: randomDate(270, 200), // 7–9 months ago
    });
  }

  return customers;
}

// Generate orders and order_items together
function generateOrders(products, customers, numOrders) {
  const orders = [];
  const orderItems = [];
  let orderItemId = 1;

  // Build lookup tables
  const productByName = {};
  products.forEach((p) => (productByName[p.name] = p));

  // Split products into price tiers for segment-based selection
  const lowPrice = products.filter((p) => p.price < 50);
  const midPrice = products.filter((p) => p.price >= 50 && p.price <= 200);
  const highPrice = products.filter((p) => p.price > 200);

  // Add popularity weights to each tier
  const weighted = (arr) => arr.map((p) => ({ ...p, weight: p.popularity }));
  const lowWeighted = weighted(lowPrice);
  const midWeighted = weighted(midPrice);
  const highWeighted = weighted(highPrice);
  const allWeighted = weighted(products);

  for (let orderId = 1; orderId <= numOrders; orderId++) {
    // 1. Pick a random customer
    const customer = customers[Math.floor(rng() * customers.length)];

    // 2. Choose a price tier based on customer segment
    let productPool;
    const tierRoll = rng();

    if (customer.segment === 'budget') {
      // Budget: 70% cheap, 25% mid, 5% expensive
      if (tierRoll < 0.70) productPool = lowWeighted;
      else if (tierRoll < 0.95) productPool = midWeighted;
      else productPool = highWeighted;
    } else if (customer.segment === 'premium') {
      // Premium: 10% cheap, 30% mid, 60% expensive
      if (tierRoll < 0.10) productPool = lowWeighted;
      else if (tierRoll < 0.40) productPool = midWeighted;
      else productPool = highWeighted;
    } else {
      // Regular: 30% cheap, 50% mid, 20% expensive
      if (tierRoll < 0.30) productPool = lowWeighted;
      else if (tierRoll < 0.80) productPool = midWeighted;
      else productPool = highWeighted;
    }

    // 3. Pick the primary product
    const primary = weightedPick(productPool);
    const itemsInOrder = [primary];
    const addedIds = new Set([primary.id]);

    // 4. Apply co-purchase patterns
    for (const pattern of CO_PURCHASE_PATTERNS) {
      if (pattern.primary === primary.name && rng() < pattern.rate) {
        const secondary = productByName[pattern.secondary];
        if (secondary && !addedIds.has(secondary.id)) {
          itemsInOrder.push(secondary);
          addedIds.add(secondary.id);
        }
      }
    }

    // 5. Maybe add 1–2 random extra products (noise)
    if (rng() < 0.55) {
      const extra = weightedPick(allWeighted);
      if (!addedIds.has(extra.id)) {
        itemsInOrder.push(extra);
        addedIds.add(extra.id);
      }
    }
    if (rng() < 0.25) {
      const extra = weightedPick(allWeighted);
      if (!addedIds.has(extra.id)) {
        itemsInOrder.push(extra);
        addedIds.add(extra.id);
      }
    }

    // 6. Create order items with realistic quantities and price variation
    let totalAmount = 0;
    const itemsForThisOrder = [];

    for (const product of itemsInOrder) {
      // Quantity: 85% chance of 1, then 70/30 split between 2 and 3
      const quantity = rng() < 0.85 ? 1 : rng() < 0.70 ? 2 : 3;

      // Small ±5% price variation to simulate historical price changes
      const variation = 1 + (rng() * 0.10 - 0.05);
      const purchasePrice = +(product.price * variation).toFixed(2);

      const lineTotal = +(quantity * purchasePrice).toFixed(2);
      totalAmount += lineTotal;

      itemsForThisOrder.push({
        id: orderItemId++,
        order_id: orderId,
        product_id: product.id,
        quantity,
        price: purchasePrice,
      });
    }

    totalAmount = +totalAmount.toFixed(2);

    // 7. Create the order
    orders.push({
      id: orderId,
      customer_id: customer.id,
      total_amount: totalAmount,
      created_at: randomDate(180, 1), // Last 6 months
    });

    orderItems.push(...itemsForThisOrder);
  }

  return { orders, orderItems };
}


// ─── Batch Insert Helper ────────────────────
// Inserts rows in chunks for performance.
// `rows` is an array of arrays (values only).

async function batchInsert(client, sql, rows, chunkSize = 50) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const colCount = chunk[0].length;
    const valueClauses = [];
    const params = [];

    chunk.forEach((row, rowIdx) => {
      const placeholders = [];
      for (let c = 0; c < colCount; c++) {
        params.push(row[c]);
        placeholders.push(`$${rowIdx * colCount + c + 1}`);
      }
      valueClauses.push(`(${placeholders.join(', ')})`);
    });

    await client.query(`${sql} ${valueClauses.join(', ')}`, params);
  }
}


// ─── Reset Database ─────────────────────────
// Clears all data and resets ID sequences.
// Deletes in foreign-key-safe order.

async function resetDatabase(client) {
  console.log('  Clearing existing data...');

  await client.query('DELETE FROM order_items');
  await client.query('DELETE FROM orders');
  await client.query('DELETE FROM customers');
  await client.query('DELETE FROM products');
  await client.query('DELETE FROM campaigns');
  await client.query('DELETE FROM audit_logs');

  // Reset auto-increment sequences to 1
  await client.query('ALTER SEQUENCE products_id_seq RESTART WITH 1');
  await client.query('ALTER SEQUENCE customers_id_seq RESTART WITH 1');
  await client.query('ALTER SEQUENCE orders_id_seq RESTART WITH 1');
  await client.query('ALTER SEQUENCE order_items_id_seq RESTART WITH 1');
  await client.query('ALTER SEQUENCE campaigns_id_seq RESTART WITH 1');
  await client.query('ALTER SEQUENCE audit_logs_id_seq RESTART WITH 1');

  console.log('  Database reset complete.');
}


// ─── Verification ───────────────────────────

async function verify() {
  console.log('\n══════════════════════════════════════════');
  console.log('  VERIFICATION');
  console.log('══════════════════════════════════════════\n');

  // Row counts
  console.log('─── Row Counts ────────────────────────────\n');
  const tables = ['products', 'customers', 'orders', 'order_items', 'campaigns', 'audit_logs'];
  for (const table of tables) {
    const res = await pool.query(`SELECT COUNT(*) FROM ${table}`);
    console.log(`  ${table.padEnd(14)} ${res.rows[0].count} rows`);
  }

  // Integrity checks
  console.log('\n─── Integrity Checks ──────────────────────\n');

  const checks = [
    {
      label: 'Orphaned order items (no matching order)',
      sql: `SELECT COUNT(*) FROM order_items oi LEFT JOIN orders o ON oi.order_id = o.id WHERE o.id IS NULL`,
    },
    {
      label: 'Orphaned orders (no matching customer)',
      sql: `SELECT COUNT(*) FROM orders o LEFT JOIN customers c ON o.customer_id = c.id WHERE c.id IS NULL`,
    },
    {
      label: 'Negative prices in order_items',
      sql: `SELECT COUNT(*) FROM order_items WHERE price < 0`,
    },
    {
      label: 'Invalid quantities (≤ 0)',
      sql: `SELECT COUNT(*) FROM order_items WHERE quantity <= 0`,
    },
    {
      label: 'Orders without any items',
      sql: `SELECT COUNT(*) FROM orders o WHERE NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id)`,
    },
    {
      label: 'Orders with mismatched totals (> ₹0.01 diff)',
      sql: `SELECT COUNT(*) FROM orders o WHERE ABS(o.total_amount - (SELECT COALESCE(SUM(oi.quantity * oi.price), 0) FROM order_items oi WHERE oi.order_id = o.id)) > 0.01`,
    },
  ];

  let allPassed = true;
  for (const check of checks) {
    const res = await pool.query(check.sql);
    const count = parseInt(res.rows[0].count);
    const status = count === 0 ? '✅ PASS' : '❌ FAIL';
    if (count !== 0) allPassed = false;
    console.log(`  ${status}  ${check.label}: ${count}`);
  }

  // Co-purchase analysis
  console.log('\n─── Co-Purchase Analysis ──────────────────\n');

  const pairs = [
    ['Wireless Mouse', 'Mechanical Keyboard'],
    ['Laptop', 'Laptop Bag'],
    ['Smartphone', 'Phone Case'],
    ['Camera', 'Memory Card'],
    ['Gaming Laptop', 'Gaming Mouse'],
    ['Coffee Maker', 'Coffee Beans 1kg'],
  ];

  for (const [a, b] of pairs) {
    const countA = await pool.query(
      `SELECT COUNT(DISTINCT oi.order_id) AS count
       FROM order_items oi JOIN products p ON oi.product_id = p.id
       WHERE p.name = $1`,
      [a]
    );

    const countBoth = await pool.query(
      `SELECT COUNT(*) AS count FROM (
         SELECT oi.order_id FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE p.name = $1
         INTERSECT
         SELECT oi.order_id FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE p.name = $2
       ) AS both_products`,
      [a, b]
    );

    const ordersA = parseInt(countA.rows[0].count);
    const ordersBoth = parseInt(countBoth.rows[0].count);
    const rate = ordersA > 0 ? ((ordersBoth / ordersA) * 100).toFixed(1) : '0.0';

    console.log(`  ${a} → ${b}`);
    console.log(`    Orders with ${a}: ${ordersA}`);
    console.log(`    Orders with both: ${ordersBoth}`);
    console.log(`    Cross-sell rate: ${rate}%\n`);
  }

  // Customer segment distribution
  console.log('─── Customer Segments ─────────────────────\n');
  const segments = await pool.query(
    `SELECT segment, COUNT(*) AS count FROM customers GROUP BY segment ORDER BY segment`
  );
  for (const row of segments.rows) {
    console.log(`  ${row.segment.padEnd(10)} ${row.count} customers`);
  }

  // Top 10 products by order count
  console.log('\n─── Top 10 Products by Order Count ────────\n');
  const topProducts = await pool.query(
    `SELECT p.name, COUNT(DISTINCT oi.order_id) AS order_count
     FROM order_items oi JOIN products p ON oi.product_id = p.id
     GROUP BY p.name ORDER BY order_count DESC LIMIT 10`
  );
  for (const row of topProducts.rows) {
    console.log(`  ${row.name.padEnd(25)} ${row.order_count} orders`);
  }

  console.log('\n══════════════════════════════════════════');
  console.log(allPassed ? '  ALL CHECKS PASSED ✅' : '  SOME CHECKS FAILED ❌');
  console.log('══════════════════════════════════════════\n');
}


// ─── Main Seed Function ─────────────────────

async function seed() {
  console.log('\n══════════════════════════════════════════');
  console.log('  RevGen — Seeding Database');
  console.log('══════════════════════════════════════════\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Reset
    await resetDatabase(client);

    // 2. Generate data in memory
    console.log('\n  Generating synthetic data...');
    const products = generateProducts();
    console.log(`    Products:    ${products.length}`);

    const customers = generateCustomers(750);
    console.log(`    Customers:   ${customers.length}`);

    const { orders, orderItems } = generateOrders(products, customers, 3000);
    console.log(`    Orders:      ${orders.length}`);
    console.log(`    Order Items: ${orderItems.length}`);

    // 3. Insert products
    console.log('\n  Inserting products...');
    await batchInsert(
      client,
      'INSERT INTO products (id, name, category, price, stock, description, created_at) VALUES',
      products.map((p) => [p.id, p.name, p.category, p.price, p.stock, p.description, p.created_at])
    );

    // 4. Insert customers
    console.log('  Inserting customers...');
    await batchInsert(
      client,
      'INSERT INTO customers (id, name, email, segment, created_at) VALUES',
      customers.map((c) => [c.id, c.name, c.email, c.segment, c.created_at])
    );

    // 5. Insert orders
    console.log('  Inserting orders...');
    await batchInsert(
      client,
      'INSERT INTO orders (id, customer_id, total_amount, created_at) VALUES',
      orders.map((o) => [o.id, o.customer_id, o.total_amount, o.created_at])
    );

    // 6. Insert order items
    console.log('  Inserting order items...');
    await batchInsert(
      client,
      'INSERT INTO order_items (id, order_id, product_id, quantity, price) VALUES',
      orderItems.map((oi) => [oi.id, oi.order_id, oi.product_id, oi.quantity, oi.price])
    );

    // 7. Update sequences to match inserted IDs
    await client.query(`SELECT setval('products_id_seq', (SELECT MAX(id) FROM products))`);
    await client.query(`SELECT setval('customers_id_seq', (SELECT MAX(id) FROM customers))`);
    await client.query(`SELECT setval('orders_id_seq', (SELECT MAX(id) FROM orders))`);
    await client.query(`SELECT setval('order_items_id_seq', (SELECT MAX(id) FROM order_items))`);

    await client.query('COMMIT');
    console.log('\n  ✅ Seed complete!\n');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n  ❌ Seed failed! Transaction rolled back.');
    console.error(`  Error: ${error.message}\n`);
    throw error;
  } finally {
    client.release();
  }
}


// ─── Entry Point ────────────────────────────

async function main() {
  try {
    const verifyOnly = process.argv.includes('--verify');

    if (verifyOnly) {
      console.log('\n  Running verification only (no data changes)...');
    } else {
      await seed();
    }

    await verify();
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
