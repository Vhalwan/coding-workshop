import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Grid, Card, CardContent, Typography, Box, Chip, CircularProgress, LinearProgress, Alert } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PeopleIcon from '@mui/icons-material/People';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { projectsApi, deliverablesApi, resourcesApi, budgetApi } from '../services/api';

const STATUS_COLOR = { active: 'primary', at_risk: 'error', on_hold: 'warning', completed: 'success', cancelled: 'default' };

function formatYAxisTick(value) {
  if (value === 0) return '$0k';
  if (value >= 1000) return `$${value / 1000}k`;
  return `$${value}`;
}

function BudgetChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const budget = payload.find(p => p.dataKey === 'budget')?.value ?? 0;
  const spent = payload.find(p => p.dataKey === 'spent')?.value ?? 0;
  return (
    <Box sx={{ bgcolor: 'background.paper', p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, boxShadow: 2 }}>
      <Typography variant="body2" fontWeight={600} mb={0.5}>{label}</Typography>
      <Typography variant="body2" sx={{ color: '#1976d2' }}>Budget: ${budget.toLocaleString()}</Typography>
      <Typography variant="body2" sx={{ color: '#d32f2f' }}>Spent: ${spent.toLocaleString()}</Typography>
    </Box>
  );
}

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
  const [budgetEntries, setBudgetEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    Promise.allSettled([
      projectsApi.getAll(),
      deliverablesApi.getAll(),
      resourcesApi.getAll(),
      budgetApi.getSummary(),
      budgetApi.getAll(),
    ]).then(([projectsRes, deliverablesRes, resourcesRes, budgetSummaryRes, budgetEntriesRes]) => {
      const errors = [];
      if (projectsRes.status === 'fulfilled') setProjects(projectsRes.value.projects || []);
      else errors.push(`Projects: ${projectsRes.reason?.message}`);
      if (deliverablesRes.status === 'fulfilled') setDeliverables(deliverablesRes.value.deliverables || []);
      else errors.push(`Deliverables: ${deliverablesRes.reason?.message}`);
      if (resourcesRes.status === 'fulfilled') setResources(resourcesRes.value.resources || []);
      else errors.push(`Resources: ${resourcesRes.reason?.message}`);
      if (budgetSummaryRes.status === 'fulfilled') setBudgetSummary(budgetSummaryRes.value.summary || []);
      else errors.push(`Budget summary: ${budgetSummaryRes.reason?.message}`);
      if (budgetEntriesRes.status === 'fulfilled') setBudgetEntries(budgetEntriesRes.value.entries || []);
      else errors.push(`Budget entries: ${budgetEntriesRes.reason?.message}`);
      if (errors.length) setError(errors.join(' · '));
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  const atRisk = projects.filter(p => p.status === 'at_risk').length;
  const overAllocated = resources.filter(r => r.allocated_hours > r.capacity_hours_per_week).length;
  const completedDeliverables = deliverables.filter(d => d.status === 'completed').length;
  const spentByProject = budgetEntries
    .filter(e => e.type === 'expense')
    .reduce((acc, e) => {
      acc[e.project_id] = (acc[e.project_id] || 0) + (e.amount || 0);
      return acc;
    }, {});
  const budgetChartData = projects.map(p => ({
    name: p.name,
    budget: p.budget_total || 0,
    spent: spentByProject[p.id] || 0,
  }));

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>Dashboard</Typography>
      {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ mb: 4 }}>
        <Grid container spacing={3}>
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
            <StatCard title="Over-allocated" value={overAllocated} icon={<PeopleIcon fontSize="inherit" />} color="error.main" onClick={() => navigate('/resources')} />
          </Grid>
        </Grid>
      </Box>

      <Box sx={{ pt: 2 }}>
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
              {resources.slice(0, 5).map(r => {
                const over = r.allocated_hours > r.capacity_hours_per_week;
                const overage = r.allocated_hours - r.capacity_hours_per_week;
                return (
                  <Box key={r.id} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={500} sx={{ wordBreak: 'break-word', minWidth: 0 }}>{r.name}</Typography>
                        {over && (
                          <Chip label={`⚠ +${overage}h`} size="small" color="error" sx={{ flexShrink: 0, height: 20, '& .MuiChip-label': { px: 1, fontSize: '0.7rem' } }} />
                        )}
                      </Box>
                      <Typography variant="body2" color={over ? 'error.main' : 'text.secondary'}>
                        {r.allocated_hours}/{r.capacity_hours_per_week}h
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(100, (r.allocated_hours / r.capacity_hours_per_week) * 100)}
                      color={over ? 'error' : 'success'}
                      sx={{ borderRadius: 1 }}
                    />
                  </Box>
                );
              })}
            </CardContent>
          </Card>
        </Grid>
        </Grid>
      </Box>

      <Box sx={{ pt: 2 }}>
        <Grid container spacing={3}>
          <Grid size={12}>
            <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} mb={2}>Budget vs Spent by Project</Typography>
                {budgetChartData.length === 0 ? (
                  <Typography color="text.secondary">No projects yet.</Typography>
                ) : (
                  <Box sx={{ width: '100%', height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={budgetChartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={budgetChartData.length > 4 ? -25 : 0} textAnchor={budgetChartData.length > 4 ? 'end' : 'middle'} height={budgetChartData.length > 4 ? 70 : 40} />
                        <YAxis tickFormatter={formatYAxisTick} width={56} />
                        <Tooltip content={<BudgetChartTooltip />} />
                        <Legend />
                        <Bar dataKey="budget" name="Budget" fill="#1976d2" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="spent" name="Spent" fill="#d32f2f" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
