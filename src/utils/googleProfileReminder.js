const GOOGLE_PROFILE_REMINDER_KEY = 'google_profile_completion_reminder';

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
