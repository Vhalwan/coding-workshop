import { useState, useEffect } from 'react';
import { useMediaQuery } from 'react-responsive';
import {
  Box, Typography, Button, Card, CardContent, Grid, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, IconButton, Alert, CircularProgress, Tooltip, InputAdornment
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ClearIcon from '@mui/icons-material/Clear';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { projectsApi } from '../services/api';
import { useAuth } from '../services/AuthContext';
import { downloadCsv } from '../utils/exportCsv';
import PrintReportHeader from '../components/PrintReportHeader';
import ExportMenu from '../components/ExportMenu';

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
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const isDesktop = useMediaQuery({ minWidth: 1024 });
  const isTablet = useMediaQuery({ minWidth: 768, maxWidth: 1023 });
  const gridSize = isDesktop ? 4 : isTablet ? 6 : 12;

  const canWrite = ['admin', 'manager', 'contributor'].includes(user?.role);
  const canDelete = ['admin', 'manager'].includes(user?.role);

  const load = () => projectsApi.getAll(filter || undefined)
    .then(d => setProjects(d.projects || []))
    .catch(e => setError(e.message))
    .finally(() => setLoading(false));

  useEffect(() => { load(); }, [filter]);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setError(''); setOpen(true); };
  const openEdit = (p) => { setEditing(p); setForm({ ...p, status: p.stored_status ?? p.status, budget_total: p.budget_total || '', start_date: p.start_date || '', end_date: p.end_date || '' }); setError(''); setOpen(true); };
  const closeDialog = () => { setOpen(false); setError(''); };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const body = {
        ...form,
        budget_total: form.budget_total ? Number(form.budget_total) : 0,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      };
      if (editing) await projectsApi.update(editing.id, body);
      else await projectsApi.create(body);
      closeDialog();
      load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm('Delete this project?')) return;
    try { await projectsApi.delete(id); load(); }
    catch (e) { setError(e.message); }
  };

  const query = search.trim().toLowerCase();
  const filteredProjects = query
    ? projects.filter(p =>
        (p.name || '').toLowerCase().includes(query) ||
        (p.description || '').toLowerCase().includes(query)
      )
    : projects;

  const exportCsv = () => {
    downloadCsv(
      'projects',
      ['Name', 'Status', 'Priority', 'Budget', 'Spent', 'Start Date', 'End Date', 'Owner'],
      filteredProjects.map(p => [
        p.name,
        p.status.replace('_', ' '),
        p.priority,
        p.budget_total || 0,
        p.budget_spent || 0,
        p.start_date || '',
        p.end_date || '',
        p.owner_name || '',
      ])
    );
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box className="no-print" sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexWrap: 'wrap', gap: 2, mb: 2 }}>
          <Typography variant="h5" fontWeight={700}>Projects</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', flexShrink: 0 }}>
            <ExportMenu
              onExportCsv={exportCsv}
              onExportPdf={() => window.print()}
              csvDisabled={filteredProjects.length === 0}
              pdfDisabled={filteredProjects.length === 0}
            />
            {canWrite && <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>New Project</Button>}
          </Box>
        </Box>
        <TextField
          size="small"
          placeholder="Search projects..."
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
        <TextField select size="small" label="Filter by status" value={filter} onChange={e => setFilter(e.target.value)} sx={{ minWidth: { xs: '100%', sm: 160 } }}>
          <MenuItem value="">All</MenuItem>
          {STATUSES.map(s => <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>)}
        </TextField>
      </Box>

      {error && <Alert severity="error" className="no-print" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <PrintReportHeader title="Projects" />

      {filteredProjects.length === 0 && (
        <Typography color="text.secondary" className="no-print">
          {query ? 'No projects match your search' : 'No projects found. Create your first project!'}
        </Typography>
      )}

      <Box className="print-only">
        <table className="print-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Budget</th>
              <th>Spent</th>
              <th>Progress</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Owner</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map(p => {
              const pct = p.budget_total > 0 ? Math.min(100, ((p.budget_spent || 0) / p.budget_total) * 100) : 0;
              return (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td><span className="print-status">{p.status.replace('_', ' ')}</span></td>
                  <td><span className="print-status">{p.priority}</span></td>
                  <td>${(p.budget_total || 0).toLocaleString()}</td>
                  <td>${(p.budget_spent || 0).toLocaleString()}</td>
                  <td>
                    <div className="print-progress">
                      <div className="print-progress-bar" style={{ width: `${pct}%` }} />
                    </div>
                    <span style={{ fontSize: '10pt' }}>{pct.toFixed(0)}%</span>
                  </td>
                  <td>{p.start_date || '—'}</td>
                  <td>{p.end_date || '—'}</td>
                  <td>{p.owner_name || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Box>

      <Grid container spacing={3} className="screen-only-content">
        {filteredProjects.map(p => (
          <Grid size={gridSize} key={p.id}>
            <Card sx={{ borderRadius: 3, boxShadow: 2, height: '100%' }}>
              <CardContent sx={{ minWidth: 0 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                  <Typography fontWeight={700} variant="h6" sx={{ flex: '1 1 auto', minWidth: 0, wordBreak: 'break-word' }}>{p.name}</Typography>
                  {canWrite && (
                    <Box className="no-print" sx={{ display: 'flex', flexShrink: 0 }}>
                      <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(p)} sx={{ p: 1 }}><EditIcon fontSize="small" /></IconButton></Tooltip>
                      {canDelete && <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => remove(p.id)} sx={{ p: 1 }}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
                    </Box>
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                  <Tooltip title={p.auto_at_risk ? 'Automatically flagged — deadline within 14 days' : ''} disableHoverListener={!p.auto_at_risk}>
                    <Chip
                      label={p.status.replace('_', ' ')}
                      color={STATUS_COLOR[p.status]}
                      size="small"
                      icon={p.auto_at_risk ? <AccessTimeIcon sx={{ fontSize: '0.875rem !important' }} /> : undefined}
                      sx={{ height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.5 } }}
                    />
                  </Tooltip>
                  <Chip label={p.priority} color={PRIORITY_COLOR[p.priority]} size="small" variant="outlined" sx={{ height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.5 } }} />
                </Box>
                {p.description && <Typography variant="body2" color="text.secondary" mb={2} sx={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.description}</Typography>}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 0.5, mt: 'auto' }}>
                  <Typography variant="caption" color="text.secondary">Budget: ${(p.budget_total || 0).toLocaleString()}</Typography>
                  <Typography variant="caption" color="text.secondary">{p.owner_name || '—'}</Typography>
                </Box>
                {p.end_date && <Typography variant="caption" color="text.secondary" display="block">Due: {p.end_date}</Typography>}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={open} onClose={closeDialog} maxWidth="sm" fullWidth sx={{ '& .MuiDialog-paper': { m: { xs: 1, sm: 2 }, width: { xs: 'calc(100% - 16px)', sm: 'auto' }, maxHeight: { xs: 'calc(100% - 16px)', sm: 'calc(100% - 64px)' } } }}>
        <DialogTitle sx={{ pt: { xs: 3, sm: 2 } }}>{editing ? 'Edit Project' : 'New Project'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'visible', '.MuiDialogTitle-root + &': { pt: 2 } }}>
          <TextField label="Project Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} fullWidth autoFocus />
          <TextField label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} fullWidth multiline rows={3} />
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
            <TextField select label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} fullWidth>
              {STATUSES.map(s => <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>)}
            </TextField>
            <TextField select label="Priority" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} fullWidth>
              {PRIORITIES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
            <TextField label="Start Date" type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label="End Date" type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
          </Box>
          <TextField label="Total Budget ($)" type="number" value={form.budget_total} onChange={e => setForm(f => ({ ...f, budget_total: e.target.value }))} fullWidth />
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, pb: 2 }}>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={saving || !form.name.trim()}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
