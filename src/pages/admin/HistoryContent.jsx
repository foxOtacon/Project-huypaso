import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import {
  AccessibilityHelp,
  Alignment,
  Autoformat,
  AutoImage,
  BlockQuote,
  Bold,
  Bookmark,
  ClassicEditor,
  Code,
  CodeBlock,
  Emoji,
  Essentials,
  FindAndReplace,
  FontBackgroundColor,
  FontColor,
  FontFamily,
  FontSize,
  Fullscreen,
  GeneralHtmlSupport,
  Heading,
  Highlight,
  HorizontalLine,
  HtmlEmbed,
  ImageBlock,
  ImageCaption,
  ImageInline,
  ImageInsert,
  ImageInsertViaUrl,
  ImageResize,
  ImageStyle,
  ImageTextAlternative,
  ImageToolbar,
  ImageUpload,
  Indent,
  IndentBlock,
  Italic,
  Link,
  LinkImage,
  List,
  ListProperties,
  MediaEmbed,
  PageBreak,
  Paragraph,
  PasteFromOffice,
  RemoveFormat,
  SelectAll,
  ShowBlocks,
  SourceEditing,
  SpecialCharacters,
  SpecialCharactersEssentials,
  Strikethrough,
  Subscript,
  Superscript,
  Table,
  TableCaption,
  TableCellProperties,
  TableColumnResize,
  TableProperties,
  TableToolbar,
  TodoList,
  Underline,
} from 'ckeditor5';
import 'ckeditor5/ckeditor5.css';
import { fetchHistoryContent, updateHistoryContent } from '../../api/admin';
import { getImageUrl } from '../../utils/imageUrl';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

class HistoryImageUploadAdapter {
  constructor(loader, onUploadStateChange = () => {}) {
    this.loader = loader;
    this.onUploadStateChange = onUploadStateChange;
    this.controller = new AbortController();
  }

  async upload() {
    this.onUploadStateChange(1);
    try {
    const file = await this.loader.file;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      throw new Error('รองรับเฉพาะไฟล์ JPEG, PNG, WebP และ GIF');
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error('รูปภาพต้องมีขนาดไม่เกิน 5 MB');
    }
    const token = localStorage.getItem('token');
    if (!token) throw new Error('กรุณาเข้าสู่ระบบใหม่ก่อนอัปโหลดรูป');
    const formData = new FormData();
    formData.append('upload', file);

    let response;
    try {
      response = await fetch(`${API_BASE}/uploads/history-image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
        signal: this.controller.signal,
      });
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองอัปโหลดอีกครั้ง', { cause: error });
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || 'อัปโหลดรูปไม่สำเร็จ กรุณาตรวจสอบชนิดและขนาดไฟล์');
    }
    const url = payload.url || payload.data?.url;
    if (!url) throw new Error('เซิร์ฟเวอร์ไม่ส่ง URL ของรูปกลับมา');
    return { default: getImageUrl(url) };
    } finally {
      this.onUploadStateChange(-1);
    }
  }

  abort() {
    this.controller.abort();
  }
}

function HistoryUploadAdapterPlugin(editor) {
  editor.plugins.get('FileRepository').createUploadAdapter = (loader) => (
    new HistoryImageUploadAdapter(loader, HistoryUploadAdapterPlugin.onUploadStateChange)
  );
}

HistoryUploadAdapterPlugin.onUploadStateChange = () => {};

const EDITOR_CONFIG = {
  licenseKey: import.meta.env.VITE_CKEDITOR_LICENSE_KEY || 'GPL',
  plugins: [
    AccessibilityHelp, Autoformat, Essentials, Paragraph, Heading,
    Bold, Italic, Underline, Strikethrough, Subscript, Superscript, Code,
    FontFamily, FontSize, FontColor, FontBackgroundColor, Highlight,
    Link, Bookmark, List, ListProperties, TodoList, BlockQuote, CodeBlock,
    Alignment, Indent, IndentBlock, HorizontalLine, PageBreak,
    AutoImage, ImageBlock, ImageInline, ImageCaption, ImageInsert,
    ImageInsertViaUrl, ImageResize, ImageStyle, ImageTextAlternative,
    ImageToolbar, ImageUpload, LinkImage, MediaEmbed, HtmlEmbed,
    Table, TableCaption, TableCellProperties, TableColumnResize,
    TableProperties, TableToolbar, PasteFromOffice, RemoveFormat,
    FindAndReplace, SelectAll, ShowBlocks, SourceEditing,
    SpecialCharacters, SpecialCharactersEssentials, Emoji, Fullscreen,
    GeneralHtmlSupport,
  ],
  extraPlugins: [HistoryUploadAdapterPlugin],
  toolbar: {
    items: [
      'undo', 'redo', '|',
      'findAndReplace', 'selectAll', '|',
      'heading', 'fontFamily', 'fontSize', '|',
      'bold', 'italic', 'underline', 'strikethrough',
      'subscript', 'superscript', 'code', '|',
      'fontColor', 'fontBackgroundColor', 'highlight', 'removeFormat', '|',
      'alignment', 'bulletedList', 'numberedList', 'todoList',
      'outdent', 'indent', '|',
      'link', 'bookmark', 'blockQuote', 'codeBlock',
      'horizontalLine', 'pageBreak', '|',
      'insertImage', 'mediaEmbed', 'htmlEmbed', 'insertTable',
      'specialCharacters', 'emoji', '|',
      'showBlocks', 'sourceEditing', 'fullscreen',
    ],
    shouldNotGroupWhenFull: true,
  },
  fontFamily: {
    options: [
      'default', 'Arial, Helvetica, sans-serif', 'Tahoma, sans-serif',
      'Verdana, sans-serif', 'Georgia, serif', 'Courier New, monospace',
    ],
    supportAllValues: false,
  },
  fontSize: {
    options: [10, 12, 14, 'default', 18, 20, 24, 28, 32, 36, 48],
    supportAllValues: false,
  },
  list: {
    properties: { styles: true, startIndex: true, reversed: true },
  },
  htmlSupport: {
    allow: [{ name: /.*/, attributes: true, classes: true, styles: true }],
  },
  image: {
    resizeOptions: [
      { name: 'resizeImage:original', value: null, label: 'ขนาดเดิม' },
      { name: 'resizeImage:25', value: '25', label: '25%' },
      { name: 'resizeImage:50', value: '50', label: '50%' },
      { name: 'resizeImage:75', value: '75', label: '75%' },
    ],
    toolbar: [
      'imageTextAlternative', 'toggleImageCaption', '|',
      'imageStyle:inline', 'imageStyle:alignLeft', 'imageStyle:alignCenter',
      'imageStyle:alignRight', 'imageStyle:block', 'imageStyle:side', '|',
      'resizeImage',
    ],
  },
  table: {
    contentToolbar: [
      'tableColumn', 'tableRow', 'mergeTableCells', 'tableProperties',
      'tableCellProperties', 'toggleTableCaption',
    ],
  },

};

function hasReadableText(html) {
  if (/<img\b/i.test(String(html || ''))) return true;

  return String(html || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .trim().length > 0;
}

function formatUpdatedAt(value) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function HistoryContent() {
  const editorRef = useRef(null);
  const locationMapContainerRef = useRef(null);
  const locationMapRef = useRef(null);
  const locationMarkerRef = useRef(null);
  const previewCoordinatesRef = useRef({ latitude: null, longitude: null });
  const discardingRef = useRef(false);
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [savedLatitude, setSavedLatitude] = useState('');
  const [savedLongitude, setSavedLongitude] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saveAlertOpen, setSaveAlertOpen] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [pendingUploads, setPendingUploads] = useState(0);

  const isDirty = content !== savedContent
    || latitude !== savedLatitude
    || longitude !== savedLongitude;
  const previewLatitude = Number(latitude);
  const previewLongitude = Number(longitude);
  const hasPreviewCoordinates = latitude.trim() !== ''
    && longitude.trim() !== ''
    && Number.isFinite(previewLatitude)
    && Number.isFinite(previewLongitude)
    && previewLatitude >= -90
    && previewLatitude <= 90
    && previewLongitude >= -180
    && previewLongitude <= 180;

  useEffect(() => {
    previewCoordinatesRef.current = {
      latitude: previewLatitude,
      longitude: previewLongitude,
    };
  }, [previewLatitude, previewLongitude]);

  useEffect(() => {
    if (!hasPreviewCoordinates || !locationMapContainerRef.current) return undefined;

    const { latitude: initialLatitude, longitude: initialLongitude } = previewCoordinatesRef.current;
    const map = L.map(locationMapContainerRef.current).setView(
      [initialLatitude, initialLongitude],
      15,
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.circleMarker([initialLatitude, initialLongitude], {
      radius: 9,
      color: '#ffffff',
      weight: 3,
      fillColor: '#d94b45',
      fillOpacity: 1,
    }).addTo(map);

    map.on('click', (event) => {
      setLatitude(event.latlng.lat.toFixed(7));
      setLongitude(event.latlng.lng.toFixed(7));
      setError('');
      setSuccess('');
    });

    locationMapRef.current = map;
    locationMarkerRef.current = marker;
    window.setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
      locationMapRef.current = null;
      locationMarkerRef.current = null;
    };
  }, [hasPreviewCoordinates]);

  useEffect(() => {
    const map = locationMapRef.current;
    const marker = locationMarkerRef.current;
    if (!map || !marker || !hasPreviewCoordinates) return;

    const nextPosition = [previewLatitude, previewLongitude];
    marker.setLatLng(nextPosition);
    map.setView(nextPosition);
  }, [hasPreviewCoordinates, previewLatitude, previewLongitude]);

  useEffect(() => {
    HistoryUploadAdapterPlugin.onUploadStateChange = (change) => {
      setPendingUploads((current) => Math.max(0, current + change));
    };

    return () => {
      HistoryUploadAdapterPlugin.onUploadStateChange = () => {};
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadContent() {
      setLoading(true);
      setError('');
      setSuccess('');

      try {
        const record = await fetchHistoryContent();
        if (!active) return;

        const loadedContent = String(record?.content_html || '');
        const loadedLatitude = record?.latitude == null ? '' : String(record.latitude);
        const loadedLongitude = record?.longitude == null ? '' : String(record.longitude);
        setContent(loadedContent);
        setSavedContent(loadedContent);
        setLatitude(loadedLatitude);
        setSavedLatitude(loadedLatitude);
        setLongitude(loadedLongitude);
        setSavedLongitude(loadedLongitude);
        setUpdatedAt(record?.updated_at || '');
      } catch (err) {
        if (active) setError(err.message || 'ไม่สามารถโหลดเนื้อหาความเป็นมาได้');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadContent();
    return () => {
      active = false;
    };
  }, [reloadVersion]);

  useEffect(() => {
    if (!isDirty) return undefined;

    const warnAboutUnsavedChanges = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warnAboutUnsavedChanges);
    return () => window.removeEventListener('beforeunload', warnAboutUnsavedChanges);
  }, [isDirty]);

  async function handleSave(event) {
    event.preventDefault();

    if (pendingUploads > 0) {
      setSuccess('');
      setError('กรุณารอให้อัปโหลดรูปภาพเสร็จก่อนบันทึก');
      return;
    }

    if (!hasReadableText(content)) {
      setSuccess('');
      setError('กรุณากรอกเนื้อหาความเป็นมาก่อนบันทึก');
      return;
    }

    const parsedLatitude = latitude.trim() === '' ? null : Number(latitude);
    const parsedLongitude = longitude.trim() === '' ? null : Number(longitude);
    if (!Number.isFinite(parsedLatitude) || parsedLatitude < -90 || parsedLatitude > 90) {
      setSuccess('');
      setError('Latitude ต้องอยู่ระหว่าง -90 ถึง 90 หรือเว้นว่างได้');
      return;
    }
    if (!Number.isFinite(parsedLongitude) || parsedLongitude < -180 || parsedLongitude > 180) {
      setSuccess('');
      setError('Longitude ต้องอยู่ระหว่าง -180 ถึง 180 หรือเว้นว่างได้');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    setSaveAlertOpen(false);

    try {
      const saved = await updateHistoryContent({
        contentHtml: content,
        latitude: parsedLatitude,
        longitude: parsedLongitude,
      });
      const savedHtml = String(saved?.content_html ?? content);
      const savedLatitudeValue = saved?.latitude == null ? '' : String(saved.latitude);
      const savedLongitudeValue = saved?.longitude == null ? '' : String(saved.longitude);

      if (savedHtml !== content) {
        editorRef.current?.setData(savedHtml);
        setContent(savedHtml);
      }

      setSavedContent(savedHtml);
      setLatitude(savedLatitudeValue);
      setSavedLatitude(savedLatitudeValue);
      setLongitude(savedLongitudeValue);
      setSavedLongitude(savedLongitudeValue);
      setUpdatedAt(saved?.updated_at || new Date().toISOString());
      setSuccess('แก้ไขเรียบร้อยแล้ว');
      setSaveAlertOpen(true);
    } catch (err) {
      setError(err.message || 'ไม่สามารถบันทึกเนื้อหาความเป็นมาได้');
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    discardingRef.current = true;
    editorRef.current?.setData(savedContent);
    const restoredContent = editorRef.current?.getData() ?? savedContent;
    setContent(restoredContent);
    setSavedContent(restoredContent);
    setLatitude(savedLatitude);
    setLongitude(savedLongitude);
    setError('');
    setSuccess('ยกเลิกการเปลี่ยนแปลงแล้ว');
  }

  if (loading) {
    return <div className="admin-loading">กำลังโหลดเนื้อหาความเป็นมา...</div>;
  }

  if (error && !savedContent && !content) {
    return (
      <section className="admin-panel admin-history-load-error" aria-live="polite">
        <h2>ไม่สามารถเปิดตัวแก้ไขเนื้อหาได้</h2>
        <p>{error}</p>
        <button type="button" onClick={() => setReloadVersion((value) => value + 1)}>
          ลองใหม่
        </button>
      </section>
    );
  }

  return (
    <div className="admin-history-page">
      <form className="admin-panel history-editor-card" onSubmit={handleSave}>
        <header className="history-editor-heading">
          <div>
            <span>เนื้อหาหน้าแรก</span>
            <h2>แก้ไขความเป็นมา</h2>
            <p>จัดรูปแบบย่อหน้า หัวข้อ ลิงก์ และรายการ ก่อนเผยแพร่บนหน้าแรก</p>
          </div>
        </header>

        <div className="history-editor-notices" aria-live="polite">
          {error ? <div className="admin-error history-editor-message">{error}</div> : null}
          {success ? <div className="history-editor-success history-editor-message">{success}</div> : null}
        </div>

        <div className="history-editor-shell">
          <CKEditor
            editor={ClassicEditor}
            config={EDITOR_CONFIG}
            data={content}
            onReady={(editor) => {
              editorRef.current = editor;
            }}
            onChange={(_event, editor) => {
              setContent(editor.getData());
              if (discardingRef.current) {
                discardingRef.current = false;
                return;
              }
              setError('');
              setSuccess('');
            }}
            onError={(editorError) => {
              setSuccess('');
              setError(editorError?.message || 'ตัวแก้ไขข้อความทำงานผิดพลาด กรุณาลองใหม่');
            }}
          />
        </div>

        <div className="history-location-fields">
          <div className="history-location-heading">
            <h3>ที่ตั้งหมู่บ้าน</h3>
            <p>กรอกพิกัดเพื่อแสดงตำแหน่งบน Google Maps โดยไม่ฝังแผนที่ไว้ในเนื้อหา</p>
          </div>
          <div className="history-location-grid">
            <label>
              <span>Latitude</span>
              <input
                type="number"
                min="-90"
                max="90"
                step="any"
                value={latitude}
                onChange={(event) => { setLatitude(event.target.value); setError(''); setSuccess(''); }}
                placeholder="เช่น 20.1234567"
              />
            </label>
            <label>
              <span>Longitude</span>
              <input
                type="number"
                min="-180"
                max="180"
                step="any"
                value={longitude}
                onChange={(event) => { setLongitude(event.target.value); setError(''); setSuccess(''); }}
                placeholder="เช่น 99.1234567"
              />
            </label>
          </div>
          {hasPreviewCoordinates ? (
            <div className="history-location-preview">
              <div className="history-location-preview-heading">
                <span>ตัวอย่างตำแหน่ง</span>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${previewLatitude},${previewLongitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  เปิดใน Google Maps
                </a>
              </div>
              <div className="history-location-map-frame">
                <div ref={locationMapContainerRef} className="history-location-map" />
              </div>
              <p>คลิกตำแหน่งบนแผนที่เพื่อเปลี่ยน Latitude/Longitude หรือลากและซูมเพื่อค้นหาตำแหน่ง</p>
            </div>
          ) : null}
        </div>

        <footer className="history-editor-footer">
          <p>{updatedAt ? `แก้ไขล่าสุด ${formatUpdatedAt(updatedAt)}` : 'ยังไม่มีข้อมูลการแก้ไขล่าสุด'}</p>
          <div className="history-editor-actions">
            <button
              type="button"
              className="history-editor-discard"
              onClick={handleDiscard}
              disabled={!isDirty || saving}
            >
              ยกเลิกการเปลี่ยนแปลง
            </button>
            <button type="submit" className="history-editor-save" disabled={!isDirty || saving || pendingUploads > 0}>
              {pendingUploads > 0 ? 'กำลังอัปโหลดรูป...' : saving ? 'กำลังบันทึก...' : 'บันทึกเนื้อหา'}
            </button>
          </div>
        </footer>
      </form>
      {saveAlertOpen ? (
        <div className='history-save-alert' role='status' aria-live='polite'>
          <span className='history-save-alert-icon' aria-hidden='true'>
            <svg viewBox='0 0 24 24'>
              <path d='m5 12 4 4L19 6' />
            </svg>
          </span>
          <div>
            <strong>แก้ไขเรียบร้อยแล้ว</strong>
            <p>บันทึกเนื้อหาความเป็นมาสำเร็จ</p>
          </div>
          <button
            type='button'
            onClick={() => setSaveAlertOpen(false)}
            aria-label='ปิดข้อความแจ้งเตือน'
          >
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}
