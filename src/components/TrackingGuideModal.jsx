import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function TrackingGuideModal({
  trackingNumber,
  providerName,
  provider,
  copyStatus,
  onCopy,
  onOpenWebsite,
  onClose,
}) {
  const dialogRef = useRef(null)
  const closeButtonRef = useRef(null)
  const onCloseRef = useRef(onClose)

  const companyName = providerName || provider?.name || 'ไม่ทราบบริษัทขนส่ง'
  const canOpenWebsite = Boolean(provider?.known && provider?.url)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previouslyFocusedElement = document.activeElement
    const previousBodyOverflow = document.body.style.overflow
    const dialogElement = dialogRef.current

    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current?.()
        return
      }

      if (event.key !== 'Tab' || !dialogElement) return

      const focusableElements = Array.from(
        dialogElement.querySelectorAll(FOCUSABLE_SELECTOR),
      ).filter((element) => element.getAttribute('aria-hidden') !== 'true')

      if (focusableElements.length === 0) {
        event.preventDefault()
        dialogElement.focus()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      const focusIsInsideDialog = dialogElement.contains(document.activeElement)

      if (event.shiftKey && (!focusIsInsideDialog || document.activeElement === firstElement)) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && (!focusIsInsideDialog || document.activeElement === lastElement)) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousBodyOverflow
      previouslyFocusedElement?.focus?.()
    }
  }, [])

  const copyMessage = {
    pending: 'กำลังคัดลอกเลขพัสดุ…',
    success: 'คัดลอกเลขพัสดุแล้ว',
    error: 'ไม่สามารถคัดลอกอัตโนมัติได้',
  }[copyStatus]

  const copyButtonLabel = copyStatus === 'error'
    ? 'ลองคัดลอกอีกครั้ง'
    : copyStatus === 'pending'
      ? 'กำลังคัดลอก…'
      : 'คัดลอกอีกครั้ง'

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose?.()
    }
  }

  return (
    <div className="tracking-guide-backdrop" role="presentation" onClick={handleBackdropClick}>
      <section
        id="tracking-guide-dialog"
        ref={dialogRef}
        className="tracking-guide-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tracking-guide-title"
        aria-describedby="tracking-guide-description"
        tabIndex={-1}
      >
        <header className="tracking-guide-header">
          <div>
            <p
              className={`tracking-guide-copy-status tracking-guide-copy-status--${copyStatus || 'pending'}`}
              role="status"
              aria-live="polite"
            >
              {copyMessage || 'กำลังเตรียมเลขพัสดุ…'}
            </p>
            <h2 id="tracking-guide-title" className="tracking-guide-title">
              วิธีติดตามพัสดุ
            </h2>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            className="tracking-guide-close-icon"
            onClick={onClose}
            aria-label="ปิดหน้าต่างแนะนำการติดตามพัสดุ"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div id="tracking-guide-description" className="tracking-guide-details">
          {copyStatus === 'error' && (
            <p className="tracking-guide-copy-error">
              กรุณาเลือกเลขพัสดุด้านล่างแล้วคัดลอกด้วยตนเอง
            </p>
          )}

          <dl className="tracking-guide-summary">
            <div className="tracking-guide-summary-row">
              <dt>เลขพัสดุ</dt>
              <dd className="tracking-guide-number">{trackingNumber}</dd>
            </div>
            <div className="tracking-guide-summary-row">
              <dt>บริษัทขนส่ง</dt>
              <dd>{companyName}</dd>
            </div>
          </dl>

          {!canOpenWebsite && (
            <p className="tracking-guide-generic-message">
              ไม่พบเว็บไซต์ติดตามที่รองรับ กรุณาค้นหาชื่อบริษัทขนส่งด้วยตนเอง
            </p>
          )}

          <div className="tracking-guide-instructions">
            <h3>นำเลขพัสดุไปติดตามอย่างไร</h3>
            <ol>
              <li>
                {canOpenWebsite
                  ? 'กดปุ่ม “เปิดเว็บไซต์บริษัทขนส่ง”'
                  : <>ค้นหาชื่อบริษัทขนส่ง “<strong>{companyName}</strong>” ผ่านเบราว์เซอร์</>}
              </li>
              <li>กดช่องค้นหาหมายเลขพัสดุในเว็บไซต์ปลายทาง</li>
              <li>
                <strong>Desktop:</strong> กด Ctrl + V หรือ Command + V
              </li>
              <li>
                <strong>Mobile:</strong> แตะค้างในช่องแล้วเลือก “วาง”
              </li>
              <li>กดปุ่มค้นหาหรือติดตาม</li>
            </ol>
          </div>
        </div>

        <footer className="tracking-guide-actions">
          <button
            type="button"
            className="tracking-guide-button tracking-guide-button--secondary"
            onClick={onCopy}
            disabled={copyStatus === 'pending'}
          >
            {copyButtonLabel}
          </button>
          <button
            type="button"
            className="tracking-guide-button tracking-guide-button--primary"
            onClick={onOpenWebsite}
            disabled={!canOpenWebsite}
          >
            เปิดเว็บไซต์บริษัทขนส่ง
          </button>
          <button
            type="button"
            className="tracking-guide-button tracking-guide-button--close"
            onClick={onClose}
          >
            ปิด
          </button>
        </footer>
      </section>
    </div>
  )
}

export default TrackingGuideModal
