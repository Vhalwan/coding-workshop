import { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Card, CardContent, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, IconButton, Alert,
  CircularProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Tooltip, InputAdornment
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ClearIcon from '@mui/icons-material/Clear';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { deliverablesApi, projectsApi } from '../services/api';
import { useAuth } from '../services/AuthContext';
import { downloadCsv } from '../utils/exportCsv';
import PrintReportHeader from '../components/PrintReportHeader';
import ExportMenu from '../components/ExportMenu';

const STATUSES = ['pending', 'in_progress', 'completed', 'blocked'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const STATUS_COLOR = { pending: 'default', in_progress: 'primary', completed: 'success', blocked: 'error' };
const EMPTY = { name: '', description: '', project_id: '', status: 'pending', priority: 'medium', assignee_name: '', due_date: '', dependency_ids: [] };

export default function Deliverables() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const canWrite = ['admin', 'manager', 'contributor'].includes(user?.role);
  const canDelete = ['admin', 'manager'].includes(user?.role);

  const load = () => Promise.all([
    deliverablesApi.getAll({ ...(filterProject ? { project_id: filterProject } : {}), ...(filterStatus ? { status: filterStatus } : {}) }),
    deliverablesApi.getAll(),
    projectsApi.getAll()
  ]).then(([d, all, p]) => {
    setItems(d.deliverables || []);
    setAllItems(all.deliverables || []);
    setProjects(p.projects || []);
  }).catch(e => setError(e.message)).finally(() => setLoading(false));

  useEffect(() => { load(); }, [filterProject, filterStatus]);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (d) => {
    setEditing(d);
    setForm({
      ...d,
      due_date: d.due_date || '',
      assignee_name: d.assignee_name || '',
      dependency_ids: (d.dependencies || []).map(dep => dep.id),
    });
    setOpen(true);
  };

  const projectDeliverables = (projectId, excludeId) =>
    allItems.filter(d => d.project_id === projectId && d.id !== excludeId);

  const hasIncompleteDeps = (d) =>
    (d.dependencies || []).some(dep => {
      const depItem = allItems.find(i => i.id === dep.id);
      return depItem && depItem.status !== 'completed';
    });

  const syncDependencies = async (deliverableId, oldDeps, newIds) => {
    const oldIds = new Set((oldDeps || []).map(dep => dep.id));
    const newIdSet = new Set(newIds);
    for (const id of newIds) {
      if (!oldIds.has(id)) await deliverablesApi.addDependency(deliverableId, id);
    }
    for (const id of oldIds) {
      if (!newIdSet.has(id)) await deliverablesApi.removeDependency(deliverableId, id);
    }
  };

  const save = async () => {
    if (!form.name.trim() || !form.project_id) return;
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        project_id: form.project_id,
        description: form.description || null,
        status: form.status,
        priority: form.priority,
        assignee_name: form.assignee_name || null,
        due_date: form.due_date || null,
      };
      if (editing) {
        await deliverablesApi.update(editing.id, body);
        await syncDependencies(editing.id, editing.dependencies, form.dependency_ids);
      } else {
        const result = await deliverablesApi.create(body);
        const id = result.deliverable?.id;
        if (id && form.dependency_ids.length) {
          await syncDependencies(id, [], form.dependency_ids);
        }
      }
      setOpen(false); load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm('Delete this deliverable?')) return;
    try { await deliverablesApi.delete(id); load(); } catch (e) { setError(e.message); }
  };

  const projectName = (id) => projects.find(p => p.id === id)?.name || id;

  const query = search.trim().toLowerCase();
  const filteredItems = query
    ? items.filter(d =>
        (d.name || '').toLowerCase().includes(query) ||
        (d.assignee_name || '').toLowerCase().includes(query)
      )
    : items;

  const exportCsv = () => {
    downloadCsv(
      'deliverables',
      ['Name', 'Project', 'Status', 'Priority', 'Assignee', 'Due Date', 'Dependencies'],
      filteredItems.map(d => [
        d.name,
        projectName(d.project_id),
        d.status.replace('_', ' '),
        d.priority,
        d.assignee_name || '',
        d.due_date || '',
        (d.dependencies || []).map(dep => dep.name).join('; '),
      ])
    );
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box className="no-print" sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexWrap: 'wrap', gap: 2, mb: 2 }}>
          <Typography variant="h5" fontWeight={700}>Deliverables</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', flexShrink: 0 }}>
            <ExportMenu
              onExportCsv={exportCsv}
              onExportPdf={() => window.print()}
              csvDisabled={filteredItems.length === 0}
              pdfDisabled={filteredItems.length === 0}
            />
            {canWrite && <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add Deliverable</Button>}
          </Box>
        </Box>
        <TextField
          size="small"
          placeholder="Search deliverables..."
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
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField select size="small" label="Project" value={filterProject} onChange={e => setFilterProject(e.target.value)} sx={{ minWidth: { xs: '100%', sm: 160 }, flex: { xs: '1 1 100%', sm: '0 1 auto' } }}>
            <MenuItem value="">All Projects</MenuItem>
            {projects.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Status" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} sx={{ minWidth: { xs: '100%', sm: 130 }, flex: { xs: '1 1 100%', sm: '0 1 auto' } }}>
            <MenuItem value="">All</MenuItem>
            {STATUSES.map(s => <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>)}
          </TextField>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <PrintReportHeader title="Deliverables" />

      <Box className="print-only">
        <table className="print-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Project</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Assignee</th>
              <th>Due Date</th>
              <th>Dependencies</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map(d => (
              <tr key={d.id}>
                <td>{d.name}</td>
                <td>{projectName(d.project_id)}</td>
                <td><span className="print-status">{d.status.replace('_', ' ')}</span></td>
                <td><span className="print-status">{d.priority}</span></td>
                <td>{d.assignee_name || '—'}</td>
                <td>{d.due_date || '—'}</td>
                <td>{(d.dependencies || []).map(dep => dep.name).join('; ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>

      <TableContainer component={Paper} className="screen-only-content" sx={{ borderRadius: 3, boxShadow: 2, overflowX: 'auto' }}>
        <Table sx={{ minWidth: 720 }}>
          <TableHead sx={{ bgcolor: '#f0f4f8' }}>
            <TableRow>
              <TableCell fontWeight={600}>Name</TableCell>
              <TableCell>Project</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Dependencies</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell>Assignee</TableCell>
              <TableCell>Due Date</TableCell>
              <TableCell align="right" className="no-print">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  {query ? 'No deliverables match your search' : 'No deliverables found. Create one!'}
                </TableCell>
              </TableRow>
            )}
            {filteredItems.map(d => (
              <TableRow key={d.id} hover>
                <TableCell><Typography fontWeight={500}>{d.name}</Typography>{d.description && <Typography variant="caption" color="text.secondary">{d.description}</Typography>}</TableCell>
                <TableCell>{projectName(d.project_id)}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Chip label={d.status.replace('_', ' ')} color={STATUS_COLOR[d.status]} size="small" />
                    {hasIncompleteDeps(d) && (
                      <Tooltip title="Has incomplete dependencies">
                        <WarningAmberIcon color="warning" sx={{ fontSize: 18 }} />
                      </Tooltip>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  {(d.dependencies || []).length > 0
                    ? (d.dependencies || []).map(dep => <Chip key={dep.id} label={dep.name} size="small" variant="outlined" sx={{ mr: 0.5, mb: 0.5 }} />)
                    : '—'}
                </TableCell>
                <TableCell><Chip label={d.priority} size="small" variant="outlined" /></TableCell>
                <TableCell>{d.assignee_name || '—'}</TableCell>
                <TableCell>{d.due_date || '—'}</TableCell>
                <TableCell align="right" className="no-print">
                  {canWrite && <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(d)}><EditIcon fontSize="small" /></IconButton></Tooltip>}
                  {canDelete && <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => remove(d.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth sx={{ '& .MuiDialog-paper': { m: { xs: 1, sm: 2 }, width: { xs: 'calc(100% - 16px)', sm: 'auto' }, maxHeight: { xs: 'calc(100% - 16px)', sm: 'calc(100% - 64px)' } } }}>
        <DialogTitle>{editing ? 'Edit Deliverable' : 'New Deliverable'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'visible', '.MuiDialogTitle-root + &': { pt: 2 } }}>
          <TextField label="Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} fullWidth autoFocus />
          <TextField select label="Project *" value={form.project_id} onChange={e => {
            const project_id = e.target.value;
            setForm(f => ({
              ...f,
              project_id,
              dependency_ids: f.dependency_ids.filter(id => projectDeliverables(project_id, editing?.id).some(d => d.id === id)),
            }));
          }} fullWidth>
            {projects.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
          </TextField>
          {form.project_id && (
            <TextField
              select
              label="Depends on"
              value={form.dependency_ids}
              onChange={e => setForm(f => ({ ...f, dependency_ids: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value }))}
              fullWidth
              SelectProps={{ multiple: true, renderValue: (selected) => selected.map(id => projectDeliverables(form.project_id, editing?.id).find(d => d.id === id)?.name || id).join(', ') }}
              disabled={!canWrite}
            >
              {projectDeliverables(form.project_id, editing?.id).map(d => (
                <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>
              ))}
            </TextField>
          )}
          <TextField label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} fullWidth multiline rows={2} />
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
            <TextField select label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} fullWidth>
              {STATUSES.map(s => <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>)}
            </TextField>
            <TextField select label="Priority" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} fullWidth>
              {PRIORITIES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </Box>
          <TextField label="Assignee Name" value={form.assignee_name} onChange={e => setForm(f => ({ ...f, assignee_name: e.target.value }))} fullWidth />
          <TextField label="Due Date" type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={saving || !form.name.trim() || !form.project_id}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
