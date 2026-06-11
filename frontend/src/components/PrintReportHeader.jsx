import { Box, Typography } from '@mui/material';

export default function PrintReportHeader({ title }) {
  const today = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Box className="print-only print-report-header">
      <Typography variant="h5" fontWeight={700}>ACME Project Hub</Typography>
      <Typography variant="body2" color="text.secondary">{today}</Typography>
      <Typography variant="h6" fontWeight={600} sx={{ mt: 2 }}>{title}</Typography>
    </Box>
  );
}
