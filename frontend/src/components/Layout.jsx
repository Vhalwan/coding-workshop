import { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  AppBar, Toolbar, Typography, IconButton, Chip, Tooltip, useMediaQuery, useTheme
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import FolderIcon from '@mui/icons-material/Folder';
import TaskIcon from '@mui/icons-material/Task';
import PeopleIcon from '@mui/icons-material/People';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import { useAuth } from '../services/AuthContext';

const DRAWER_WIDTH = 240;

const NAV = [
  { label: 'Dashboard', icon: <DashboardIcon />, path: '/' },
  { label: 'Projects', icon: <FolderIcon />, path: '/projects' },
  { label: 'Deliverables', icon: <TaskIcon />, path: '/deliverables' },
  { label: 'Resources', icon: <PeopleIcon />, path: '/resources' },
  { label: 'Budget', icon: <AttachMoneyIcon />, path: '/budget' },
];

const ROLE_COLORS = { admin: 'error', manager: 'warning', contributor: 'info', viewer: 'default' };

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavigate = (path) => {
    navigate(path);
    if (!isDesktop) setMobileOpen(false);
  };

  const drawerContent = (
    <List sx={{ pt: 2 }}>
      {NAV.map(({ label, icon, path }) => (
        <ListItem key={path} disablePadding>
          <ListItemButton
            selected={location.pathname === path}
            onClick={() => handleNavigate(path)}
            sx={{ borderRadius: 2, mx: 1, mb: 0.5, '&.Mui-selected': { bgcolor: '#e8eaf6', color: '#1a237e' } }}
          >
            <ListItemIcon sx={{ color: location.pathname === path ? '#1a237e' : 'inherit', minWidth: 40 }}>{icon}</ListItemIcon>
            <ListItemText primary={label} />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );

  const drawerPaperSx = {
    width: DRAWER_WIDTH,
    boxSizing: 'border-box',
    mt: '64px',
    bgcolor: '#f8f9fa',
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" sx={{ zIndex: theme => theme.zIndex.drawer + 1, bgcolor: '#1a237e' }}>
        <Toolbar sx={{ gap: 1, minHeight: { xs: 56, sm: 64 } }}>
          {!isDesktop && (
            <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(o => !o)} aria-label="Open navigation">
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1, fontSize: { xs: '1rem', sm: '1.25rem' }, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            ACME Project Hub
          </Typography>
          <Chip label={user?.role} color={ROLE_COLORS[user?.role] || 'default'} size="small" sx={{ color: 'white', borderColor: 'white', flexShrink: 0, display: { xs: 'none', sm: 'flex' } }} variant="outlined" />
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', display: { xs: 'none', md: 'block' }, flexShrink: 0 }}>{user?.full_name}</Typography>
          <Tooltip title="Logout">
            <IconButton color="inherit" onClick={() => { logout(); navigate('/login'); }} sx={{ flexShrink: 0 }}>
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': drawerPaperSx }}
        >
          {drawerContent}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': drawerPaperSx }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          p: { xs: 2, sm: 3 },
          mt: { xs: '56px', sm: '64px' },
          minHeight: { xs: 'calc(100vh - 56px)', sm: 'calc(100vh - 64px)' },
          bgcolor: '#f0f4f8',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
