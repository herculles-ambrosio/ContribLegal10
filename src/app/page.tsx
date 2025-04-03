'use client';

import { FaFileAlt, FaRegLightbulb, FaTrophy, FaUserPlus } from 'react-icons/fa';
import Layout from '@/components/Layout';
import Button from '@/components/ui/Button';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Image from 'next/image';

export default function Home() {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="py-16 rounded-lg mb-12">
        <div className="container mx-auto px-4 text-center">
          <div className="flex justify-center flex-col items-center mb-8">
            <Image 
              src="/LOGO CL.jpeg" 
              alt="Contribuinte Legal" 
              width={280} 
              height={280} 
              className="rounded-md shadow-lg mb-6" 
              priority
              style={{ objectFit: 'contain' }}
            />
          </div>
          <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto text-gray-700">
            Cadastre suas notas fiscais, pague seus impostos em dia e concorra a prêmios incríveis!
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/registro">
              <Button 
                variant="success" 
                icon={FaUserPlus}
                className="text-lg py-3 px-8"
              >
                Cadastre-se Agora
              </Button>
            </Link>
            <Link href="/sobre">
              <Button 
                variant="info" 
                className="text-lg py-3 px-8"
              >
                Saiba Mais
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Como Funciona */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-12">Como Funciona</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="text-center p-6">
            <div className="flex justify-center mb-4">
              <FaFileAlt className="text-5xl text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold mb-3">1. Cadastre seus documentos</h3>
            <p className="text-gray-600">
              Cadastre suas notas fiscais de serviço, vendas e comprovantes de pagamento de impostos.
            </p>
          </Card>
          
          <Card className="text-center p-6">
            <div className="flex justify-center mb-4">
              <FaRegLightbulb className="text-5xl text-yellow-500" />
            </div>
            <h3 className="text-xl font-semibold mb-3">2. Receba números da sorte</h3>
            <p className="text-gray-600">
              Para cada documento cadastrado, você recebe um número que concorre nos sorteios.
            </p>
          </Card>
          
          <Card className="text-center p-6">
            <div className="flex justify-center mb-4">
              <FaTrophy className="text-5xl text-green-600" />
            </div>
            <h3 className="text-xl font-semibold mb-3">3. Concorra a prêmios</h3>
            <p className="text-gray-600">
              Você concorre automaticamente aos sorteios realizados periodicamente.
            </p>
          </Card>
        </div>
      </section>

      {/* Benefícios */}
      <section className="mb-16 bg-gray-50 py-12 px-4 rounded-lg">
        <h2 className="text-3xl font-bold text-center mb-12">Benefícios</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="flex items-start">
            <div className="flex-shrink-0 bg-blue-600 rounded-full p-3 text-white mr-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Sorteios de Prêmios</h3>
              <p className="text-gray-600">
                Concorra a prêmios incríveis apenas por manter seus impostos em dia e cadastrar suas notas fiscais.
              </p>
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="flex-shrink-0 bg-blue-600 rounded-full p-3 text-white mr-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Organização Financeira</h3>
              <p className="text-gray-600">
                Mantenha todos os seus documentos fiscais organizados em um só lugar, com fácil acesso.
              </p>
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="flex-shrink-0 bg-blue-600 rounded-full p-3 text-white mr-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Incentivo à Cidadania Fiscal</h3>
              <p className="text-gray-600">
                Contribua para o desenvolvimento do município ao mesmo tempo que é recompensado.
              </p>
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="flex-shrink-0 bg-blue-600 rounded-full p-3 text-white mr-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Processo Simples</h3>
              <p className="text-gray-600">
                Interface intuitiva e fácil de usar, cadastre seus documentos em poucos cliques.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="text-center py-12 px-4 bg-gray-900 text-white rounded-lg">
        <h2 className="text-3xl font-bold mb-6">Pronto para participar?</h2>
        <p className="text-xl mb-8 max-w-3xl mx-auto">
          Junte-se a milhares de contribuintes que já estão participando e concorrendo a prêmios!
        </p>
        <Link href="/registro">
          <Button 
            variant="success" 
            className="text-lg py-3 px-8"
          >
            Cadastre-se Gratuitamente
          </Button>
        </Link>
      </section>
    </Layout>
  );
}
