const GOOGLE_PROFILE_REMINDER_KEY = 'google_profile_completion_reminder';
const GOOGLE_ADDRESS_COMPLETION_KEY = 'google_address_completion_pending';

export function queueGoogleAddressCompletion(user) {
  // The dedicated profile route replaces the old reminder modal for Google sign-in.
  sessionStorage.removeItem(GOOGLE_PROFILE_REMINDER_KEY);
  const needsAddress = user?.role !== 'admin' && !String(user?.address || '').trim();

  if (!needsAddress) {
    sessionStorage.removeItem(GOOGLE_ADDRESS_COMPLETION_KEY);
    return false;
  }

  sessionStorage.setItem(GOOGLE_ADDRESS_COMPLETION_KEY, String(user?.user_id || ''));
  return true;
}

export function hasPendingGoogleAddressCompletion(user) {
  const pendingUserId = sessionStorage.getItem(GOOGLE_ADDRESS_COMPLETION_KEY);
  return Boolean(pendingUserId) && pendingUserId === String(user?.user_id || '');
}

export function clearGoogleAddressCompletion() {
  sessionStorage.removeItem(GOOGLE_ADDRESS_COMPLETION_KEY);
}

export function queueGoogleProfileReminder(user) {
  const missingFields = [];

  if (!String(user?.phone || '').trim()) missingFields.push('เบอร์โทรศัพท์');
  if (!String(user?.address || '').trim()) missingFields.push('ที่อยู่');

  if (user?.role === 'admin') {
    sessionStorage.removeItem(GOOGLE_PROFILE_REMINDER_KEY);
    return false;
  }

  sessionStorage.setItem(
    GOOGLE_PROFILE_REMINDER_KEY,
    JSON.stringify({ userId: user?.user_id, missingFields }),
  );
  return true;
}

export function readGoogleProfileReminder(user) {
  try {
    const reminder = JSON.parse(sessionStorage.getItem(GOOGLE_PROFILE_REMINDER_KEY) || 'null');

    if (!reminder || String(reminder.userId) !== String(user?.user_id)) return null;
    return reminder;
  } catch {
    sessionStorage.removeItem(GOOGLE_PROFILE_REMINDER_KEY);
    return null;
  }
}

export function clearGoogleProfileReminder() {
  sessionStorage.removeItem(GOOGLE_PROFILE_REMINDER_KEY);
}
