import { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Card, CardContent, Grid, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, IconButton, Alert,
  CircularProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Tooltip, LinearProgress, InputAdornment
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ClearIcon from '@mui/icons-material/Clear';
import { budgetApi, projectsApi } from '../services/api';
import { useAuth } from '../services/AuthContext';
import { downloadCsv } from '../utils/exportCsv';
import PrintReportHeader from '../components/PrintReportHeader';
import ExportMenu from '../components/ExportMenu';

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
  const [search, setSearch] = useState('');
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

  const query = search.trim().toLowerCase();
  const filteredEntries = query
    ? entries.filter(e =>
        (e.category || '').toLowerCase().includes(query) ||
        (e.description || '').toLowerCase().includes(query)
      )
    : entries;

  const exportCsv = () => {
    downloadCsv(
      'budget',
      ['Date', 'Project', 'Category', 'Type', 'Amount', 'Description'],
      filteredEntries.map(e => [
        e.date,
        e.project_name || projectName(e.project_id),
        e.category,
        e.type,
        e.amount,
        e.description || '',
      ])
    );
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box className="no-print" sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexWrap: 'wrap', gap: 2, mb: 2 }}>
          <Typography variant="h5" fontWeight={700}>Budget Tracking</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', flexShrink: 0 }}>
            <ExportMenu
              onExportCsv={exportCsv}
              onExportPdf={() => window.print()}
              csvDisabled={filteredEntries.length === 0}
              pdfDisabled={filteredEntries.length === 0 && summary.length === 0}
            />
            {canWrite && <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setForm(EMPTY); setOpen(true); }}>Add Entry</Button>}
          </Box>
        </Box>
        <TextField
          size="small"
          placeholder="Search budget entries..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          fullWidth
          sx={{ mb: 2 }}
          slotProps={{
            input: {
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearch('')} aria-label="Clear search" edge="end">
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            },
          }}
        />
        <TextField select size="small" label="Project" value={filterProject} onChange={e => setFilterProject(e.target.value)} sx={{ minWidth: { xs: '100%', sm: 180 } }}>
          <MenuItem value="">All Projects</MenuItem>
          {projects.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
        </TextField>
      </Box>

      {error && <Alert severity="error" className="no-print" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <PrintReportHeader title="Budget Tracking" />

      {summary.length > 0 && (
        <Grid container spacing={3} mb={4} className="print-summary-section">
          {summary.map(s => {
            const projectBudget = projects.find(p => p.id === s.project_id)?.budget_total || 0;
            const expenses = s.total_spent;
            const allocations = s.total_budget;
            const remaining = projectBudget - expenses;
            const expensesOverBudget = expenses > projectBudget;
            const combinedOverBudget = expenses + allocations > projectBudget;
            const progressColor = expensesOverBudget ? 'error' : combinedOverBudget ? 'warning' : 'primary';
            return (
              <Grid size={{ xs: 12, md: 6, xl: 4 }} key={s.project_id}>
                <Card sx={{ borderRadius: 3, boxShadow: 2, height: '100%' }}>
                  <CardContent sx={{ minWidth: 0 }}>
                    <Typography fontWeight={600} mb={1} sx={{ wordBreak: 'break-word' }}>{s.project_name || projectName(s.project_id)}</Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
                      <Typography variant="body2">Budget: <b>${projectBudget.toLocaleString()}</b></Typography>
                      <Typography variant="body2">Spent: <b>${expenses.toLocaleString()}</b></Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={projectBudget > 0 ? Math.min(100, (expenses / projectBudget) * 100) : 0} color={progressColor} sx={{ borderRadius: 1, mb: 1 }} />
                    {expensesOverBudget ? (
                      <Typography variant="body2" color="error.main" fontWeight={600}>
                        Over by ${Math.abs(remaining).toLocaleString()}
                      </Typography>
                    ) : combinedOverBudget ? (
                      <Typography variant="body2" color="warning.main" fontWeight={600}>
                        Allocations and expenses exceed budget by ${(expenses + allocations - projectBudget).toLocaleString()}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="success.main" fontWeight={600}>
                        ${remaining.toLocaleString()} remaining
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <TableContainer component={Paper} className="print-data-table" sx={{ borderRadius: 3, boxShadow: 2, overflowX: 'auto' }}>
        <Table sx={{ minWidth: 700 }}>
          <TableHead sx={{ bgcolor: '#f0f4f8' }}>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Project</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="right">Amount</TableCell>
              {canDelete && <TableCell align="right" className="no-print">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredEntries.length === 0 && (
              <TableRow>
                <TableCell colSpan={canDelete ? 7 : 6} align="center" sx={{ py: 4, color: 'text.secondary' }} className="no-print">
                  {query ? 'No budget entries match your search' : 'No budget entries yet.'}
                </TableCell>
              </TableRow>
            )}
            {filteredEntries.map(e => (
              <TableRow key={e.id} hover>
                <TableCell>{e.date}</TableCell>
                <TableCell>{e.project_name || projectName(e.project_id)}</TableCell>
                <TableCell>{e.category}</TableCell>
                <TableCell>{e.description || '—'}</TableCell>
                <TableCell><Chip label={e.type} color={e.type === 'budget' ? 'success' : 'default'} size="small" /></TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, color: e.type === 'expense' ? 'error.main' : 'success.main' }}>
                  {e.type === 'expense' ? '-' : ''}${e.amount.toLocaleString()}
                </TableCell>
                {canDelete && (
                  <TableCell align="right" className="no-print">
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
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'visible', '.MuiDialogTitle-root + &': { pt: 2 } }}>
          <TextField select label="Project *" value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))} fullWidth autoFocus>
            {projects.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
          </TextField>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
            <TextField select label="Type" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} fullWidth>
              <MenuItem value="budget">Budget Allocation</MenuItem>
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
