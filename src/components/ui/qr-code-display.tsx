'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from './button';
import { Copy, Check } from 'lucide-react';

interface QrCodeDisplayProps {
  url: string;
}

export function QrCodeDisplay({ url }: QrCodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (non-HTTPS, permissions denied) — fail silently
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="p-3 bg-white rounded-lg border shadow-sm">
        <QRCodeSVG value={url} size={180} />
      </div>
      <p className="text-xs text-muted-foreground text-center break-all max-w-xs px-2">
        {url}
      </p>
      <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
        {copied ? (
          <Check size={14} className="text-green-600" />
        ) : (
          <Copy size={14} />
        )}
        {copied ? 'Copiado' : 'Copiar enlace'}
      </Button>
    </div>
  );
}
