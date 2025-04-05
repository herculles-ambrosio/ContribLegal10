import Navbar from './Navbar';
import Footer from './Footer';
import Header from './Header';

type LayoutProps = {
  children: React.ReactNode;
  isAuthenticated?: boolean;
};

export default function Layout({ children, isAuthenticated = false }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <Header isAuthenticated={isAuthenticated} />
      <main className="flex-grow container mx-auto px-4 py-8">
        {children}
      </main>
      <Footer />
    </div>
  );
} 