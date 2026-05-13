import { UnauthorizedCanvasActionError } from '../../domain/errors';
import type { AuthTokenClaims } from '../../domain/types';
import type { JwtProviderPort, OidcProviderPort, PolicyEnginePort, TimeProviderPort } from '../ports';

export interface AuthenticationServiceDependencies {
  jwtProvider: JwtProviderPort;
  oidcProvider: OidcProviderPort;
  policyEngine: PolicyEnginePort;
  timeProvider: TimeProviderPort;
  issuer: string;
  audience: string;
  defaultTokenLifetimeSeconds?: number;
}

export class AuthenticationService {
  private readonly tokenLifetimeSeconds: number;

  constructor(private readonly deps: AuthenticationServiceDependencies) {
    this.tokenLifetimeSeconds = deps.defaultTokenLifetimeSeconds ?? 3600;
  }

  async issueServiceToken(identity: {
    userId: string;
    tenantId: string;
    franchiseId?: string;
    roles: string[];
    permissions: string[];
  }): Promise<string> {
    const now = this.deps.timeProvider.nowEpochSeconds();
    const claims: AuthTokenClaims = {
      sub: identity.userId,
      tenantId: identity.tenantId,
      franchiseId: identity.franchiseId,
      roles: identity.roles,
      permissions: identity.permissions,
      iat: now,
      exp: now + this.tokenLifetimeSeconds,
      iss: this.deps.issuer,
      aud: this.deps.audience,
    };

    return this.deps.jwtProvider.issue(claims);
  }

  async exchangeOAuthCode(code: string, redirectUri: string): Promise<{ accessToken: string; refreshToken?: string }> {
    return this.deps.oidcProvider.exchangeAuthorizationCode(code, redirectUri);
  }

  async authorize(token: string, permission: string, context?: Record<string, unknown>): Promise<AuthTokenClaims> {
    const claims = await this.deps.jwtProvider.verify(token);
    if (claims.exp <= this.deps.timeProvider.nowEpochSeconds()) {
      throw new UnauthorizedCanvasActionError('token_expired', { sub: claims.sub, tenantId: claims.tenantId });
    }

    const allowed = await this.deps.policyEngine.hasPermission(claims, permission, context);
    if (!allowed) {
      throw new UnauthorizedCanvasActionError(permission, {
        sub: claims.sub,
        tenantId: claims.tenantId,
        franchiseId: claims.franchiseId,
      });
    }

    return claims;
  }
}
