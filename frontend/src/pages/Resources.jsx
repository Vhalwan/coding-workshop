import { useState, useEffect } from 'react';
import { useMediaQuery } from 'react-responsive';
import {
  Box, Typography, Button, Card, CardContent, Grid, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, IconButton, Alert, CircularProgress,
  LinearProgress, Chip, Tooltip, Divider, MenuItem, List, ListItem, ListItemText, InputAdornment
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ClearIcon from '@mui/icons-material/Clear';
import EventNoteIcon from '@mui/icons-material/EventNote';
import { resourcesApi, projectsApi } from '../services/api';
import { useAuth } from '../services/AuthContext';

const EMPTY = { name: '', email: '', role: '', department: '', capacity_hours_per_week: 40 };
const EMPTY_ALLOC = { project_id: '', hours_per_week: '', start_date: '', end_date: '' };

export default function Resources() {
  const { user } = useAuth();
  const [resources, setResources] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [allocOpen, setAllocOpen] = useState(false);
  const [allocResource, setAllocResource] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [allocLoading, setAllocLoading] = useState(false);
  const [allocForm, setAllocForm] = useState(EMPTY_ALLOC);
  const [allocSaving, setAllocSaving] = useState(false);

  const isDesktop = useMediaQuery({ minWidth: 1024 });
  const isTablet = useMediaQuery({ minWidth: 768, maxWidth: 1023 });
  const gridSize = isDesktop ? 4 : isTablet ? 6 : 12;

  const canWrite = ['admin', 'manager', 'contributor'].includes(user?.role);
  const canDelete = ['admin', 'manager'].includes(user?.role);

  const load = () => resourcesApi.getAll()
    .then(d => setResources(d.resources || []))
    .catch(e => setError(e.message)).finally(() => setLoading(false));

  useEffect(() => {
    load();
    projectsApi.getAll().then(d => setProjects(d.projects || [])).catch(() => {});
  }, []);

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

  const loadAllocations = (resourceId) =>
    resourcesApi.getAllocations({ resource_id: resourceId })
      .then(d => setAllocations(d.allocations || []))
      .catch(e => setError(e.message));

  const openAllocations = async (resource) => {
    setAllocResource(resource);
    setAllocForm(EMPTY_ALLOC);
    setAllocations([]);
    setAllocOpen(true);
    setAllocLoading(true);
    await loadAllocations(resource.id);
    setAllocLoading(false);
  };

  const addAllocation = async () => {
    const hours = Number(allocForm.hours_per_week);
    if (!allocForm.project_id || !hours || hours <= 0) return;
    setAllocSaving(true);
    try {
      const proj = projects.find(p => p.id === allocForm.project_id);
      await resourcesApi.createAllocation({
        resource_id: allocResource.id,
        project_id: allocForm.project_id,
        project_name: proj?.name || null,
        hours_per_week: hours,
        start_date: allocForm.start_date || null,
        end_date: allocForm.end_date || null,
      });
      setAllocForm(EMPTY_ALLOC);
      await loadAllocations(allocResource.id);
      load();
    } catch (e) { setError(e.message); }
    finally { setAllocSaving(false); }
  };

  const removeAllocation = async (id) => {
    try {
      await resourcesApi.deleteAllocation(id);
      await loadAllocations(allocResource.id);
      load();
    } catch (e) { setError(e.message); }
  };

  const query = search.trim().toLowerCase();
  const filteredResources = query
    ? resources.filter(r =>
        (r.name || '').toLowerCase().includes(query) ||
        (r.email || '').toLowerCase().includes(query) ||
        (r.role || '').toLowerCase().includes(query) ||
        (r.department || '').toLowerCase().includes(query)
      )
    : resources;

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  const allocatedInDialog = allocations.reduce((sum, a) => sum + (a.hours_per_week || 0), 0);
  const dialogCapacity = allocResource?.capacity_hours_per_week || 0;
  const dialogAvailable = dialogCapacity - allocatedInDialog;
  const dialogOverage = allocatedInDialog - dialogCapacity;
  const dialogIsOver = dialogOverage > 0;
  const newAllocHours = Number(allocForm.hours_per_week) || 0;
  const wouldOverallocate = newAllocHours > dialogAvailable;
  const projectedOverage = allocatedInDialog + newAllocHours - dialogCapacity;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexWrap: 'wrap', gap: 2, mb: 2 }}>
          <Typography variant="h5" fontWeight={700}>Resources</Typography>
          {canWrite && <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ flexShrink: 0 }}>Add Resource</Button>}
        </Box>
        <TextField
          size="small"
          placeholder="Search resources..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          fullWidth
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
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {filteredResources.length === 0 && (
        <Typography color="text.secondary">
          {query ? 'No resources match your search' : 'No resources yet. Add team members!'}
        </Typography>
      )}

      <Grid container spacing={3}>
        {filteredResources.map(r => {
          const pct = Math.min(100, (r.allocated_hours / r.capacity_hours_per_week) * 100);
          const over = r.allocated_hours > r.capacity_hours_per_week;
          const overage = r.allocated_hours - r.capacity_hours_per_week;
          return (
            <Grid size={gridSize} key={r.id}>
              <Card sx={{ borderRadius: 3, boxShadow: 2, height: '100%' }}>
                <CardContent sx={{ minWidth: 0 }}>
                  {over && (
                    <Alert severity="error" icon={false} sx={{ mb: 1.5, py: 0.5, fontWeight: 600, '& .MuiAlert-message': { py: 0.25 } }}>
                      ⚠ Over-allocated by {overage}h
                    </Alert>
                  )}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                    <Box sx={{ minWidth: 0, flex: '1 1 auto' }}>
                      <Typography fontWeight={700} sx={{ wordBreak: 'break-word' }}>{r.name}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>{r.email}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexShrink: 0, alignItems: 'center' }}>
                      <Tooltip title="Manage allocations"><IconButton size="small" onClick={() => openAllocations(r)} sx={{ p: 1 }}><EventNoteIcon fontSize="small" /></IconButton></Tooltip>
                      {canWrite && (
                        <>
                          <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(r)} sx={{ p: 1 }}><EditIcon fontSize="small" /></IconButton></Tooltip>
                          {canDelete && <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => remove(r.id)} sx={{ p: 1 }}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
                        </>
                      )}
                    </Box>
                  </Box>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                    {r.role && <Chip label={r.role} size="small" variant="outlined" sx={{ height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.5 } }} />}
                    {r.department && <Chip label={r.department} size="small" sx={{ height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.5 } }} />}
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
                    <Typography variant="caption">Allocation</Typography>
                    <Typography variant="caption" color={over ? 'error.main' : 'text.secondary'} sx={{ textAlign: 'right' }}>
                      {r.allocated_hours}/{r.capacity_hours_per_week}h/week
                    </Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={pct} color={over ? 'error' : 'success'} sx={{ borderRadius: 1, height: 8 }} />
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth sx={{ '& .MuiDialog-paper': { m: { xs: 1, sm: 2 }, width: { xs: 'calc(100% - 16px)', sm: 'auto' }, maxHeight: { xs: 'calc(100% - 16px)', sm: 'calc(100% - 64px)' } } }}>
        <DialogTitle>{editing ? 'Edit Resource' : 'Add Resource'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Full Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} fullWidth autoFocus />
          <TextField label="Email *" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} fullWidth />
          <TextField label="Role / Title" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} fullWidth />
          <TextField label="Department" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} fullWidth />
          <TextField label="Capacity (hours/week)" type="number" value={form.capacity_hours_per_week} onChange={e => setForm(f => ({ ...f, capacity_hours_per_week: Number(e.target.value) }))} fullWidth />
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={saving || !form.name.trim() || !form.email.trim()}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={allocOpen} onClose={() => setAllocOpen(false)} maxWidth="sm" fullWidth sx={{ '& .MuiDialog-paper': { m: { xs: 1, sm: 2 }, width: { xs: 'calc(100% - 16px)', sm: 'auto' }, maxHeight: { xs: 'calc(100% - 16px)', sm: 'calc(100% - 64px)' } } }}>
        <DialogTitle>
          Allocations — {allocResource?.name}
          <Typography variant="body2" color={dialogAvailable < 0 ? 'error.main' : 'text.secondary'}>
            {allocatedInDialog}/{dialogCapacity}h allocated · {dialogAvailable}h available
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {allocLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={28} /></Box>
          ) : (
            <>
              {dialogIsOver && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {allocResource?.name} is over-allocated by {dialogOverage}h/week ({allocatedInDialog}h allocated vs {dialogCapacity}h capacity).
                </Alert>
              )}
              {allocations.length === 0 && <Typography color="text.secondary" sx={{ mb: 2 }}>No allocations yet.</Typography>}
              <List dense>
                {allocations.map(a => (
                  <ListItem
                    key={a.id}
                    divider
                    secondaryAction={canDelete && (
                      <Tooltip title="Remove allocation">
                        <IconButton edge="end" size="small" color="error" onClick={() => removeAllocation(a.id)}><DeleteIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    )}
                  >
                    <ListItemText
                      primary={`${a.project_name || a.project_id} — ${a.hours_per_week}h/week`}
                      secondary={a.start_date || a.end_date ? `${a.start_date || '—'} → ${a.end_date || '—'}` : null}
                    />
                  </ListItem>
                ))}
              </List>

              {canWrite && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Add allocation</Typography>
                  {wouldOverallocate && newAllocHours > 0 && (
                    <Alert severity="warning" sx={{ mb: 1 }}>
                      Adding {newAllocHours}h/week will push {allocResource?.name} over capacity by {projectedOverage}h/week
                      {dialogIsOver ? ` (currently over by ${dialogOverage}h)` : ` (${dialogAvailable}h currently available)`}.
                      You can still add this allocation.
                    </Alert>
                  )}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                      select label="Project *" value={allocForm.project_id}
                      onChange={e => setAllocForm(f => ({ ...f, project_id: e.target.value }))} fullWidth
                      helperText={projects.length === 0 ? 'No projects available — create a project first.' : ''}
                    >
                      {projects.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                    </TextField>
                    <TextField
                      label="Hours / week *" type="number" value={allocForm.hours_per_week}
                      onChange={e => setAllocForm(f => ({ ...f, hours_per_week: e.target.value }))} fullWidth
                      error={wouldOverallocate && newAllocHours > 0}
                      helperText={
                        wouldOverallocate && newAllocHours > 0
                          ? `Exceeds available capacity — will be over-allocated by ${projectedOverage}h/week`
                          : ''
                      }
                    />
                    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
                      <TextField label="Start date" type="date" value={allocForm.start_date} onChange={e => setAllocForm(f => ({ ...f, start_date: e.target.value }))} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
                      <TextField label="End date" type="date" value={allocForm.end_date} onChange={e => setAllocForm(f => ({ ...f, end_date: e.target.value }))} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
                    </Box>
                  </Box>
                </>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, pb: 2 }}>
          <Button onClick={() => setAllocOpen(false)}>Close</Button>
          {canWrite && (
            <Button
              variant="contained" startIcon={<AddIcon />} onClick={addAllocation}
              disabled={allocSaving || !allocForm.project_id || !Number(allocForm.hours_per_week)}
            >
              {allocSaving ? 'Adding...' : 'Add Allocation'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
