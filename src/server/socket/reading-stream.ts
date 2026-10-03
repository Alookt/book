import { Server, Socket } from 'socket.io';
import { PacketManager, NetworkProbeResult } from '../transport/packet-manager';

export class ReadingStreamHandler {
  constructor(
    private io: Server,
    private packetManager: PacketManager
  ) {}

  public handleConnection(socket: Socket) {
    // 1. Initial Network Probe
    socket.on('network_probe', async (probeData: NetworkProbeResult) => {
      console.log(`Network probe received from ${socket.id}:`, probeData);
      const quality = this.packetManager.determineQuality(probeData);
      socket.emit('probe_result', { quality });
    });

    // 2. Request Packet
    socket.on('request_packet', async (data: { segmentId: string, probe: NetworkProbeResult }) => {
      const quality = this.packetManager.determineQuality(data.probe);
      const packet = await this.packetManager.getPacket(data.segmentId, quality);
      socket.emit('packet_delivered', packet);
    });

    // 3. Sync Pointer
    socket.on('sync_pointer', (data: { charIndex: number, segmentId: string }) => {
      // Logic to track reader progress and potentially pre-buffer next packets
      console.log(`Reader ${socket.id} at char ${data.charIndex} in ${data.segmentId}`);

      // Pre-buffer next 3 segments
      this.packetManager.getPriorityQueue(data.segmentId).then(queue => {
        socket.emit('priority_queue_update', queue);
      });
    });
  }
}
