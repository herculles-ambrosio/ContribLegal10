'use client';

import { FaFileAlt, FaRegLightbulb, FaTrophy, FaUserPlus, FaArrowRight } from 'react-icons/fa';
import Layout from '@/components/Layout';
import Button from '@/components/ui/Button';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Image from 'next/image';
import { useEffect, useState } from 'react';

export default function Home() {
  const [isVisible, setIsVisible] = useState({
    hero: false,
    steps: false,
    benefits: false,
    cta: false
  });

  useEffect(() => {
    // Adiciona animações com timeout para criar um efeito sequencial
    setTimeout(() => setIsVisible(prev => ({ ...prev, hero: true })), 100);
    setTimeout(() => setIsVisible(prev => ({ ...prev, steps: true })), 600);
    setTimeout(() => setIsVisible(prev => ({ ...prev, benefits: true })), 1100);
    setTimeout(() => setIsVisible(prev => ({ ...prev, cta: true })), 1600);
  }, []);

  return (
    <Layout>
      {/* Hero Section */}
      <section 
        className={`py-12 rounded-xl mb-12 bg-gradient-blue shadow-lg transition-opacity duration-1000 ease-in-out ${isVisible.hero ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="container mx-auto px-4 text-center">
          <div className="flex justify-center flex-col items-center mb-8">
            <Image 
              src="/LOGO_CL_trans.png" 
              alt="Contribuinte Legal" 
              width={280} 
              height={280} 
              className="mb-6" 
              priority
              style={{ objectFit: 'contain' }}
            />
          </div>
          <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto text-white">
            Cadastre suas notas fiscais, pague seus impostos em dia e concorra a prêmios incríveis!
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/registro">
              <Button 
                variant="success" 
                icon={FaUserPlus}
                className="text-lg py-3 px-8 shadow-lg"
                animated
              >
                Cadastre-se Agora
              </Button>
            </Link>
            <Link href="/sobre">
              <Button 
                variant="info" 
                className="text-lg py-3 px-8 shadow-lg"
                animated
              >
                Saiba Mais
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Como Funciona */}
      <section 
        className={`mb-16 transition-all duration-1000 ease-in-out transform ${isVisible.steps ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}
      >
        <h2 className="text-3xl font-bold text-center mb-12 relative pb-4 after:content-[''] after:absolute after:left-1/2 after:-ml-12 after:bottom-0 after:w-24 after:h-1 after:bg-blue-600 after:rounded-full">Como Funciona</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="text-center p-6 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-2">
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
                <FaFileAlt className="text-4xl text-blue-600 icon-animate" />
              </div>
            </div>
            <h3 className="text-xl font-semibold mb-3 text-blue-800">1. Cadastre seus documentos</h3>
            <p className="text-gray-800">
              Cadastre suas notas fiscais de serviço, vendas e comprovantes de pagamento de impostos.
            </p>
          </Card>
          
          <Card className="text-center p-6 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-2">
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center">
                <FaRegLightbulb className="text-4xl text-yellow-500 icon-animate" />
              </div>
            </div>
            <h3 className="text-xl font-semibold mb-3 text-yellow-700">2. Receba números da sorte</h3>
            <p className="text-gray-800">
              Para cada documento cadastrado, você recebe um número que concorre nos sorteios.
            </p>
          </Card>
          
          <Card className="text-center p-6 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-2">
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <FaTrophy className="text-4xl text-green-600 icon-animate" />
              </div>
            </div>
            <h3 className="text-xl font-semibold mb-3 text-green-700">3. Concorra a prêmios</h3>
            <p className="text-gray-800">
              Você concorre automaticamente aos sorteios realizados periodicamente.
            </p>
          </Card>
        </div>
      </section>

      {/* Benefícios */}
      <section 
        className={`mb-16 bg-gradient-to-br from-blue-50 to-blue-100 py-12 px-4 rounded-xl shadow-inner transition-all duration-1000 ease-in-out transform ${isVisible.benefits ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}
      >
        <h2 className="text-3xl font-bold text-center mb-12 relative pb-4 after:content-[''] after:absolute after:left-1/2 after:-ml-12 after:bottom-0 after:w-24 after:h-1 after:bg-blue-600 after:rounded-full">Benefícios</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="flex items-start bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-all">
            <div className="flex-shrink-0 bg-blue-600 rounded-full p-3 text-white mr-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2 text-blue-800">Sorteios de Prêmios</h3>
              <p className="text-gray-800">
                Concorra a prêmios incríveis apenas por manter seus impostos em dia e cadastrar suas notas fiscais.
              </p>
            </div>
          </div>
          
          <div className="flex items-start bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-all">
            <div className="flex-shrink-0 bg-blue-600 rounded-full p-3 text-white mr-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2 text-blue-800">Organização Financeira</h3>
              <p className="text-gray-800">
                Mantenha todos os seus documentos fiscais organizados em um só lugar, com fácil acesso.
              </p>
            </div>
          </div>
          
          <div className="flex items-start bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-all">
            <div className="flex-shrink-0 bg-blue-600 rounded-full p-3 text-white mr-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2 text-blue-800">Incentivo à Cidadania Fiscal</h3>
              <p className="text-gray-800">
                Contribua para o desenvolvimento do município ao mesmo tempo que é recompensado.
              </p>
            </div>
          </div>
          
          <div className="flex items-start bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-all">
            <div className="flex-shrink-0 bg-blue-600 rounded-full p-3 text-white mr-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2 text-blue-800">Processo Simples</h3>
              <p className="text-gray-800">
                Interface intuitiva e fácil de usar, cadastre seus documentos em poucos cliques.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section 
        className={`text-center py-12 px-4 bg-gradient-blue text-white rounded-xl shadow-xl transition-all duration-1000 ease-in-out transform ${isVisible.cta ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}
      >
        <h2 className="text-3xl font-bold mb-6">Pronto para participar?</h2>
        <p className="text-xl mb-8 max-w-3xl mx-auto">
          Junte-se a milhares de contribuintes que já estão participando e concorrendo a prêmios!
        </p>
        <Link href="/registro">
          <Button 
            variant="success" 
            className="text-lg py-3 px-8 shadow-lg"
            icon={FaArrowRight}
            animated
          >
            Cadastre-se Gratuitamente
          </Button>
        </Link>
      </section>
    </Layout>
  );
}
