import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    Query,
    UseGuards,
} from '@nestjs/common';
import { SkillCategoryService } from './skill-category.service';
import { CreateSkillCategoryDto } from './dto/create-update.dto';
import { UpdateSkillCategoryDto } from './dto/create-update.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RolesGuard } from '../auth/guards/rbac.guard';
import { Permissions, Roles } from '../auth/decorators/rbac.decorator';
import { Permission, Role } from '../auth/constants/rbac.constants';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Skill Category')
@ApiBearerAuth()
@Controller({ path: 'skill-category', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class SkillCategoryServiceController {
    constructor(private readonly skillCategoryService: SkillCategoryService) {}

    @Get()
    @UseGuards(PermissionsGuard)
    @Permissions(Permission.ADMIN_CONFIG_VIEW, Permission.ADMIN_CONFIG_EDIT)
    @ApiOperation({ summary: 'Get a list of all skill categories' })
    findAll() {
        return this.skillCategoryService.findAll();
    }

    @Get(':id')
    @UseGuards(PermissionsGuard)
    @Permissions(Permission.ADMIN_CONFIG_VIEW, Permission.ADMIN_CONFIG_EDIT)
    @ApiOperation({ summary: 'Get a single skill category by ID' })
    findOne(@Param('id') id: string) {
        return this.skillCategoryService.findById(id);
    }

    @Patch(':id')
    @UseGuards(PermissionsGuard)
    @Permissions(Permission.ADMIN_CONFIG_EDIT)
    @ApiOperation({ summary: 'Update an existing skill category by ID' })
    update(@Param('id') id: string, @Body() updateSkillCategoryDto: UpdateSkillCategoryDto) {
        return this.skillCategoryService.update(id, updateSkillCategoryDto);
    }

    @Post()
    @UseGuards(PermissionsGuard)
    @Permissions(Permission.ADMIN_CONFIG_EDIT)
    @ApiOperation({ summary: 'Create a new skill category' })
    create(@Body() createSkillCategoryDto: CreateSkillCategoryDto) {
        return this.skillCategoryService.create(createSkillCategoryDto);
    }

}

