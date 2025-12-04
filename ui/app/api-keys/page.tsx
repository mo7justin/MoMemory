"use client";

import React from 'react';
import { ApiKeyManager } from '@/components/ApiKeyManager';

export default function ApiKeysPage() {
  return (
    <div className="container max-w-7xl py-8 space-y-8">
      {/* Main Content - Reusing ApiKeyManager with full access */}
      <div className="mt-6">
         <ApiKeyManager />
      </div>
    </div>
  );
}


