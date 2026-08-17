const test = require("node:test");
const assert = require("node:assert/strict");
const { isTransientDatabaseError } = require("./orderExpirationService");

test("treats Supabase auth_query secret timeout as transient", () => {
  assert.equal(isTransientDatabaseError({ code: "EAUTHQUERY", message: "auth_query secret check timed out" }), true);
});

test("treats connection failures as transient", () => {
  assert.equal(isTransientDatabaseError({ code: "ECONNRESET" }), true);
  assert.equal(isTransientDatabaseError({ code: "57P03" }), true);
});

test("does not retry SQL or constraint errors", () => {
  assert.equal(isTransientDatabaseError({ code: "23505" }), false);
  assert.equal(isTransientDatabaseError({ code: "42601" }), false);
});