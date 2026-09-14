import { useEffect, useState } from 'react';
import {
  createGalleryImage,
  deleteGalleryImage,
  fetchGalleryImages,
  updateGalleryImage,
  uploadGalleryImage,
} from '../../api/gallery';
import { getImageUrl } from '../../utils/imageUrl';
import '../../styles/admin.css';

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
    reader.readAsDataURL(file);
  });
}

export default function Gallery() {
  const [images, setImages] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchGalleryImages()
      .then(setImages)
      .catch((err) => setError(err.message || 'ไม่สามารถโหลด Gallery ได้'))
      .finally(() => setLoading(false));
  }, []);

  async function addImages() {
    const selectedFiles = files;
    if (!selectedFiles.length) {
      setError('กรุณาเลือกรูปภาพก่อนเพิ่ม');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const added = [];
      for (const file of selectedFiles) {
        const dataUrl = await fileToDataUrl(file);
        const uploaded = await uploadGalleryImage({ fileName: file.name, dataUrl });
        added.push(await createGalleryImage({
          image_url: uploaded.url,
          sort_order: images.length + added.length,
        }));
      }
      setImages((current) => [...current, ...added]);
      setFiles([]);
    } catch (err) {
      setError(err.message || 'ไม่สามารถเพิ่มรูป Gallery ได้');
    } finally {
      setSaving(false);
    }
  }

  async function replaceImage(image, file) {
    if (!file) return;
    setSaving(true);
    setError('');
    try {
      const dataUrl = await fileToDataUrl(file);
      const uploaded = await uploadGalleryImage({ fileName: file.name, dataUrl });
      const updated = await updateGalleryImage(image.gallery_id, {
        image_url: uploaded.url,
        sort_order: image.sort_order,
      });
      setImages((current) => current.map((item) => item.gallery_id === updated.gallery_id ? updated : item));
    } catch (err) {
      setError(err.message || 'ไม่สามารถเปลี่ยนรูป Gallery ได้');
    } finally {
      setSaving(false);
    }
  }

  async function removeImage(image) {
    setSaving(true);
    setError('');
    try {
      await deleteGalleryImage(image.gallery_id);
      setImages((current) => current.filter((item) => item.gallery_id !== image.gallery_id));
    } catch (err) {
      setError(err.message || 'ไม่สามารถลบรูป Gallery ได้');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="admin-loading">กำลังโหลด Gallery...</div>;

  return (
    <section className="admin-gallery-page">
      {error ? <div className="admin-error">{error}</div> : null}
      <section className="admin-panel admin-gallery-card">
        <header><h2>แกลเลอรี่</h2></header>
        <div className="admin-gallery-grid">
          {images.map((image) => (
            <article key={image.gallery_id} className="admin-gallery-item">
              <img src={getImageUrl(image.image_url)} alt="บรรยากาศหมู่บ้านห้วยหยวกป่าโซ" />
              <div><label>เปลี่ยนรูป<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => replaceImage(image, event.target.files?.[0])} disabled={saving} /></label><button type="button" onClick={() => removeImage(image)} disabled={saving}>ลบ</button></div>
            </article>
          ))}
        </div>
        <div className="admin-gallery-add"><label>เพิ่มรูป<input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => {
          const selectedFiles = Array.from(event.target.files || []);
          setFiles(selectedFiles);
          setError('');
          event.target.value = '';
        }} disabled={saving} /></label><button type="button" onClick={addImages} disabled={saving || !files.length}>{saving ? 'กำลังบันทึก...' : `เพิ่มรูป (${files.length})`}</button></div>
      </section>
    </section>
  );
}
