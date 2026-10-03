import { io } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export const socket = io(SOCKET_URL);

export interface NetworkProbeResult {
// ... (existing code)

  rtt: number;
  bandwidth: number;
}

export async function runNetworkProbe(): Promise<NetworkProbeResult> {
  const start = performance.now();
  // Small probe request to measure RTT
  await fetch(`${SOCKET_URL}/health`);
  const end = performance.now();

  // Mock bandwidth calculation for simulation
  // In real production, we'd download a small chunk of known size
  const mockBandwidth = Math.random() * 15; // 0 - 15 Mbps

  return {
    rtt: end - start,
    bandwidth: mockBandwidth,
  };
}
