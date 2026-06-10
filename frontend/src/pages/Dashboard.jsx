import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Grid, Card, CardContent, Typography, Box, Chip, CircularProgress, LinearProgress, Alert } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PeopleIcon from '@mui/icons-material/People';
import { projectsApi, deliverablesApi, resourcesApi, budgetApi } from '../services/api';

const STATUS_COLOR = { active: 'primary', at_risk: 'error', on_hold: 'warning', completed: 'success', cancelled: 'default' };

function StatCard({ title, value, icon, color, onClick }) {
  return (
    <Card sx={{ borderRadius: 3, boxShadow: 2, height: '100%', cursor: onClick ? 'pointer' : 'default', '&:hover': onClick ? { boxShadow: 6 } : {} }} onClick={onClick}>
      <CardContent sx={{ minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary">{title}</Typography>
            <Typography variant="h4" fontWeight={700} color={color} sx={{ fontSize: { xs: '1.75rem', sm: '2.125rem' } }}>{value}</Typography>
          </Box>
          <Box sx={{ color, fontSize: { xs: 36, sm: 48 }, flexShrink: 0 }}>{icon}</Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [resources, setResources] = useState([]);
  const [budgetSummary, setBudgetSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    Promise.allSettled([
      projectsApi.getAll(),
      deliverablesApi.getAll(),
      resourcesApi.getAll(),
      budgetApi.getSummary(),
    ]).then(([projectsRes, deliverablesRes, resourcesRes, budgetRes]) => {
      const errors = [];
      if (projectsRes.status === 'fulfilled') setProjects(projectsRes.value.projects || []);
      else errors.push(`Projects: ${projectsRes.reason?.message}`);
      if (deliverablesRes.status === 'fulfilled') setDeliverables(deliverablesRes.value.deliverables || []);
      else errors.push(`Deliverables: ${deliverablesRes.reason?.message}`);
      if (resourcesRes.status === 'fulfilled') setResources(resourcesRes.value.resources || []);
      else errors.push(`Resources: ${resourcesRes.reason?.message}`);
      if (budgetRes.status === 'fulfilled') setBudgetSummary(budgetRes.value.summary || []);
      else errors.push(`Budget: ${budgetRes.reason?.message}`);
      if (errors.length) setError(errors.join(' · '));
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  const atRisk = projects.filter(p => p.status === 'at_risk').length;
  const overAllocated = resources.filter(r => r.allocated_hours > r.capacity_hours_per_week).length;
  const completedDeliverables = deliverables.filter(d => d.status === 'completed').length;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>Dashboard</Typography>
      {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={3} mb={4}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard title="Total Projects" value={projects.length} icon={<FolderIcon fontSize="inherit" />} color="primary.main" onClick={() => navigate('/projects')} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard title="At Risk" value={atRisk} icon={<WarningIcon fontSize="inherit" />} color="error.main" onClick={() => navigate('/projects')} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard title="Deliverables Done" value={`${completedDeliverables}/${deliverables.length}`} icon={<CheckCircleIcon fontSize="inherit" />} color="success.main" onClick={() => navigate('/deliverables')} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard title="Over-allocated" value={overAllocated} icon={<PeopleIcon fontSize="inherit" />} color="warning.main" onClick={() => navigate('/resources')} />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} mb={2}>Active Projects</Typography>
              {projects.length === 0 && <Typography color="text.secondary">No projects yet. Create one!</Typography>}
              {projects.slice(0, 6).map(p => (
                <Box key={p.id} sx={{ mb: 2, p: 2, bgcolor: '#f8f9fa', borderRadius: 2, cursor: 'pointer', '&:hover': { bgcolor: '#e8eaf6' } }} onClick={() => navigate('/projects')}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                    <Typography fontWeight={600} sx={{ wordBreak: 'break-word', flex: '1 1 auto', minWidth: 0 }}>{p.name}</Typography>
                    <Chip label={p.status.replace('_', ' ')} color={STATUS_COLOR[p.status] || 'default'} size="small" sx={{ flexShrink: 0, height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.5 } }} />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">Budget: ${p.budget_total?.toLocaleString()}</Typography>
                    <Typography variant="caption" color="text.secondary">Spent: ${p.budget_spent?.toLocaleString()}</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={p.budget_total > 0 ? Math.min(100, (p.budget_spent / p.budget_total) * 100) : 0}
                    color={p.budget_spent > p.budget_total ? 'error' : 'primary'}
                    sx={{ mt: 1, borderRadius: 1 }}
                  />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} mb={2}>Budget Overview</Typography>
              {budgetSummary.length === 0 && <Typography color="text.secondary">No budget entries yet.</Typography>}
              {budgetSummary.slice(0, 5).map(b => (
                <Box key={b.project_id} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
                    <Typography variant="body2" fontWeight={500} sx={{ wordBreak: 'break-word', minWidth: 0 }}>{b.project_name || 'Unknown'}</Typography>
                    <Typography variant="body2" color={b.remaining < 0 ? 'error.main' : 'success.main'}>
                      ${b.remaining?.toLocaleString()} left
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={b.total_budget > 0 ? Math.min(100, (b.total_spent / b.total_budget) * 100) : 0}
                    color={b.remaining < 0 ? 'error' : 'primary'}
                    sx={{ borderRadius: 1 }}
                  />
                </Box>
              ))}
            </CardContent>
          </Card>

          <Card sx={{ borderRadius: 3, boxShadow: 2, mt: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} mb={2}>Team Allocation</Typography>
              {resources.length === 0 && <Typography color="text.secondary">No resources yet.</Typography>}
              {resources.slice(0, 5).map(r => (
                <Box key={r.id} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
                    <Typography variant="body2" fontWeight={500} sx={{ wordBreak: 'break-word', minWidth: 0 }}>{r.name}</Typography>
                    <Typography variant="body2" color={r.allocated_hours > r.capacity_hours_per_week ? 'error.main' : 'text.secondary'}>
                      {r.allocated_hours}/{r.capacity_hours_per_week}h
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, (r.allocated_hours / r.capacity_hours_per_week) * 100)}
                    color={r.allocated_hours > r.capacity_hours_per_week ? 'error' : 'success'}
                    sx={{ borderRadius: 1 }}
                  />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
