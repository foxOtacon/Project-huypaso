const test = require("node:test");
const assert = require("node:assert/strict");

const recommendationsRouter = require("./productRecommendations");

const {
  calculateRecommendationScore,
  getRecommendationReason,
  normalizeLimit,
  serializeRecommendation,
} = recommendationsRouter.__test;

test("normalizeLimit keeps recommendation sizes between one and five", () => {
  assert.equal(normalizeLimit(undefined), 3);
  assert.equal(normalizeLimit(0), 1);
  assert.equal(normalizeLimit("4"), 4);
  assert.equal(normalizeLimit(99), 5);
});

test("personal and category behavior increase a recommendation score", () => {
  assert.equal(calculateRecommendationScore({
    personal_view_count: 2,
    category_affinity: 3,
    global_views: 4,
  }), 61);
  assert.equal(calculateRecommendationScore({
    personal_view_count: 0,
    category_affinity: 0,
    global_views: 5,
  }), 40);
  assert.equal(calculateRecommendationScore({
    personal_view_count: 100,
    category_affinity: 100,
    global_views: 100,
  }), 100);
});

test("recommendation reasons prefer the strongest available user signal", () => {
  assert.equal(
    getRecommendationReason({ personal_view_count: 1, category_affinity: 10 }),
    "จากสินค้าที่คุณเคยเข้าชมและสนใจ",
  );
  assert.equal(
    getRecommendationReason({ personal_view_count: 0, category_affinity: 2 }),
    "อยู่ในหมวดหมู่สินค้าที่คุณสนใจ",
  );
  assert.equal(
    getRecommendationReason({ personal_view_count: 0, category_affinity: 0, global_views: 3 }),
    "สินค้าที่กำลังได้รับความสนใจจากลูกค้า",
  );
});

test("serializeRecommendation normalizes database numeric values", () => {
  const item = serializeRecommendation({
    product_id: "12",
    product_name: "กาแฟชุมชน",
    category_id: "3",
    category_name: "กาแฟ",
    description: null,
    price: "150.00",
    unit: "ถุง",
    image_url: "/coffee.png",
    production_source: "ห้วยหยวกป่าโซ",
    stock_quantity: "8",
    status: "active",
    personal_view_count: 1,
    category_affinity: 2,
    global_views: 3,
  });

  assert.equal(item.product_id, 12);
  assert.equal(item.category_id, 3);
  assert.equal(item.price, 150);
  assert.equal(item.stock_quantity, 8);
  assert.equal(item.reason, "จากสินค้าที่คุณเคยเข้าชมและสนใจ");
});
