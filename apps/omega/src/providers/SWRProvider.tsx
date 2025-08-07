'use client';

import { SWRConfig } from 'swr';
import { ReactNode } from 'react';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.');
    throw error;
  }
  return res.json();
};

interface SWRProviderProps {
  children: ReactNode;
}

export function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig
      value={{
        fetcher,
        refreshInterval: 0,
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        dedupingInterval: 2000,
        errorRetryCount: 3,
        errorRetryInterval: 5000,
        onError: (error, key) => {
          if (error.status !== 403 && error.status !== 404) {
            console.error(`SWR Error for ${key}:`, error);
          }
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}