import Link from 'next/link';
import { FaEnvelope, FaPhone, FaMapMarkerAlt } from 'react-icons/fa';
import { MdLocationOn } from 'react-icons/md';
import Image from 'next/image';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-gray-800 text-white pt-10 pb-6">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="mb-4">
              <Image 
                src="/LOGO CL.jpeg" 
                alt="Contribuinte Legal" 
                width={110} 
                height={110} 
                className="rounded-md shadow-md" 
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
            <p className="mb-4">
              Sistema para cadastro de documentos fiscais e participação em sorteios de prêmios.
            </p>
            <p className="text-sm opacity-75">
              © {currentYear} H-Tech Minas. Todos os direitos reservados.
            </p>
          </div>
          
          <div>
            <h3 className="text-xl font-bold mb-4">Links Úteis</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="hover:text-blue-300 transition-colors">
                  Início
                </Link>
              </li>
              <li>
                <Link href="/sobre" className="hover:text-blue-300 transition-colors">
                  Sobre o Programa
                </Link>
              </li>
              <li>
                <Link href="/regulamento" className="hover:text-blue-300 transition-colors">
                  Regulamento
                </Link>
              </li>
              <li>
                <Link href="/premios" className="hover:text-blue-300 transition-colors">
                  Prêmios
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-xl font-bold mb-4">Contato</h3>
            <ul className="space-y-2">
              <li className="flex items-center space-x-2">
                <FaEnvelope />
                <span>contato@contribuintelegal.com.br</span>
              </li>
              <li className="flex items-center space-x-2">
                <FaPhone />
                <span>(31) 9999-9999</span>
              </li>
              <li className="flex items-center space-x-2">
                <FaMapMarkerAlt />
                <span className="flex items-center">
                  <MdLocationOn className="mr-2 text-xl text-blue-600" />
                  <span>Lajinha, MG</span>
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
} 