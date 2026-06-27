import { Link, usePathname } from "@/lib/navigation";
import {
  LayoutDashboard,
  ShieldAlert,
  Satellite,
  BarChart3,
  History,
  Settings,
  KanbanSquare,
  PlusCircle,
  Gavel,
  Database,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { BrandWordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";

const PRIMARY = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/incidents", label: "Incidents", icon: ShieldAlert },
  { to: "/board", label: "Incident Board", icon: KanbanSquare },
  { to: "/assets", label: "Space Assets", icon: Satellite },
];

const KNOWLEDGE = [
  { to: "/evidence", label: "Evidence Vault", icon: Database },
  { to: "/decisions", label: "Decision Log", icon: Gavel },
];

const INSIGHTS = [
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/activity", label: "Activity & Audit", icon: History },
];

const SETTINGS = [{ to: "/settings", label: "Settings", icon: Settings }];

export function AppSidebar() {
  const pathname = usePathname();
  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-3 py-3">
        <Link to="/dashboard">
          <BrandWordmark size="sm" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <div className="px-3 pt-3">
          <Button asChild size="sm" className="w-full justify-start">
            <Link to="/incidents/new">
              <PlusCircle className="size-4" /> New incident
            </Link>
          </Button>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {PRIMARY.map((i) => (
                <SidebarMenuItem key={i.to}>
                  <SidebarMenuButton asChild isActive={isActive(i.to)}>
                    <Link to={i.to}>
                      <i.icon />
                      <span>{i.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Insights</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {INSIGHTS.map((i) => (
                <SidebarMenuItem key={i.to}>
                  <SidebarMenuButton asChild isActive={isActive(i.to)}>
                    <Link to={i.to}>
                      <i.icon />
                      <span>{i.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarMenu>
          {SETTINGS.map((i) => (
            <SidebarMenuItem key={i.to}>
              <SidebarMenuButton asChild isActive={isActive(i.to)}>
                <Link to={i.to}>
                  <i.icon />
                  <span>{i.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
