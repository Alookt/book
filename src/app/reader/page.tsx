'use client';

import React, { useEffect, useState, useRef } from 'react';
import { socket, runNetworkProbe } from '@/lib/socket';
import { syncEngine, SyncMapEntry } from '@/lib/sync-engine';
import { motion, AnimatePresence } from 'framer-motion';

export default function ReaderPage() {
  const [text, setText] = useState('The cinematic journey begins here. As you read, the world around you shifts and evolves based on your gaze...');
  const [currentAsset, setCurrentAsset] = useState<string>('default-visual');
  const [quality, setQuality] = useState<string>('loading...');
  const textRef = useRef<HTMLDivElement>(null);

  // Mock SyncMap for demonstration
  const mockSyncMap: SyncMapEntry[] = [
    { charIndex: 0, visualAssetId: 'intro-visual', audioTimestamp: 0 },
    { charIndex: 20, visualAssetId: 'journey-visual', audioTimestamp: 2.5 },
    { charIndex: 60, visualAssetId: 'evolve-visual', audioTimestamp: 7.2 },
  ];

  useEffect(() => {
    async function initReader() {
      // 1. Network Probe
      const probe = await runNetworkProbe();
      socket.emit('network_probe', probe);

      socket.on('probe_result', (data: { quality: string }) => {
        setQuality(data.quality);
      });

      // 2. Initial Packet Request
      socket.emit('request_packet', {
        segmentId: 'seg_1',
        probe
      });

      socket.on('packet_delivered', (packet) => {
        console.log('Received packet:', packet);
      });
    }

    initReader();
    return () => {
      socket.off('probe_result');
      socket.off('packet_delivered');
    };
  }, []);

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!textRef.current) return;

    // Simplified character index calculation based on pointer position
    const rect = textRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // This is a mock calculation; in production, we use a hidden mirror element or range selection
    const estimatedCharIndex = Math.floor((x / rect.width) * text.length);

    socket.emit('sync_pointer', {
      charIndex: estimatedCharIndex,
      segmentId: 'seg_1'
    });

    const entry = syncEngine.updatePointer(estimatedCharIndex, mockSyncMap);
    if (entry) {
      setCurrentAsset(entry.visualAssetId);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 relative overflow-hidden">
      {/* Cinematic Visual Side-Frame */}
      <div className="absolute inset-0 z-0 opacity-40">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentAsset}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 1.5 }}
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(/api/placeholder/1920/1080?text=${currentAsset})` }}
          />
        </AnimatePresence>
      </div>

      {/* Reading Area */}
      <div
        ref={textRef}
        onPointerMove={handlePointerMove}
        className="z-10 max-w-2xl text-center text-3xl font-light leading-relaxed cursor-crosshair select-none"
      >
        {text}
      </div>

      {/* Quality Indicator */}
      <div className="absolute bottom-4 right-4 text-xs opacity-50 font-mono">
        Network Quality: {quality}
      </div>
    </div>
  );
}
