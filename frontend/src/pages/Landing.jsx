import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import emailjs from '@emailjs/browser'
import './Landing.css'
import {
  IconQR, IconCart, IconChefHat, IconBell,
  IconKanban, IconCamera, IconChart, IconPeople,
  IconArrow, IconArrowDown, IconStar, IconCheck,
  IconTwitter, IconLinkedIn, IconInstagram,
} from '../components/LandingIcons'
import { useScrollReveal } from '../hooks/useScrollReveal'

// ─── Helpers ────────────────────────────────────────────────────────────────

function Stars() {
  return (
    <div className="lp-stars">
      {[1,2,3,4,5].map(i => <IconStar key={i} />)}
    </div>
  )
}

function scrollTo(id) {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth' })
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function Landing() {
  const navigate = useNavigate()
  useScrollReveal()

  // Navbar scroll state
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Body background
  useEffect(() => {
    document.body.style.background = 'var(--cream, #FDFAF5)'
    return () => { document.body.style.background = '' }
  }, [])

  // Form state
  const [formData, setFormData] = useState({
    from_name: '',
    phone: '',
    restaurant_name: '',
    from_email: '',
    table_count: '1–5 tables',
  })
  const [submitState, setSubmitState] = useState('idle') // idle | loading | success | error

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const { from_name, phone, restaurant_name, from_email } = formData
    if (!from_name || !phone || !restaurant_name || !from_email) {
      setSubmitState('error')
      setTimeout(() => setSubmitState('idle'), 2500)
      return
    }
    setSubmitState('loading')
    try {
      await emailjs.send(
        import.meta.env.VITE_EMAILJS_SERVICE_ID,
        import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
        {
          from_name,
          phone,
          restaurant_name,
          from_email,
          table_count: formData.table_count,
        },
        import.meta.env.VITE_EMAILJS_PUBLIC_KEY
      )
      setSubmitState('success')
      setFormData({ from_name: '', phone: '', restaurant_name: '', from_email: '', table_count: '1–5 tables' })
    } catch (error) {
      console.error('EmailJS error:', error)
      setSubmitState('error')
      setTimeout(() => setSubmitState('idle'), 3000)
    }
  }

  const submitClass = `lp-form-submit lp-submit-${submitState}`
  const submitLabel =
    submitState === 'loading' ? 'Sending...' :
    submitState === 'success' ? 'Demo booked! We\'ll be in touch within 2 hours.' :
    submitState === 'error'   ? 'Something went wrong. Please try again.' :
    'Book My Free Demo'

  return (
    <div className="landing-page">

      {/* ── NAVBAR ── */}
      <nav className={`lp-navbar${scrolled ? ' scrolled' : ''}`}>
        <div className="lp-container">
          <div className="lp-nav-inner">
            <a href="/" className="lp-nav-logo">
              <div className="lp-logo-square">D</div>
              <span className="lp-logo-text">Diney</span>
            </a>
            <ul className="lp-nav-links">
              <li><a href="#how" onClick={e => { e.preventDefault(); scrollTo('how') }}>How it works</a></li>
              <li><a href="#features" onClick={e => { e.preventDefault(); scrollTo('features') }}>Features</a></li>
              <li><a href="#pricing" onClick={e => { e.preventDefault(); scrollTo('pricing') }}>Pricing</a></li>
            </ul>
            <div className="lp-nav-cta">
              <button className="lp-btn lp-btn-ghost" onClick={() => navigate('/login')}>Staff Login</button>
              <button className="lp-btn lp-btn-primary" onClick={() => scrollTo('demo')}>Book a Demo</button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="lp-hero">
        <div className="lp-hero-blob-1" />
        <div className="lp-hero-blob-2" />
        <div className="lp-container">
          <div className="lp-hero-grid">

            {/* Left copy */}
            <div>
              <div className="lp-hero-pill">
                <div className="lp-pulse-dot" />
                Now live in India
              </div>
              <h1 className="lp-hero-h1">
                Your restaurant,<br />
                <em>running itself.</em>
              </h1>
              <p className="lp-hero-sub">
                Diney turns any restaurant into a seamlessly connected operation — from the moment a customer scans a QR code to the second their food arrives at the table.
              </p>
              <div className="lp-hero-actions">
                <button className="lp-btn lp-btn-primary lp-btn-lg" onClick={() => scrollTo('demo')}>
                  Book a Free Demo <IconArrow />
                </button>
                <button className="lp-btn lp-btn-ghost lp-btn-lg" onClick={() => scrollTo('how')}>
                  See how it works <IconArrowDown />
                </button>
              </div>
              <div className="lp-hero-stats">
                <div>
                  <span className="lp-stat-val">3 min</span>
                  <span className="lp-stat-label">Avg setup time</span>
                </div>
                <div>
                  <span className="lp-stat-val">0 apps</span>
                  <span className="lp-stat-label">Customer needs</span>
                </div>
                <div>
                  <span className="lp-stat-val">Real-time</span>
                  <span className="lp-stat-label">Kitchen updates</span>
                </div>
              </div>
            </div>

            {/* Right visual */}
            <div className="lp-hero-visual">
              {/* Floating card 1 */}
              <div className="lp-float-card lp-float-card-1">
                <div className="lp-fc-tag">New order</div>
                <div className="lp-fc-title">Table T4 · ₹680</div>
                <div className="lp-fc-sub">3 items · just now</div>
              </div>

              {/* Dashboard mockup */}
              <div className="lp-dashboard-card">
                <div className="lp-mac-dots">
                  <span className="lp-mac-dot-r" />
                  <span className="lp-mac-dot-y" />
                  <span className="lp-mac-dot-g" />
                </div>
                <div className="lp-dash-mini-stats">
                  <div className="lp-dash-mini">
                    <div className="lp-dash-mini-label">Revenue Today</div>
                    <div className="lp-dash-mini-val">₹24k</div>
                    <div className="lp-dash-mini-delta">↑ 18% vs yesterday</div>
                  </div>
                  <div className="lp-dash-mini">
                    <div className="lp-dash-mini-label">Orders</div>
                    <div className="lp-dash-mini-val">86</div>
                    <div className="lp-dash-mini-delta">14 in progress</div>
                  </div>
                  <div className="lp-dash-mini">
                    <div className="lp-dash-mini-label">Avg Time</div>
                    <div className="lp-dash-mini-val">18m</div>
                    <div className="lp-dash-mini-delta">order to table</div>
                  </div>
                </div>
                <div className="lp-dash-orders">
                  <div className="lp-dash-order highlight">
                    <span className="lp-dash-order-num">T2</span>
                    <span className="lp-dash-order-name">Butter Chicken, Naan ×2</span>
                    <span className="lp-order-badge lp-badge-new">New</span>
                  </div>
                  <div className="lp-dash-order">
                    <span className="lp-dash-order-num">T5</span>
                    <span className="lp-dash-order-name">Dal Makhani, Roti ×3</span>
                    <span className="lp-order-badge lp-badge-prep">Preparing</span>
                  </div>
                  <div className="lp-dash-order">
                    <span className="lp-dash-order-num">T1</span>
                    <span className="lp-dash-order-name">Paneer Tikka, Biryani</span>
                    <span className="lp-order-badge lp-badge-ready">Ready</span>
                  </div>
                </div>
              </div>

              {/* Floating card 2 */}
              <div className="lp-float-card lp-float-card-2">
                <div className="lp-fc-tag">QR scanned</div>
                <div className="lp-fc-title">Table T3 — Menu live</div>
                <div className="lp-fc-sub">Customer ordering now</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="lp-how">
        <div className="lp-container">
          <div className="lp-how-header reveal">
            <span className="lp-eyebrow">How it works</span>
            <h2 className="lp-section-title">Four steps from scan<br />to satisfied customer</h2>
            <p className="lp-section-sub">No training manuals. No missed tickets. Just a clean workflow your team picks up in minutes.</p>
          </div>
          <div className="lp-steps-grid">
            {[
              { num: '01', icon: <IconQR />,       title: 'Customer scans QR',   desc: 'Each table has a unique QR code. Customers scan, browse the digital menu, and place their order instantly.' },
              { num: '02', icon: <IconCart />,      title: 'Order is placed',     desc: 'The order is sent directly to the system. No paper slips, no verbal relay, no errors.' },
              { num: '03', icon: <IconChefHat />,   title: 'Kitchen prepares',    desc: 'The kitchen dashboard shows every live ticket. Chefs mark progress in real time as they cook.' },
              { num: '04', icon: <IconBell />,      title: 'Waiter delivers',     desc: 'The moment a dish is ready, the waiter is notified. Hot food, happy guests, every single time.' },
            ].map(({ num, icon, title, desc }, i) => (
              <div key={num} className="lp-step reveal" style={{ transitionDelay: `${i * 0.1}s` }}>
                <div className="lp-step-num">{num}</div>
                <div className="lp-step-icon">{icon}</div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="lp-features">
        <div className="lp-container">
          <div className="lp-features-header">
            <span className="lp-eyebrow reveal">Everything you need</span>
            <h2 className="lp-section-title reveal">Built for every role<br />in your restaurant</h2>
            <p className="lp-section-sub reveal">Five integrated modules. One subscription. Nothing to stitch together yourself.</p>
          </div>
          <div className="lp-feat-grid">

            {/* Large featured card */}
            <div className="lp-feat-card large reveal">
              <div>
                <div className="lp-feat-icon lp-feat-icon-dark">
                  <IconKanban />
                </div>
                <h3>Real-time Kitchen Dashboard</h3>
                <p>Live kanban board showing every open ticket. Chefs mark items in progress or done — updates propagate everywhere instantly, no refreshing required.</p>
              </div>
              <div className="lp-kanban">
                <div className="lp-kanban-cols">
                  <div>
                    <div className="lp-kanban-col-title">New</div>
                    <div className="lp-kanban-ticket">T4 — Butter Chicken<span>just now</span></div>
                    <div className="lp-kanban-ticket">T9 — Biryani<span>2 min ago</span></div>
                  </div>
                  <div>
                    <div className="lp-kanban-col-title">Preparing</div>
                    <div className="lp-kanban-ticket hl">T7 — Paneer Tikka<span>Chef Ravi</span></div>
                    <div className="lp-kanban-ticket">T2 — Dal Tadka<span>Chef Meera</span></div>
                  </div>
                  <div>
                    <div className="lp-kanban-col-title">Ready</div>
                    <div className="lp-kanban-ticket">T1 — Naan ×4<span>Waiter pinged</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Standard cards */}
            <div className="lp-feat-card reveal" style={{ transitionDelay: '0.1s' }}>
              <div className="lp-feat-icon lp-feat-icon-green"><IconQR /></div>
              <h3>QR Ordering</h3>
              <p>Every table gets a unique, scannable QR code. Customers browse and order from their own phone — no app download, no cashier queue.</p>
            </div>
            <div className="lp-feat-card reveal" style={{ transitionDelay: '0.15s' }}>
              <div className="lp-feat-icon lp-feat-icon-amber"><IconCamera /></div>
              <h3>AI Menu Import</h3>
              <p>Snap a photo of your existing menu and Diney extracts categories, items, and prices automatically. Your digital menu is live in minutes.</p>
            </div>
            <div className="lp-feat-card reveal" style={{ transitionDelay: '0.2s' }}>
              <div className="lp-feat-icon lp-feat-icon-blue"><IconChart /></div>
              <h3>Live Analytics</h3>
              <p>Revenue, order volume, peak-hour breakdowns, and top-selling items surfaced automatically. Know your restaurant better than ever.</p>
            </div>
            <div className="lp-feat-card reveal" style={{ transitionDelay: '0.25s' }}>
              <div className="lp-feat-icon lp-feat-icon-indigo"><IconPeople /></div>
              <h3>Staff Management</h3>
              <p>Add chefs, waiters, and admins with a single click. Set role-based permissions and onboard new staff in under a minute.</p>
            </div>

          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="lp-pricing">
        <div className="lp-container">
          <div className="lp-pricing-header">
            <span className="lp-eyebrow reveal">Pricing</span>
            <h2 className="lp-section-title reveal">Simple, honest pricing</h2>
            <p className="lp-section-sub reveal">One flat monthly rate. Every module included. Scale as you grow.</p>
          </div>
          <div className="lp-pricing-grid">

            {/* Starter */}
            <div className="lp-price-card reveal">
              <div className="lp-price-tier">Starter</div>
              <div className="lp-price-amount">
                <span className="lp-price-currency">₹</span>
                <span className="lp-price-val">999</span>
              </div>
              <div className="lp-price-period">per month</div>
              <div className="lp-price-divider" />
              <ul className="lp-price-features">
                {['Up to 10 tables', 'Digital menu with QR', 'Kitchen & Waiter modules', 'Up to 5 staff accounts'].map(f => (
                  <li key={f}><span className="lp-price-check"><IconCheck /></span>{f}</li>
                ))}
                {['Owner analytics dashboard', 'Customer order tracking'].map(f => (
                  <li key={f}><span className="lp-price-dash">—</span><span className="lp-price-feature-na">{f}</span></li>
                ))}
              </ul>
              <button className="lp-price-btn lp-price-btn-outline" onClick={() => scrollTo('demo')}>Get started</button>
            </div>

            {/* Professional */}
            <div className="lp-price-card featured reveal" style={{ transitionDelay: '0.1s' }}>
              <div className="lp-popular-badge">Most Popular</div>
              <div className="lp-price-tier">Professional</div>
              <div className="lp-price-amount">
                <span className="lp-price-currency">₹</span>
                <span className="lp-price-val">2,499</span>
              </div>
              <div className="lp-price-period">per month</div>
              <div className="lp-price-divider" />
              <ul className="lp-price-features">
                {[
                  'Up to 30 tables',
                  'All Starter modules',
                  'Owner analytics dashboard',
                  'Customer order tracking',
                  'Up to 20 staff accounts',
                  'Priority onboarding support',
                ].map(f => (
                  <li key={f}><span className="lp-price-check"><IconCheck /></span>{f}</li>
                ))}
              </ul>
              <button className="lp-price-btn lp-price-btn-primary" onClick={() => scrollTo('demo')}>Get started</button>
            </div>

            {/* Enterprise */}
            <div className="lp-price-card reveal" style={{ transitionDelay: '0.2s' }}>
              <div className="lp-price-tier">Enterprise</div>
              <div className="lp-price-amount">
                <span className="lp-price-val" style={{ fontSize: 36, paddingTop: 6 }}>Custom</span>
              </div>
              <div className="lp-price-period">tailored to your chain</div>
              <div className="lp-price-divider" />
              <ul className="lp-price-features">
                {[
                  'Unlimited tables',
                  'Multi-branch management',
                  'All Professional modules',
                  'Dedicated account manager',
                  'Custom integrations',
                  'SLA & uptime guarantee',
                ].map(f => (
                  <li key={f}><span className="lp-price-check"><IconCheck /></span>{f}</li>
                ))}
              </ul>
              <button className="lp-price-btn lp-price-btn-outline" onClick={() => scrollTo('demo')}>Contact sales</button>
            </div>

          </div>
          <p className="lp-price-note reveal">All plans include a 14-day free trial. No credit card required.</p>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="lp-testimonials">
        <div className="lp-container">
          <div className="lp-testi-header">
            <span className="lp-eyebrow reveal">What restaurateurs say</span>
            <h2 className="lp-section-title reveal">Real stories from real kitchens</h2>
          </div>
          <div className="lp-testi-grid">

            <div className="lp-testi-card reveal">
              <Stars />
              <p className="lp-testi-quote">"We cut our average order-to-kitchen time from 8 minutes to under 2. The team was up and running on the very first shift — no training required."</p>
              <div className="lp-testi-author">
                <div className="lp-testi-avatar" style={{ background: '#E8921A' }}>R</div>
                <div>
                  <div className="lp-testi-name">Rajesh Nair</div>
                  <div className="lp-testi-role">Owner, Spice Garden, Kochi</div>
                </div>
              </div>
            </div>

            <div className="lp-testi-card reveal" style={{ transitionDelay: '0.1s' }}>
              <Stars />
              <p className="lp-testi-quote">"My waiters stopped missing tickets completely. The notification ping means food gets to the table hot, every time. Customer complaints have basically disappeared."</p>
              <div className="lp-testi-author">
                <div className="lp-testi-avatar" style={{ background: '#2D6A4F' }}>P</div>
                <div>
                  <div className="lp-testi-name">Priya Menon</div>
                  <div className="lp-testi-role">Manager, The Pepper Trail, Bangalore</div>
                </div>
              </div>
            </div>

            <div className="lp-testi-card reveal" style={{ transitionDelay: '0.2s' }}>
              <Stars />
              <p className="lp-testi-quote">"I run two branches and could never see both at once. The multi-branch dashboard gives me real-time numbers for each location on one screen. Game changer."</p>
              <div className="lp-testi-author">
                <div className="lp-testi-avatar" style={{ background: '#6366F1' }}>S</div>
                <div>
                  <div className="lp-testi-name">Suresh Krishnan</div>
                  <div className="lp-testi-role">Owner, Coconut Grove (2 branches), Chennai</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── DEMO FORM ── */}
      <section id="demo" className="lp-demo">
        <div className="lp-container">
          <div className="lp-demo-grid">

            {/* Left */}
            <div className="lp-demo-left reveal">
              <span className="lp-eyebrow" style={{ color: 'rgba(232,146,26,0.85)' }}>Request a demo</span>
              <h2>See Diney in your restaurant — before you pay a rupee</h2>
              <p>Fill in the form and we'll set up a personalised walkthrough within 2 hours. No sales pressure, just a live demo tailored to your setup.</p>
              <div className="lp-demo-perks">
                {[
                  'Free 14-day trial, no credit card',
                  'Onboarding support included',
                  'Cancel anytime, no lock-in',
                  'Your data stays yours — always',
                ].map(p => (
                  <div key={p} className="lp-demo-perk">
                    <div className="lp-perk-check"><IconCheck /></div>
                    {p}
                  </div>
                ))}
              </div>
            </div>

            {/* Right form */}
            <div className="reveal" style={{ transitionDelay: '0.15s' }}>
              <div className="lp-demo-form-card">
                <div className="lp-demo-form-title">Book your demo</div>
                <div className="lp-demo-form-sub">We'll get back to you within 2 hours.</div>
                <form onSubmit={handleSubmit} noValidate>
                  <div className="lp-form-row">
                    <div className="lp-form-group no-mb">
                      <label className="lp-form-label" htmlFor="from_name">Your Name *</label>
                      <input
                        className="lp-form-input"
                        type="text"
                        id="from_name"
                        name="from_name"
                        placeholder="Rajesh Nair"
                        value={formData.from_name}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    <div className="lp-form-group no-mb">
                      <label className="lp-form-label" htmlFor="phone">Phone Number *</label>
                      <input
                        className="lp-form-input"
                        type="tel"
                        id="phone"
                        name="phone"
                        placeholder="+91 98765 43210"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>
                  <div className="lp-form-group">
                    <label className="lp-form-label" htmlFor="restaurant_name">Restaurant Name *</label>
                    <input
                      className="lp-form-input"
                      type="text"
                      id="restaurant_name"
                      name="restaurant_name"
                      placeholder="Spice Garden"
                      value={formData.restaurant_name}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="lp-form-group">
                    <label className="lp-form-label" htmlFor="from_email">Email Address *</label>
                    <input
                      className="lp-form-input"
                      type="email"
                      id="from_email"
                      name="from_email"
                      placeholder="you@restaurant.com"
                      value={formData.from_email}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="lp-form-group">
                    <label className="lp-form-label" htmlFor="table_count">Number of Tables</label>
                    <select
                      className="lp-form-select"
                      id="table_count"
                      name="table_count"
                      value={formData.table_count}
                      onChange={handleChange}
                    >
                      <option>1–5 tables</option>
                      <option>6–15 tables</option>
                      <option>16–30 tables</option>
                      <option>30+ tables</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className={submitClass}
                    disabled={submitState === 'loading' || submitState === 'success'}
                  >
                    {submitState === 'loading' && <div className="lp-form-spinner" />}
                    {submitState === 'idle' && <IconArrow />}
                    {submitLabel}
                  </button>
                </form>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-grid">
            <div className="lp-footer-brand">
              <div className="lp-footer-logo">
                <div className="lp-footer-logo-square">D</div>
                <span className="lp-footer-logo-text">Diney</span>
              </div>
              <p>Smart restaurant management software for modern Indian kitchens. Connecting every role, from chef to owner.</p>
              <div className="lp-footer-socials">
                <a href="#" className="lp-social-btn" aria-label="Twitter / X"><IconTwitter /></a>
                <a href="#" className="lp-social-btn" aria-label="LinkedIn"><IconLinkedIn /></a>
                <a href="#" className="lp-social-btn" aria-label="Instagram"><IconInstagram /></a>
              </div>
            </div>
            <div className="lp-footer-col">
              <h4>Product</h4>
              <ul>
                <li><a href="#how" onClick={e => { e.preventDefault(); scrollTo('how') }}>How it works</a></li>
                <li><a href="#features" onClick={e => { e.preventDefault(); scrollTo('features') }}>Features</a></li>
                <li><a href="#pricing" onClick={e => { e.preventDefault(); scrollTo('pricing') }}>Pricing</a></li>
                <li><a href="#demo" onClick={e => { e.preventDefault(); scrollTo('demo') }}>Request Demo</a></li>
              </ul>
            </div>
            <div className="lp-footer-col">
              <h4>Modules</h4>
              <ul>
                <li><a href="#features" onClick={e => { e.preventDefault(); scrollTo('features') }}>Kitchen Dashboard</a></li>
                <li><a href="#features" onClick={e => { e.preventDefault(); scrollTo('features') }}>Waiter App</a></li>
                <li><a href="#features" onClick={e => { e.preventDefault(); scrollTo('features') }}>Owner Analytics</a></li>
                <li><a href="#features" onClick={e => { e.preventDefault(); scrollTo('features') }}>Menu Management</a></li>
              </ul>
            </div>
            <div className="lp-footer-col">
              <h4>Company</h4>
              <ul>
                <li><a href="#">About</a></li>
                <li><a href="#">Privacy Policy</a></li>
                <li><a href="#">Terms of Service</a></li>
                <li><a href="#">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="lp-footer-bottom">
            <span>© 2025 Diney. All rights reserved.</span>
            <a href="mailto:hello@diney.in">hello@diney.in</a>
          </div>
        </div>
      </footer>

    </div>
  )
}
