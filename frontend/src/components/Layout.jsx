import { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  AppBar, Toolbar, Typography, IconButton, Avatar, Chip, Tooltip
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import FolderIcon from '@mui/icons-material/Folder';
import TaskIcon from '@mui/icons-material/Task';
import PeopleIcon from '@mui/icons-material/People';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import LogoutIcon from '@mui/icons-material/Logout';
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

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: 1201, bgcolor: '#1a237e' }}>
        <Toolbar>
          <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1 }}>
            ACME Project Hub
          </Typography>
          <Chip label={user?.role} color={ROLE_COLORS[user?.role] || 'default'} size="small" sx={{ mr: 2, color: 'white', borderColor: 'white' }} variant="outlined" />
          <Typography variant="body2" sx={{ mr: 2, color: 'rgba(255,255,255,0.8)' }}>{user?.full_name}</Typography>
          <Tooltip title="Logout">
            <IconButton color="inherit" onClick={() => { logout(); navigate('/login'); }}>
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Drawer variant="permanent" sx={{
        width: DRAWER_WIDTH,
        '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', mt: '64px', bgcolor: '#f8f9fa' }
      }}>
        <List sx={{ pt: 2 }}>
          {NAV.map(({ label, icon, path }) => (
            <ListItem key={path} disablePadding>
              <ListItemButton
                selected={location.pathname === path}
                onClick={() => navigate(path)}
                sx={{ borderRadius: 2, mx: 1, mb: 0.5, '&.Mui-selected': { bgcolor: '#e8eaf6', color: '#1a237e' } }}
              >
                <ListItemIcon sx={{ color: location.pathname === path ? '#1a237e' : 'inherit' }}>{icon}</ListItemIcon>
                <ListItemText primary={label} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3, mt: '64px', ml: `${DRAWER_WIDTH}px`, minHeight: 'calc(100vh - 64px)', bgcolor: '#f0f4f8' }}>
        <Outlet />
      </Box>
    </Box>
  );
}
