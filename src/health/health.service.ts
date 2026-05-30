import { Injectable } from '@nestjs/common';

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
  uptimeSeconds: number;
}

@Injectable()
export class HealthService {
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
