import { Module } from '@nestjs/common';
import { SkillCategoryServiceController } from './skill-category.controller';
import { SkillCategoryService } from './skill-category.service';

@Module({
  controllers: [SkillCategoryServiceController],
  providers: [SkillCategoryService],
  exports: [SkillCategoryService],
})
export class SkillCategoryModule {}
