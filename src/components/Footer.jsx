import BrandIcon from './BrandIcon';

export default function Footer() {
  return (
    <footer className="app-footer">
      <span className="footer-logo"><BrandIcon size={15} /></span>
      <span>Bill Hive &copy; {new Date().getFullYear()} — offline-first billing</span>
    </footer>
  );
}
