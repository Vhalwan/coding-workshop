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

  const canEdit = ['admin', 'manager'].includes(user?.role);

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
      await budgetApi.create({ ...form, amount: Number(form.amount) });
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Budget Tracking</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField select size="small" label="Project" value={filterProject} onChange={e => setFilterProject(e.target.value)} sx={{ minWidth: 180 }}>
            <MenuItem value="">All Projects</MenuItem>
            {projects.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
          </TextField>
          {canEdit && <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setForm(EMPTY); setOpen(true); }}>Add Entry</Button>}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {summary.length > 0 && (
        <Grid container spacing={3} mb={4}>
          {summary.map(s => (
            <Grid item xs={12} sm={6} md={4} key={s.project_id}>
              <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
                <CardContent>
                  <Typography fontWeight={600} mb={1}>{s.project_name || projectName(s.project_id)}</Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
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

      <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: 2 }}>
        <Table>
          <TableHead sx={{ bgcolor: '#f0f4f8' }}>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Project</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="right">Amount</TableCell>
              {canEdit && <TableCell align="right">Actions</TableCell>}
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
                {canEdit && (
                  <TableCell align="right">
                    <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => remove(e.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Budget Entry</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField select label="Project *" value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))} fullWidth>
            {projects.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
          </TextField>
          <Box sx={{ display: 'flex', gap: 2 }}>
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
          <TextField label="Date" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} fullWidth InputLabelProps={{ shrink: true }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={saving || !form.project_id || !form.category || !form.amount}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
