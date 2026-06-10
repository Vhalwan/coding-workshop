import { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Card, CardContent, Grid, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, IconButton, Alert,
  CircularProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Tooltip, LinearProgress
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { budgetApi, projectsApi } from '../services/api';
import { useAuth } from '../services/AuthContext';

const CATEGORIES = ['Personnel', 'Infrastructure', 'Software', 'Hardware', 'Training', 'Travel', 'Consulting', 'Other'];
const EMPTY = { project_id: '', category: '', description: '', amount: '', type: 'expense', date: new Date().toISOString().split('T')[0] };

export default function Budget() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const canWrite = ['admin', 'manager', 'contributor'].includes(user?.role);
  const canDelete = ['admin', 'manager'].includes(user?.role);

  const load = () => Promise.all([
    budgetApi.getAll(filterProject ? { project_id: filterProject } : {}),
    budgetApi.getSummary(filterProject ? { project_id: filterProject } : {}),
    projectsApi.getAll()
  ]).then(([e, s, p]) => { setEntries(e.entries || []); setSummary(s.summary || []); setProjects(p.projects || []); })
    .catch(e => setError(e.message)).finally(() => setLoading(false));

  useEffect(() => { load(); }, [filterProject]);

  const save = async () => {
    if (!form.project_id || !form.category || !form.amount) return;
    setSaving(true);
    try {
      const proj = projects.find(p => p.id === form.project_id);
      await budgetApi.create({
        project_id: form.project_id,
        project_name: proj?.name || null,
        category: form.category,
        description: form.description || null,
        amount: Number(form.amount),
        type: form.type,
        date: form.date || new Date().toISOString().split('T')[0],
      });
      setOpen(false); load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm('Delete this entry?')) return;
    try { await budgetApi.delete(id); load(); } catch (e) { setError(e.message); }
  };

  const projectName = (id) => projects.find(p => p.id === id)?.name || id;

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Budget Tracking</Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField select size="small" label="Project" value={filterProject} onChange={e => setFilterProject(e.target.value)} sx={{ minWidth: { xs: '100%', sm: 180 }, flex: { xs: '1 1 100%', sm: '0 1 auto' } }}>
            <MenuItem value="">All Projects</MenuItem>
            {projects.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
          </TextField>
          {canWrite && <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setForm(EMPTY); setOpen(true); }} sx={{ flexShrink: 0 }}>Add Entry</Button>}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {summary.length > 0 && (
        <Grid container spacing={3} mb={4}>
          {summary.map(s => (
            <Grid size={{ xs: 12, md: 6, xl: 4 }} key={s.project_id}>
              <Card sx={{ borderRadius: 3, boxShadow: 2, height: '100%' }}>
                <CardContent sx={{ minWidth: 0 }}>
                  <Typography fontWeight={600} mb={1} sx={{ wordBreak: 'break-word' }}>{s.project_name || projectName(s.project_id)}</Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
                    <Typography variant="body2">Budget: <b>${s.total_budget.toLocaleString()}</b></Typography>
                    <Typography variant="body2">Spent: <b>${s.total_spent.toLocaleString()}</b></Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={s.total_budget > 0 ? Math.min(100, (s.total_spent / s.total_budget) * 100) : 0} color={s.remaining < 0 ? 'error' : 'primary'} sx={{ borderRadius: 1, mb: 1 }} />
                  <Typography variant="body2" color={s.remaining < 0 ? 'error.main' : 'success.main'} fontWeight={600}>
                    {s.remaining < 0 ? `Over by $${Math.abs(s.remaining).toLocaleString()}` : `$${s.remaining.toLocaleString()} remaining`}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: 2, overflowX: 'auto' }}>
        <Table sx={{ minWidth: 700 }}>
          <TableHead sx={{ bgcolor: '#f0f4f8' }}>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Project</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="right">Amount</TableCell>
              {canDelete && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {entries.length === 0 && (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>No budget entries yet.</TableCell></TableRow>
            )}
            {entries.map(e => (
              <TableRow key={e.id} hover>
                <TableCell>{e.date}</TableCell>
                <TableCell>{e.project_name || projectName(e.project_id)}</TableCell>
                <TableCell>{e.category}</TableCell>
                <TableCell>{e.description || '—'}</TableCell>
                <TableCell><Chip label={e.type} color={e.type === 'budget' ? 'success' : 'default'} size="small" /></TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, color: e.type === 'expense' ? 'error.main' : 'success.main' }}>
                  {e.type === 'expense' ? '-' : '+'}${e.amount.toLocaleString()}
                </TableCell>
                {canDelete && (
                  <TableCell align="right">
                    <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => remove(e.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth sx={{ '& .MuiDialog-paper': { m: { xs: 1, sm: 2 }, width: { xs: 'calc(100% - 16px)', sm: 'auto' }, maxHeight: { xs: 'calc(100% - 16px)', sm: 'calc(100% - 64px)' } } }}>
        <DialogTitle>Add Budget Entry</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField select label="Project *" value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))} fullWidth autoFocus>
            {projects.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
          </TextField>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
            <TextField select label="Type" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} fullWidth>
              <MenuItem value="budget">Budget (allocation)</MenuItem>
              <MenuItem value="expense">Expense (spend)</MenuItem>
            </TextField>
            <TextField select label="Category *" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} fullWidth>
              {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
          </Box>
          <TextField label="Amount ($) *" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} fullWidth />
          <TextField label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} fullWidth />
          <TextField label="Date" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={saving || !form.project_id || !form.category || !form.amount}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
