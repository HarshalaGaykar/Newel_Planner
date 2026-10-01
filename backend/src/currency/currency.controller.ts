import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/rbac.guard';
import { Roles } from '../auth/decorators/rbac.decorator';
import { Role } from '../auth/constants/rbac.constants';
import { CurrencyService } from './currency.service';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Currencies')
@ApiBearerAuth()
@Controller({ path: 'currencies', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class CurrencyController {
  constructor(private currencyService: CurrencyService) {}

  @Get()
  @ApiOperation({ summary: 'Get a list of all currencies' })
  findAll() {
    return this.currencyService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single currency by ID' })
  findOne(@Param('id') id: string) {
    return this.currencyService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new currency' })
  create(@Body() dto: CreateCurrencyDto) {
    return this.currencyService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing currency by ID' })
  update(@Param('id') id: string, @Body() dto: UpdateCurrencyDto) {
    return this.currencyService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a currency by ID' })
  remove(@Param('id') id: string) {
    return this.currencyService.remove(id);
  }
}
