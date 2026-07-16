import CustomerNavbar from '../components/CustomerNavbar';
import './KnowledgePage.css';

const cropGuides = [
  {
    title: 'กาแฟอาราบิก้าบนดอย',
    tag: 'Coffee',
    image: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1200&q=85',
    intro: 'พื้นที่สูง อากาศเย็น และมีหมอกยามเช้าเหมาะกับกาแฟอาราบิก้า เมล็ดจะค่อย ๆ สะสมความหวานและกลิ่นหอมตามธรรมชาติ',
    details: ['ปลูกในพื้นที่ระบายน้ำดี ไม่ขังน้ำ', 'ตัดแต่งกิ่งหลังเก็บเกี่ยวเพื่อให้ต้นโปร่ง', 'เก็บเฉพาะผลเชอร์รีสีแดงเพื่อคุณภาพรสชาติที่สม่ำเสมอ'],
  },
  {
    title: 'ชาอัสสัมและชาเขียว',
    tag: 'Tea',
    image: 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?auto=format&fit=crop&w=1200&q=85',
    intro: 'ชาเป็นพืชที่เข้ากับอากาศเย็นและความชื้นบนดอยได้ดี การเก็บยอดอ่อนสม่ำเสมอช่วยให้ได้ใบชาหอมและแตกยอดใหม่ต่อเนื่อง',
    details: ['เก็บยอดอ่อน 1 ยอด 2 ใบ', 'คลุมโคนเพื่อลดวัชพืชและรักษาความชื้น', 'แปรรูปเร็วหลังเก็บเพื่อรักษากลิ่นสดของใบชา'],
  },
  {
    title: 'ผักเมืองหนาว',
    tag: 'Cool-season vegetables',
    image: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1200&q=85',
    intro: 'กะหล่ำปลี ผักกาดหอม บรอกโคลี และแครอทเติบโตได้ดีในอากาศเย็น เหมาะกับแปลงปลูกที่ได้รับแดดและมีน้ำพอเหมาะ',
    details: ['เตรียมดินร่วนซุย ใส่ปุ๋ยคอกสุก', 'ให้น้ำตอนเช้า ลดโรคจากความชื้นกลางคืน', 'หมุนเวียนพืชเพื่อลดแมลงและโรคสะสมในดิน'],
  },
  {
    title: 'สตรอว์เบอร์รีและไม้ผลเมืองหนาว',
    tag: 'Highland fruit',
    image: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&w=1200&q=85',
    intro: 'สตรอว์เบอร์รี อะโวคาโด พลับ และเสาวรสเป็นตัวเลือกที่พบได้ในหลายพื้นที่สูง ต้องดูแลแสง น้ำ และการป้องกันเชื้อราอย่างใกล้ชิด',
    details: ['ยกร่องหรือใช้วัสดุคลุมแปลงเพื่อลดผลสัมผัสดิน', 'เก็บผลตามระยะสุกที่เหมาะกับการขนส่ง', 'คัดแยกผลผลิตตั้งแต่หน้าแปลงเพื่อรักษาคุณภาพ'],
  },
];

const seasonalTasks = [
  'สำรวจความชื้นดินและแหล่งน้ำก่อนเริ่มฤดูปลูก',
  'ทำปุ๋ยหมักจากเศษพืชในชุมชนเพื่อลดต้นทุน',
  'บันทึกวันปลูก วันใส่ปุ๋ย และวันเก็บเกี่ยวของแต่ละแปลง',
  'คัดแยกผลผลิตตามคุณภาพก่อนนำไปจำหน่ายหรือแปรรูป',
];

export default function KnowledgePage({ user, onNavigate, onLogout }) {
  return (
    <div className="knowledge-page">
      <CustomerNavbar user={user} onNavigate={onNavigate} onLogout={onLogout} />

      <main>
        <section className="knowledge-hero">
          <div className="knowledge-hero-overlay" />
          <div className="knowledge-shell knowledge-hero-content">
            <p>องค์ความรู้ชุมชนบนดอย</p>
            <h1>ปลูกพืชเมืองหนาว กาแฟ ชา และพืชดอยห้วยหยวกป่าโซ</h1>
            <span>
              รวมแนวทางดูแลพืชที่เหมาะกับอากาศเย็น พื้นที่ลาดชัน และวิถีเกษตรชุมชน เพื่อให้ผลผลิตมีคุณภาพและต่อยอดเป็นสินค้าชุมชนได้
            </span>
          </div>
        </section>

        <section className="knowledge-shell knowledge-intro">
          <div>
            <p>ภูมิประเทศ</p>
            <h2>ทำไมพื้นที่บนดอยถึงเหมาะกับพืชเหล่านี้</h2>
          </div>
          <p>
            หมู่บ้านบนพื้นที่สูงมีอากาศเย็นกว่าพื้นราบ กลางวันมีแดดและกลางคืนอุณหภูมิลดลง พืชอย่างกาแฟ ชา ผักเมืองหนาว และผลไม้บางชนิดจึงสะสมรสชาติ สี กลิ่น และความกรอบได้ดี แต่ต้องจัดการน้ำ ดิน และการป้องกันโรคให้เหมาะกับสภาพหมอกและความชื้น
          </p>
        </section>

        <section className="knowledge-shell crop-grid" aria-label="หมวดความรู้การปลูก">
          {cropGuides.map((crop) => (
            <article className="crop-card" key={crop.title}>
              <img src={crop.image} alt={crop.title} />
              <div className="crop-card-body">
                <span>{crop.tag}</span>
                <h2>{crop.title}</h2>
                <p>{crop.intro}</p>
                <ul>
                  {crop.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </section>

        <section className="knowledge-shell practice-section">
          <div className="practice-copy">
            <p>แนวทางดูแลแปลง</p>
            <h2>งานที่ควรทำเป็นประจำในชุมชนเกษตรบนดอย</h2>
            <span>
              การจดบันทึกและทำงานเป็นระบบช่วยให้เกษตรกรวางแผนผลผลิตได้ดีขึ้น ลดความเสียหาย และคุมคุณภาพสินค้าให้สม่ำเสมอ
            </span>
          </div>
          <div className="practice-list">
            {seasonalTasks.map((task, index) => (
              <div key={task}>
                <strong>{String(index + 1).padStart(2, '0')}</strong>
                <p>{task}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
