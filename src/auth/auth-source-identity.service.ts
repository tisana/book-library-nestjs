import { isIP } from 'node:net';
import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IncomingHttpHeaders, IncomingMessage } from 'node:http';
// proxy-addr publishes a TypeScript `export =` declaration.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import proxyAddr = require('proxy-addr');

export interface AuthSourceRequest {
  headers?: IncomingHttpHeaders | Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string | null };
  connection?: { remoteAddress?: string | null };
}

const UNKNOWN_SOURCE_IDENTITY = 'unknown-peer';

@Injectable()
export class AuthSourceIdentityService {
  private readonly trustedProxyCidrs: string[];
  private readonly trustProxy?: (address: string, index: number) => boolean;

  constructor(@Optional() private readonly configService?: ConfigService) {
    this.trustedProxyCidrs = this.loadTrustedProxyCidrs();
    this.trustProxy = this.trustedProxyCidrs.length
      ? proxyAddr.compile(this.trustedProxyCidrs)
      : undefined;
  }

  resolve(request: AuthSourceRequest): string {
    const directPeer = this.normalizeAddress(
      request.socket?.remoteAddress ?? request.connection?.remoteAddress,
    );

    if (!directPeer) {
      return UNKNOWN_SOURCE_IDENTITY;
    }

    if (!this.trustProxy || !this.trustProxy(directPeer, 0)) {
      return directPeer;
    }

    try {
      const proxyRequest = this.asProxyAddrRequest(request, directPeer);
      const chain = proxyAddr.all(proxyRequest, this.trustProxy);
      const normalizedChain = chain.map((address) =>
        this.normalizeAddress(address),
      );

      if (normalizedChain.some((address) => !address)) {
        return directPeer;
      }

      return normalizedChain[normalizedChain.length - 1] ?? directPeer;
    } catch {
      return directPeer;
    }
  }

  private loadTrustedProxyCidrs(): string[] {
    const configured = this.configService?.get<unknown>(
      'auth.trustedProxyCidrs',
    );
    const raw = configured ?? process.env.AUTH_TRUSTED_PROXY_CIDRS ?? [];
    const parsed = typeof raw === 'string' ? this.parseJsonArray(raw) : raw;

    if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== 'string')) {
      throw new Error('AUTH_TRUSTED_PROXY_CIDRS must be a JSON string array');
    }

    try {
      if (parsed.length) {
        proxyAddr.compile(parsed);
      }
    } catch {
      throw new Error('AUTH_TRUSTED_PROXY_CIDRS contains an invalid CIDR');
    }

    return [...parsed];
  }

  private parseJsonArray(raw: string): unknown {
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error('AUTH_TRUSTED_PROXY_CIDRS must be valid JSON');
    }
  }

  private normalizeAddress(address: string | null | undefined): string | undefined {
    if (!address) {
      return undefined;
    }

    const unwrapped = address.startsWith('[') && address.endsWith(']')
      ? address.slice(1, -1)
      : address;
    const ipv4Mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(unwrapped);
    const normalized = ipv4Mapped?.[1] ?? unwrapped.toLowerCase();

    return isIP(normalized) ? normalized : undefined;
  }

  private asProxyAddrRequest(
    request: AuthSourceRequest,
    directPeer: string,
  ): IncomingMessage {
    return {
      headers: request.headers ?? {},
      connection: { remoteAddress: directPeer },
      socket: { remoteAddress: directPeer },
    } as IncomingMessage;
  }
}
