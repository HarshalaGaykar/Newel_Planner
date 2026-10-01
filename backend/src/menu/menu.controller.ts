import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, PermissionsGuard } from '../auth/guards/rbac.guard';
import { Roles, Permissions } from '../auth/decorators/rbac.decorator';
import { Role, Permission } from '../auth/constants/rbac.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MenuService } from './menu.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { ReorderMenuDto } from './dto/reorder-menu.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';

@ApiTags('Menu')
@ApiBearerAuth()
@Controller({ path: 'menu', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class MenuController {
  constructor(private menuService: MenuService) {}

  @Post()
  @Roles(Role.ADMIN)
  @Permissions(Permission.MENU_CREATE)
  @ApiOperation({ summary: 'Create a new menu item' })
  create(@Body() dto: CreateMenuDto) {
    return this.menuService.create(dto);
  }

  @Get()
  @Roles(Role.ADMIN)
  @Permissions(Permission.MENU_READ)
  @ApiOperation({ summary: 'Get the full hierarchical list of menu items' })
  findAll() {
    return this.menuService.findAll();
  }

  @Get('flat')
  @Roles(Role.ADMIN)
  @Permissions(Permission.MENU_READ)
  @ApiOperation({ summary: 'Get a flat list of all menu items' })
  findAllFlat() {
    return this.menuService.findAllFlat();
  }

  // Must be declared before :id — any authenticated user, no role/permission restriction
  @Get('my-menu')
  @ApiOperation({ summary: 'Get the menu items visible to the current user based on permissions' })
  getMyMenu(@CurrentUser('permissions') permissions: string[]) {
    return this.menuService.getUserMenu(permissions ?? []);
  }

  // Must be declared before :id to avoid route conflict
  @Patch('reorder')
  @Roles(Role.ADMIN)
  @Permissions(Permission.MENU_UPDATE)
  reorder(@Body() dto: ReorderMenuDto) {
    return this.menuService.reorder(dto);
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  @Permissions(Permission.MENU_READ)
  findOne(@Param('id') id: string) {
    return this.menuService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @Permissions(Permission.MENU_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdateMenuDto) {
    return this.menuService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @Permissions(Permission.MENU_DELETE)
  remove(@Param('id') id: string) {
    return this.menuService.remove(id);
  }

  @Patch(':id/permissions')
  @Roles(Role.ADMIN)
  @Permissions(Permission.MENU_UPDATE)
  assignPermissions(@Param('id') id: string, @Body() dto: AssignPermissionsDto) {
    return this.menuService.assignPermissions(id, dto);
  }
}
