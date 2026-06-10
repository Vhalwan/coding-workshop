import { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Card, CardContent, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, IconButton, Alert,
  CircularProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Tooltip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { deliverablesApi, projectsApi } from '../services/api';
import { useAuth } from '../services/AuthContext';

const STATUSES = ['pending', 'in_progress', 'completed', 'blocked'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const STATUS_COLOR = { pending: 'default', in_progress: 'primary', completed: 'success', blocked: 'error' };
const EMPTY = { name: '', description: '', project_id: '', status: 'pending', priority: 'medium', assignee_name: '', due_date: '' };

export default function Deliverables() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const canWrite = ['admin', 'manager', 'contributor'].includes(user?.role);
  const canDelete = ['admin', 'manager'].includes(user?.role);

  const load = () => Promise.all([
    deliverablesApi.getAll({ ...(filterProject ? { project_id: filterProject } : {}), ...(filterStatus ? { status: filterStatus } : {}) }),
    projectsApi.getAll()
  ]).then(([d, p]) => { setItems(d.deliverables || []); setProjects(p.projects || []); })
    .catch(e => setError(e.message)).finally(() => setLoading(false));

  useEffect(() => { load(); }, [filterProject, filterStatus]);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (d) => { setEditing(d); setForm({ ...d, due_date: d.due_date || '', assignee_name: d.assignee_name || '' }); setOpen(true); };

  const save = async () => {
    if (!form.name.trim() || !form.project_id) return;
    setSaving(true);
    try {
      if (editing) await deliverablesApi.update(editing.id, form);
      else await deliverablesApi.create(form);
      setOpen(false); load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm('Delete this deliverable?')) return;
    try { await deliverablesApi.delete(id); load(); } catch (e) { setError(e.message); }
  };

  const projectName = (id) => projects.find(p => p.id === id)?.name || id;

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Deliverables</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField select size="small" label="Project" value={filterProject} onChange={e => setFilterProject(e.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="">All Projects</MenuItem>
            {projects.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Status" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} sx={{ minWidth: 130 }}>
            <MenuItem value="">All</MenuItem>
            {STATUSES.map(s => <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>)}
          </TextField>
          {canWrite && <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add Deliverable</Button>}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: 2 }}>
        <Table>
          <TableHead sx={{ bgcolor: '#f0f4f8' }}>
            <TableRow>
              <TableCell fontWeight={600}>Name</TableCell>
              <TableCell>Project</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell>Assignee</TableCell>
              <TableCell>Due Date</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.length === 0 && (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>No deliverables found. Create one!</TableCell></TableRow>
            )}
            {items.map(d => (
              <TableRow key={d.id} hover>
                <TableCell><Typography fontWeight={500}>{d.name}</Typography>{d.description && <Typography variant="caption" color="text.secondary">{d.description}</Typography>}</TableCell>
                <TableCell>{projectName(d.project_id)}</TableCell>
                <TableCell><Chip label={d.status.replace('_', ' ')} color={STATUS_COLOR[d.status]} size="small" /></TableCell>
                <TableCell><Chip label={d.priority} size="small" variant="outlined" /></TableCell>
                <TableCell>{d.assignee_name || '—'}</TableCell>
                <TableCell>{d.due_date || '—'}</TableCell>
                <TableCell align="right">
                  {canWrite && <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(d)}><EditIcon fontSize="small" /></IconButton></Tooltip>}
                  {canDelete && <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => remove(d.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Deliverable' : 'New Deliverable'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} fullWidth />
          <TextField select label="Project *" value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))} fullWidth>
            {projects.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
          </TextField>
          <TextField label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} fullWidth multiline rows={2} />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField select label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} fullWidth>
              {STATUSES.map(s => <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>)}
            </TextField>
            <TextField select label="Priority" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} fullWidth>
              {PRIORITIES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </Box>
          <TextField label="Assignee Name" value={form.assignee_name} onChange={e => setForm(f => ({ ...f, assignee_name: e.target.value }))} fullWidth />
          <TextField label="Due Date" type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} fullWidth InputLabelProps={{ shrink: true }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={saving || !form.name.trim() || !form.project_id}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
