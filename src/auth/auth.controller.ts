import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { LoginDto, LoginResponseDto } from '../staff-users/dto/staff-user.dto';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate a staff user' })
  @ApiOkResponse({
    description: 'JWT access token and authenticated staff profile.',
    type: LoginResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid login request payload.' })
  @ApiUnauthorizedResponse({ description: 'Invalid staff credentials.' })
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }
}
