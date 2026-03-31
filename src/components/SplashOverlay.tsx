'use client';

interface SplashOverlayProps {
  visible: boolean;
}

const NAV_ITEMS = [
  { label: 'Our Work', href: '#work' },
  { label: 'Contact', href: '#contact' },
  { label: 'About', href: '#about' },
  { label: 'Journal', href: '#journal' },
];

export function SplashOverlay({ visible }: SplashOverlayProps) {
  return (
    <div className={`splash-overlay ${visible ? '--visible' : ''}`}>
      {/* Brand */}
      <div style={{ textAlign: 'center' }}>
        <h1 className="logo">ghostcode</h1>
        <p className="logo-sub">step into the unknown</p>
      </div>

      {/* Navigation */}
      <div className="nav-items">
        {NAV_ITEMS.map((item) => (
          <a key={item.label} href={item.href} className="nav-item">
            {item.label}
          </a>
        ))}
      </div>
    </div>
  );
}
