import { useState } from 'react';
import {
  clearGoogleProfileReminder,
  readGoogleProfileReminder,
} from '../utils/googleProfileReminder';
import './CustomerNavbar.css';

export default function GoogleProfileAlert({ user, onNavigate }) {
  const [dismissed, setDismissed] = useState(false);
  const profileReminder = dismissed ? null : readGoogleProfileReminder(user);
  const needsProfileCompletion = Boolean(profileReminder?.missingFields?.length);

  if (!profileReminder) return null;

  function closeReminder() {
    clearGoogleProfileReminder();
    setDismissed(true);
  }

  function goToCompleteProfile() {
    closeReminder();
    onNavigate('/profile');
  }

  return (
    <div
      className="google-profile-alert-backdrop"
      role="presentation"
      onMouseDown={closeReminder}
    >
      <section
        className="google-profile-alert"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="google-profile-alert-title"
        aria-describedby="google-profile-alert-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="google-profile-alert-close"
          aria-label="ปิดการแจ้งเตือน"
          onClick={closeReminder}
        >
          ×
        </button>
        <div
          className={`google-profile-alert-icon${needsProfileCompletion ? '' : ' is-success'}`}
          aria-hidden="true"
        >
          {needsProfileCompletion ? '!' : '✓'}
        </div>
        <p className="google-profile-alert-eyebrow">เข้าสู่ระบบด้วย Google สำเร็จ</p>
        <h2 id="google-profile-alert-title">
          {needsProfileCompletion ? 'กรุณากรอกข้อมูลโปรไฟล์ให้ครบถ้วน' : 'ข้อมูลโปรไฟล์ครบถ้วนแล้ว'}
        </h2>
        <p id="google-profile-alert-description">
          {needsProfileCompletion
            ? 'กรุณาเพิ่มข้อมูลสำหรับการติดต่อและที่อยู่จัดส่งก่อนเริ่มสั่งซื้อสินค้า'
            : 'บัญชี Google ของคุณพร้อมใช้งานและมีข้อมูลที่จำเป็นครบแล้ว'}
        </p>
        {needsProfileCompletion ? (
          <div className="google-profile-alert-fields">
            {profileReminder.missingFields.map((field) => (
              <span key={field}>• {field}</span>
            ))}
          </div>
        ) : null}
        <div className={`google-profile-alert-actions${needsProfileCompletion ? '' : ' is-complete'}`}>
          {needsProfileCompletion ? (
            <>
              <button type="button" onClick={closeReminder}>ไว้กรอกภายหลัง</button>
              <button type="button" autoFocus onClick={goToCompleteProfile}>ไปกรอกที่หน้าโปรไฟล์</button>
            </>
          ) : (
            <button type="button" autoFocus onClick={closeReminder}>ตกลง</button>
          )}
        </div>
      </section>
    </div>
  );
}
