import { useEffect, useMemo, useState } from 'react';
import { fetchPublishedNews, fetchPublishedNewsById } from '../api/news';
import CustomerNavbar from '../components/CustomerNavbar';
import { HERO_SLIDES } from '../components/HomeHeroBanner';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';
import { getImageUrl as resolveImageUrl } from '../utils/imageUrl';
import './Home.css';
import './NewsPage.css';

const fallbackImages = [
  'https://images.unsplash.com/photo-1499529112087-3cb3b73cec95?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1000&q=80',
];

function getNewsIdFromRoute(route) {
  const queryString = route.split('?')[1] || '';
  const params = new URLSearchParams(queryString);
  return params.get('id');
}

function getImageUrl(item, index = 0) {
  return resolveImageUrl(item?.image_url, fallbackImages[index % fallbackImages.length]);
}

function formatDate(value) {
  if (!value) return '-';

  return new Date(value).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function NewsPage({ route, user, onNavigate, onLogout }) {
  const newsId = getNewsIdFromRoute(route);
  const [news, setNews] = useState([]);
  const [selectedNews, setSelectedNews] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadNews() {
      try {
        setLoading(true);
        setError('');

        if (newsId) {
          const item = await fetchPublishedNewsById(newsId);
          if (!active) return;
          setSelectedNews(item);
          setNews([]);
          return;
        }

        const rows = await fetchPublishedNews();
        if (!active) return;
        setNews(rows);
        setSelectedNews(null);
      } catch (err) {
        if (active) setError(err.message || 'ไม่สามารถโหลดข่าวได้');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadNews();

    return () => {
      active = false;
    };
  }, [newsId]);

  const featuredNews = useMemo(() => news[0] || null, [news]);
  const otherNews = useMemo(() => news.slice(1), [news]);
  const newsPagination = usePagination(otherNews, 6, [newsId, news.length]);

  const [bannerIndex, setBannerIndex] = useState(0);
  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const id = window.setInterval(() => setBannerIndex((i) => (i + 1) % HERO_SLIDES.length), 6000);
    return () => window.clearInterval(id);
  }, []);

  function handleNewsPageChange(page) {
    newsPagination.setPage(page);
    window.requestAnimationFrame(() => {
      document.getElementById('news-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  return (
    <div className="news-page">
      <CustomerNavbar user={user} onNavigate={onNavigate} onLogout={onLogout} />
      

      <main id="news-content" className="news-main">
        <section
          className="news-shell news-heading"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(10, 38, 25, 0.9), rgba(20, 65, 43, 0.67) 58%, rgba(18, 58, 39, 0.35)), url(${HERO_SLIDES[bannerIndex].src})`,
            backgroundPosition: HERO_SLIDES[bannerIndex].position,
            backgroundSize: 'cover',
          }}
        >
          <p>เรื่องราวจากพื้นที่สูง</p>
          <h1>{newsId ? 'รายละเอียดข่าว' : 'ข่าวและประชาสัมพันธ์'}</h1>
          <span>ติดตามข่าวชุมชน โปรโมชั่น และกิจกรรมจากห้วยหยวกป่าโซ</span>
          {!newsId ? (
            <div className="news-heading-highlights" aria-label="ประเภทข่าวสาร">
              <span>ข่าวชุมชน</span>
              <span>กิจกรรม</span>
              <span>โปรโมชั่น</span>
            </div>
          ) : null}
        </section>

        {loading && <div className="news-state">กำลังโหลดข่าว...</div>}

        {!loading && error && (
          <div className="news-state news-error">
            <p>{error}</p>
            <button type="button" onClick={() => onNavigate('/news')}>
              กลับไปหน้าข่าว
            </button>
          </div>
        )}

        {!loading && !error && newsId && selectedNews && (
          <article className="news-detail news-shell">
            <div className="news-detail-media">
              <img src={getImageUrl(selectedNews)} alt={selectedNews.title} />
            </div>
            <div className="news-detail-body">
              <div className="news-meta">
                <span>{selectedNews.category || 'ข่าวชุมชน'}</span>
                <span>{formatDate(selectedNews.created_at)}</span>
              </div>
              <h2>{selectedNews.title}</h2>
              {selectedNews.summary && <p className="news-summary">{selectedNews.summary}</p>}
              <div className="news-content">
                {String(selectedNews.content || '')
                  .split('\n')
                  .filter(Boolean)
                  .map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
              </div>
              <button type="button" onClick={() => onNavigate('/news')}>
                กลับหน้าข่าว
              </button>
            </div>
          </article>
        )}

        {!loading && !error && !newsId && news.length === 0 && (
          <div className="news-state">ยังไม่มีข่าวที่เผยแพร่</div>
        )}

        {!loading && !error && !newsId && featuredNews && (
          <section className="news-shell">
            <div className="news-section-label">
              <span>เรื่องเด่นล่าสุด</span>
              <strong>{news.length} ข่าวสาร</strong>
            </div>
            <article className="news-featured">
              <div className="news-featured-media">
                <img src={getImageUrl(featuredNews)} alt={featuredNews.title} />
                <span>ข่าวเด่น</span>
              </div>
              <div>
                <div className="news-meta">
                  <span>{featuredNews.category || 'ข่าวชุมชน'}</span>
                  <span>{formatDate(featuredNews.created_at)}</span>
                </div>
                <h2>{featuredNews.title}</h2>
                <p>{featuredNews.summary || featuredNews.content}</p>
                <button type="button" onClick={() => onNavigate(`/news?id=${featuredNews.news_id}`)}>
                  อ่านต่อ
                </button>
              </div>
            </article>

            {otherNews.length > 0 ? <div id="news-list" className="news-list-heading">
              <h2>ข่าวสารทั้งหมด</h2>
              <span>เรื่องราวและกิจกรรมจากชุมชนของเรา</span>
            </div> : null}
            <div className="news-grid">
              {newsPagination.pageItems.map((item, index) => (
                <article className="news-card" key={item.news_id}>
                  <img
                    src={getImageUrl(item, (newsPagination.page - 1) * newsPagination.pageSize + index + 1)}
                    alt={item.title}
                  />
                  <div className="news-card-body">
                    <div className="news-meta">
                      <span>{item.category || 'ข่าวชุมชน'}</span>
                      <span>{formatDate(item.created_at)}</span>
                    </div>
                    <h2>{item.title}</h2>
                    <p>{item.summary || item.content}</p>
                    <button type="button" onClick={() => onNavigate(`/news?id=${item.news_id}`)}>
                      อ่านต่อ
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <Pagination
              page={newsPagination.page}
              totalPages={newsPagination.totalPages}
              onPageChange={handleNewsPageChange}
              className="news-pagination"
            />
          </section>
        )}
      </main>
    </div>
  );
}
