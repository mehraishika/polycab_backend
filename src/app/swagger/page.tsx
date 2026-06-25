import type { Metadata } from 'next';

import SwaggerUIClient from './SwaggerUIClient';

export const metadata: Metadata = {
  title: 'API Swagger',
  description: 'Interactive API documentation',
};

export default function SwaggerPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#fff' }}>
      <SwaggerUIClient />
    </main>
  );
}
