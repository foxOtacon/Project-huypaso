import { useEffect, useMemo, useState } from 'react';
import { fetchPublishedNews, fetchPublishedNewsById } from '../api/news';
import CustomerNavbar from '../components/CustomerNavbar';
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
  const imageUrl = item?.image_url?.trim();

  if (!imageUrl) {
    return fallbackImages[index % fallbackImages.length];
  }

  if (imageUrl.startsWith('http') || imageUrl.startsWith('/')) {
    return imageUrl;
  }

  return `/${imageUrl}`;
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

  return (
    <div className="news-page">
      <CustomerNavbar user={user} onNavigate={onNavigate} onLogout={onLogout} />

      <main className="news-main">
        <section className="news-shell news-heading">
          <p>Community News</p>
          <h1>{newsId ? 'รายละเอียดข่าว' : 'ข่าวและประชาสัมพันธ์'}</h1>
          <span>ติดตามข่าวชุมชน โปรโมชั่น และกิจกรรมจากห้วยหยวกปากโซ</span>
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
            <img src={getImageUrl(selectedNews)} alt={selectedNews.title} />
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
            <article className="news-featured">
              <img src={getImageUrl(featuredNews)} alt={featuredNews.title} />
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

            <div className="news-grid">
              {otherNews.map((item, index) => (
                <article className="news-card" key={item.news_id}>
                  <img src={getImageUrl(item, index + 1)} alt={item.title} />
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
          </section>
        )}
      </main>
    </div>
  );
}
