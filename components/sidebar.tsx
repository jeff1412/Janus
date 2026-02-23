'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Ticket,
  Building2,
  Users,
  Settings,
  LogOut,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface SidebarProps {
  userEmail?: string;
}

export function Sidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const navItems = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      label: 'Tickets',
      href: '/dashboard/tickets',
      icon: Ticket,
    },
    {
      label: 'Buildings',
      href: '/dashboard/buildings',
      icon: Building2,
    },
    {
      label: 'Vendors',
      href: '/dashboard/vendors',
      icon: Users,
    },
    {
      label: 'Admin',
      href: '/dashboard/admin',
      icon: Settings,
    },
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-64 h-screen bg-[#3EB489] text-slate-900 border-r border-emerald-300/60 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-emerald-300/60 bg-white/20 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
            <span className="text-[#3EB489] font-bold">J</span>
          </div>
          <div>
            <h1 className="font-bold text-slate-900 text-lg">JANUS</h1>
            <p className="text-xs text-slate-700/80">Management</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={active ? 'secondary' : 'ghost'}
                className={`w-full justify-start gap-3 rounded-lg transition-colors ${
                  active
                    ? 'bg-white text-emerald-700 hover:bg-emerald-50 shadow-sm'
                    : 'text-emerald-950/80 hover:text-emerald-900 hover:bg-emerald-50/70'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-emerald-300/60 bg-white/10 backdrop-blur-sm space-y-3">
        <div className="px-3 py-2 rounded-lg bg-white/70 border border-white/80 shadow-sm">
          <p className="text-xs text-slate-600">Logged in as</p>
          <p className="text-sm text-slate-900 truncate font-medium">
            {userEmail || 'user@janus.com'}
          </p>
        </div>
        <Button
          onClick={handleLogout}
          variant="ghost"
          className="w-full justify-start gap-3 text-emerald-950/80 hover:text-emerald-900 hover:bg-emerald-50/70"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </Button>
      </div>
    </aside>
  );
}
