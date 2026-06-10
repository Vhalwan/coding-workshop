import { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Card, CardContent, Grid, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, IconButton, Alert, CircularProgress, Tooltip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { projectsApi } from '../services/api';
import { useAuth } from '../services/AuthContext';

const STATUSES = ['active', 'at_risk', 'on_hold', 'completed', 'cancelled'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const STATUS_COLOR = { active: 'primary', at_risk: 'error', on_hold: 'warning', completed: 'success', cancelled: 'default' };
const PRIORITY_COLOR = { low: 'default', medium: 'info', high: 'warning', critical: 'error' };

const EMPTY = { name: '', description: '', status: 'active', priority: 'medium', start_date: '', end_date: '', budget_total: '' };

export default function Projects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const canWrite = ['admin', 'manager', 'contributor'].includes(user?.role);
  const canDelete = ['admin', 'manager'].includes(user?.role);

  const load = () => projectsApi.getAll(filter || undefined)
    .then(d => setProjects(d.projects || []))
    .catch(e => setError(e.message))
    .finally(() => setLoading(false));

  useEffect(() => { load(); }, [filter]);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (p) => { setEditing(p); setForm({ ...p, budget_total: p.budget_total || '', start_date: p.start_date || '', end_date: p.end_date || '' }); setOpen(true); };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const body = { ...form, budget_total: form.budget_total ? Number(form.budget_total) : 0 };
      if (editing) await projectsApi.update(editing.id, body);
      else await projectsApi.create(body);
      setOpen(false);
      load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm('Delete this project?')) return;
    try { await projectsApi.delete(id); load(); }
    catch (e) { setError(e.message); }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Projects</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField select size="small" label="Filter by status" value={filter} onChange={e => setFilter(e.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="">All</MenuItem>
            {STATUSES.map(s => <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>)}
          </TextField>
          {canWrite && <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>New Project</Button>}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {projects.length === 0 && <Typography color="text.secondary">No projects found. Create your first project!</Typography>}

      <Grid container spacing={3}>
        {projects.map(p => (
          <Grid item xs={12} md={6} lg={4} key={p.id}>
            <Card sx={{ borderRadius: 3, boxShadow: 2, height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography fontWeight={700} variant="h6" noWrap sx={{ flex: 1 }}>{p.name}</Typography>
                  {canWrite && (
                    <Box>
                      <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(p)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                      {canDelete && <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => remove(p.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
                    </Box>
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                  <Chip label={p.status.replace('_', ' ')} color={STATUS_COLOR[p.status]} size="small" />
                  <Chip label={p.priority} color={PRIORITY_COLOR[p.priority]} size="small" variant="outlined" />
                </Box>
                {p.description && <Typography variant="body2" color="text.secondary" mb={2} sx={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.description}</Typography>}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 'auto' }}>
                  <Typography variant="caption" color="text.secondary">Budget: ${(p.budget_total || 0).toLocaleString()}</Typography>
                  <Typography variant="caption" color="text.secondary">{p.owner_name || '—'}</Typography>
                </Box>
                {p.end_date && <Typography variant="caption" color="text.secondary" display="block">Due: {p.end_date}</Typography>}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Project' : 'New Project'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Project Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} fullWidth />
          <TextField label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} fullWidth multiline rows={3} />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField select label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} fullWidth>
              {STATUSES.map(s => <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>)}
            </TextField>
            <TextField select label="Priority" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} fullWidth>
              {PRIORITIES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="Start Date" type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} fullWidth InputLabelProps={{ shrink: true }} />
            <TextField label="End Date" type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} fullWidth InputLabelProps={{ shrink: true }} />
          </Box>
          <TextField label="Total Budget ($)" type="number" value={form.budget_total} onChange={e => setForm(f => ({ ...f, budget_total: e.target.value }))} fullWidth />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={saving || !form.name.trim()}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
