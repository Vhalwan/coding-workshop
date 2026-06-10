import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, CardContent, TextField, Button, Typography, Alert, Tab, Tabs, MenuItem } from '@mui/material';
import { useAuth } from '../services/AuthContext';

export default function Login() {
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'viewer' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 0) {
        await login(form.email, form.password);
      } else {
        await register(form);
      }
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f0f4f8' }}>
      <Card sx={{ width: 420, borderRadius: 3, boxShadow: 6 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" fontWeight={700} mb={1} color="primary">ACME Project Hub</Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>Centralized project management platform</Typography>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
            <Tab label="Login" />
            <Tab label="Register" />
          </Tabs>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <form onSubmit={submit}>
            {tab === 1 && (
              <TextField fullWidth label="Full Name" value={form.full_name} onChange={set('full_name')} sx={{ mb: 2 }} required />
            )}
            <TextField fullWidth label="Email" type="email" value={form.email} onChange={set('email')} sx={{ mb: 2 }} required />
            <TextField fullWidth label="Password" type="password" value={form.password} onChange={set('password')} sx={{ mb: 2 }} required />
            {tab === 1 && (
              <TextField fullWidth select label="Role" value={form.role} onChange={set('role')} sx={{ mb: 2 }}>
                <MenuItem value="viewer">Viewer</MenuItem>
                <MenuItem value="contributor">Contributor</MenuItem>
                <MenuItem value="manager">Manager</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </TextField>
            )}
            <Button fullWidth variant="contained" type="submit" disabled={loading} size="large" sx={{ mt: 1 }}>
              {loading ? 'Please wait...' : tab === 0 ? 'Login' : 'Register'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
