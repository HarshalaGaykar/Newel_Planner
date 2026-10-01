import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const roles = await prisma.role.findMany({
    include: {
      permissions: {
        include: {
          permission: true
        }
      }
    }
  });

  const menus = await prisma.menu.findMany({
    include: {
      permissions: {
        include: {
          permission: true
        }
      }
    },
    orderBy: { order: 'asc' }
  });

  const allPerms = await prisma.permission.findMany();

  console.log('=== ROLE-MENU ACCESS MATRIX ===');
  
  const matrix: any[] = [];
  
  for (const menu of menus) {
    const menuRoles = roles.filter(role => {
      // Accessible if no perms required OR role has at least one of the required perms
      if (menu.permissions.length === 0) return true;
      return menu.permissions.some(mp => 
        role.permissions.some(rp => rp.permission.name === mp.permission.name)
      );
    });

    // Also consider ancestors
    // In MenuService.getUserMenu, if a descendant is accessible, the ancestor is visible.
    // So if any child of this menu is accessible to the role, the menu itself is visible.
    // Let's refine this check.
    
    matrix.push({
      Menu: menu.name,
      Path: menu.path,
      RequiredPerms: menu.permissions.map(p => p.permission.name).join(', ') || 'PUBLIC',
      VisibleTo: menuRoles.map(r => r.name).join(', ') || 'NONE'
    });
  }

  console.table(matrix);

  console.log('\n=== CRITICAL ISSUES ===');
  
  const blockedMenus = matrix.filter(m => m.VisibleTo === 'NONE');
  if (blockedMenus.length > 0) {
    console.log('❌ The following menus are NOT VISIBLE to any role:');
    blockedMenus.forEach(m => console.log(`- ${m.Menu} (${m.Path}) [Requires: ${m.RequiredPerms}]`));
  } else {
    console.log('✅ All menus are visible to at least one role.');
  }

  // Check for common roles (Admin, PM)
  const adminRole = roles.find(r => r.name === 'ADMIN');
  if (adminRole) {
    const adminMissingMenus = matrix.filter(m => !m.VisibleTo.includes('ADMIN'));
    if (adminMissingMenus.length > 0) {
      console.log('\n❌ ADMIN is missing access to these menus:');
      adminMissingMenus.forEach(m => console.log(`- ${m.Menu} (${m.Path})`));
    } else {
      console.log('\n✅ ADMIN has access to all menus.');
    }
  } else {
    console.log('\n⚠️ ADMIN role not found in database!');
  }

  console.log('\n=== ICON VALIDATION ===');
  const validIcons = ['🏠', '📁', '⏱️', '🌴', '💰', '👥', '⚙️', '🧑‍💼', '📊', '💼', '📚', '📋', '🏳️', '🎫', '📉', '🚨', 'BarChart3', 'TrendingUp', 'Target', 'Users', 'Briefcase', 'LayoutDashboard', 'ShieldCheck', '🪄', '📥', '📈', '💻', '🏢', '📍'];
  const invalidIconMenus = menus.filter(m => m.icon && !validIcons.includes(m.icon));
  if (invalidIconMenus.length > 0) {
    console.log('⚠️ The following menus have icons NOT in the IconMap:');
    invalidIconMenus.forEach(m => console.log(`- ${m.name}: ${m.icon}`));
  } else {
    console.log('✅ All menu icons are recognized.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
