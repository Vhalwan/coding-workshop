import { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Card, CardContent, Grid, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, IconButton, Alert, CircularProgress,
  LinearProgress, Chip, Tooltip, Divider
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { resourcesApi } from '../services/api';
import { useAuth } from '../services/AuthContext';

const EMPTY = { name: '', email: '', role: '', department: '', capacity_hours_per_week: 40 };

export default function Resources() {
  const { user } = useAuth();
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const canEdit = ['admin', 'manager'].includes(user?.role);

  const load = () => resourcesApi.getAll()
    .then(d => setResources(d.resources || []))
    .catch(e => setError(e.message)).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (r) => { setEditing(r); setForm({ ...r }); setOpen(true); };

  const save = async () => {
    if (!form.name.trim() || !form.email.trim()) return;
    setSaving(true);
    try {
      if (editing) await resourcesApi.update(editing.id, form);
      else await resourcesApi.create(form);
      setOpen(false); load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm('Delete this resource?')) return;
    try { await resourcesApi.delete(id); load(); } catch (e) { setError(e.message); }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Resources</Typography>
        {canEdit && <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add Resource</Button>}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {resources.length === 0 && <Typography color="text.secondary">No resources yet. Add team members!</Typography>}

      <Grid container spacing={3}>
        {resources.map(r => {
          const pct = Math.min(100, (r.allocated_hours / r.capacity_hours_per_week) * 100);
          const over = r.allocated_hours > r.capacity_hours_per_week;
          return (
            <Grid item xs={12} sm={6} md={4} key={r.id}>
              <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Box>
                      <Typography fontWeight={700}>{r.name}</Typography>
                      <Typography variant="body2" color="text.secondary">{r.email}</Typography>
                    </Box>
                    {canEdit && (
                      <Box>
                        <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(r)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => remove(r.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                      </Box>
                    )}
                  </Box>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                    {r.role && <Chip label={r.role} size="small" variant="outlined" />}
                    {r.department && <Chip label={r.department} size="small" />}
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption">Allocation</Typography>
                    <Typography variant="caption" color={over ? 'error.main' : 'text.secondary'}>
                      {r.allocated_hours}/{r.capacity_hours_per_week}h/week {over && '⚠ Over'}
                    </Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={pct} color={over ? 'error' : 'success'} sx={{ borderRadius: 1 }} />
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Resource' : 'Add Resource'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Full Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} fullWidth />
          <TextField label="Email *" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} fullWidth />
          <TextField label="Role / Title" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} fullWidth />
          <TextField label="Department" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} fullWidth />
          <TextField label="Capacity (hours/week)" type="number" value={form.capacity_hours_per_week} onChange={e => setForm(f => ({ ...f, capacity_hours_per_week: Number(e.target.value) }))} fullWidth />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={saving || !form.name.trim() || !form.email.trim()}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
