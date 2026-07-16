import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { LoginClient } from './LoginClient';

export const metadata: Metadata = {
  title: 'Iniciar sesión',
};

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingScreen label="Preparando acceso seguro" />}>
      <LoginClient />
    </Suspense>
  );
}
