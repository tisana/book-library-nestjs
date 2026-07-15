import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { LoginDto, LoginResponseDto } from '../staff-users/dto/staff-user.dto';
import { MemberLoginDto, MemberLoginResponseDto } from './dto/member-auth.dto';
import { AuthService, refreshCookieName } from './auth.service';
import { JwtAuthGuard, getRequestAuthContext } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { AuthBrowserOriginGuard } from './auth-browser-origin.guard';
import {
  assertAuthThrottleAllowed,
  AuthEndpointThrottleGuard,
  RequestWithAuthThrottle,
} from './auth-endpoint-throttle.guard';
import { AuthThrottleService } from './auth-throttle.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authThrottleService: AuthThrottleService,
  ) {}

  @Post('login')
  @UseGuards(AuthBrowserOriginGuard, AuthEndpointThrottleGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate a staff user' })
  @ApiOkResponse({
    description: 'JWT access token and authenticated staff profile.',
    type: LoginResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid login request payload.' })
  @ApiUnauthorizedResponse({ description: 'Invalid staff credentials.' })
  async login(
    @Req() request: RequestWithAuthThrottle,
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const session = await this.authService
      .createStaffSession(dto)
      .catch(async (error: unknown) => {
        await this.recordIdentifierFailure(request, response);
        throw error;
      });
    this.setRefreshCookie(
      response,
      session.refreshToken,
      session.refreshExpiresAt,
    );
    return session.response;
  }

  @Post('member-login')
  @UseGuards(AuthBrowserOriginGuard, AuthEndpointThrottleGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate a member user' })
  @ApiOkResponse({
    description: 'JWT access token and authenticated member profile.',
    type: MemberLoginResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid member login request payload.',
  })
  @ApiUnauthorizedResponse({ description: 'Invalid member credentials.' })
  async memberLogin(
    @Req() request: RequestWithAuthThrottle,
    @Body() dto: MemberLoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MemberLoginResponseDto> {
    const session = await this.authService
      .createMemberSession(dto)
      .catch(async (error: unknown) => {
        await this.recordIdentifierFailure(request, response);
        throw error;
      });
    this.setRefreshCookie(
      response,
      session.refreshToken,
      session.refreshExpiresAt,
    );
    return session.response;
  }

  @Post('refresh')
  @UseGuards(AuthBrowserOriginGuard, AuthEndpointThrottleGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate refresh token and issue a new access token',
  })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto | MemberLoginResponseDto> {
    const refreshToken = this.getRefreshCookie(request);
    const session = await this.authService.refresh(refreshToken);
    this.setRefreshCookie(
      response,
      session.refreshToken,
      session.refreshExpiresAt,
    );
    return session.response;
  }

  @Post('logout')
  @UseGuards(AuthBrowserOriginGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign out the current refresh session' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ success: true }> {
    await this.authService.logout(this.getRefreshCookie(request));
    this.clearRefreshCookie(response);
    return { success: true };
  }

  @Post('logout-all')
  @UseGuards(AuthBrowserOriginGuard, JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign out all refresh sessions for the subject' })
  async logoutAll(
    @CurrentUser() user: Parameters<typeof getRequestAuthContext>[0],
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ success: true }> {
    const authContext = getRequestAuthContext(user);

    if (authContext) {
      await this.authService.logoutAll(authContext);
    }

    this.clearRefreshCookie(response);
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Return current authenticated subject' })
  me(@CurrentUser() user: Record<string, unknown>): Record<string, unknown> {
    if (user.roleArea === 'member') {
      return {
        roleArea: 'member',
        member: {
          id: user.id,
          memberNumber: user.memberNumber,
        },
        permissions: user.permissions,
      };
    }

    return {
      roleArea: 'staff',
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        roles: user.roles,
        permissions: user.permissions,
      },
    };
  }

  private setRefreshCookie(
    response: Response,
    refreshToken: string,
    expiresAt: Date,
  ): void {
    response.cookie(refreshCookieName, refreshToken, {
      ...this.authService.getRefreshCookieOptions(expiresAt),
    });
  }

  private clearRefreshCookie(response: Response): void {
    response.cookie(refreshCookieName, '', {
      ...this.authService.getClearRefreshCookieOptions(),
      maxAge: 0,
    });
  }

  private getRefreshCookie(request: Request): string {
    const cookieHeader = request.headers.cookie ?? '';
    const cookie = cookieHeader
      .split(';')
      .map((value) => value.trim())
      .find((value) => value.startsWith(`${refreshCookieName}=`));

    return decodeURIComponent(cookie?.split('=').slice(1).join('=') ?? '');
  }

  private async recordIdentifierFailure(
    request: RequestWithAuthThrottle,
    response: Response,
  ): Promise<void> {
    const normalizedIdentifier = request.authThrottle?.normalizedIdentifier;

    if (!normalizedIdentifier) {
      return;
    }

    const decision = await this.authThrottleService
      .consumeSignInIdentifierFailure(normalizedIdentifier, 'invalid-password')
      .catch(() => ({ allowed: false }));
    assertAuthThrottleAllowed(decision, response);
  }
}
