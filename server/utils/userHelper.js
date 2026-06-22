function sanitizeUser(user) {
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

module.exports = { sanitizeUser };
