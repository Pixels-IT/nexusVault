import { APP_VERSION } from '../version.js';

export default function Footer() {
  return (
    <footer className="footer-bar">
      <span>© 2026 NexusVault — AGPL-3.0 — {APP_VERSION}</span>
    </footer>
  );
}
