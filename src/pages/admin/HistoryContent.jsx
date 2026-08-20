import { useEffect, useRef, useState } from 'react';
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
  constructor(loader) {
    this.loader = loader;
    this.controller = new AbortController();
  }

  async upload() {
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
  }

  abort() {
    this.controller.abort();
  }
}

function HistoryUploadAdapterPlugin(editor) {
  editor.plugins.get('FileRepository').createUploadAdapter = (loader) => (
    new HistoryImageUploadAdapter(loader)
  );
}

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
  const discardingRef = useRef(false);
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saveAlertOpen, setSaveAlertOpen] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);

  const isDirty = content !== savedContent;

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
        setContent(loadedContent);
        setSavedContent(loadedContent);
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

    if (!hasReadableText(content)) {
      setSuccess('');
      setError('กรุณากรอกเนื้อหาความเป็นมาก่อนบันทึก');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    setSaveAlertOpen(false);

    try {
      const saved = await updateHistoryContent(content);
      const savedHtml = String(saved?.content_html ?? content);

      if (savedHtml !== content) {
        editorRef.current?.setData(savedHtml);
        setContent(savedHtml);
      }

      setSavedContent(savedHtml);
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
            <button type="submit" className="history-editor-save" disabled={!isDirty || saving}>
              {saving ? 'กำลังบันทึก...' : 'บันทึกเนื้อหา'}
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
