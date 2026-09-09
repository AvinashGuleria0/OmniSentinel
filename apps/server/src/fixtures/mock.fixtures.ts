export const MOCK_AMAZON_HTML = `
<!DOCTYPE html>
<html>
<head><title>Nike Air Max SYSTM Men Shoes - Amazon.in</title></head>
<body>
  <div id="dp">
    <span id="productTitle">Nike Air Max SYSTM Men Running Shoes - Black/White</span>
    <div class="a-price">
      <span class="a-price-symbol">₹</span>
      <span class="a-price-whole">3,495.</span>
    </div>
    <div id="couponBadge">
      <label>
        <input type="checkbox" checked />
        <span>Apply ₹500 coupon</span>
      </label>
    </div>
    <div id="bankOffers">
      <p>Bank Offer: 10% Instant Discount up to ₹1000 on HDFC Bank Credit Card Transactions. Min purchase ₹2500.</p>
      <p>Bank Offer: 5% Cashback on ICICI Bank Cards.</p>
    </div>
  </div>
</body>
</html>
`;

export const MOCK_UNIVERSITY_NOTICE_HTML = `
<!DOCTYPE html>
<html>
<head><title>University of Delhi - Admissions 2026</title></head>
<body>
  <h1>Admissions & Cutoffs Notice Board</h1>
  <ul class="notice-list">
    <li><a href="/notice/1">Press Release: UG Admissions Policy 2026</a> - Posted: 10-Aug-2026</li>
    <li><a href="/notice/2">First Cutoff List for Undergraduate Courses 2026 Announced!</a> - Posted: 08-Sep-2026</li>
  </ul>
</body>
</html>
`;

export const MOCK_JOB_LISTINGS = [
  {
    job_id: 'job_mern_001',
    job_title: 'MERN Stack Developer Intern (Remote)',
    employer_name: 'TechFlow Labs',
    job_city: 'Remote',
    job_country: 'IN',
    job_is_remote: true,
    job_description:
      'We are hiring an enthusiastic MERN Stack intern to build modern web applications. Duration: 6 months. We offer a competitive monthly stipend of ₹30,000/month along with full-time conversion opportunities.',
    job_apply_link: 'https://careers.techflowlabs.dev/apply/intern-001',
    job_posted_at_timestamp: Math.floor(Date.now() / 1000) - 3600,
  },
  {
    job_id: 'job_mern_002',
    job_title: 'Full Stack React & Node Intern',
    employer_name: 'AlphaByte Solutions',
    job_city: 'Bangalore',
    job_country: 'IN',
    job_is_remote: false,
    job_description:
      'In-office Bangalore internship for React and Node.js developers. Stipend: ₹18,000 per month.',
    job_apply_link: 'https://alphabyte.com/jobs/react-intern',
    job_posted_at_timestamp: Math.floor(Date.now() / 1000) - 7200,
  },
];
