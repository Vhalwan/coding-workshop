import { useState } from 'react';
import { Button, Menu, MenuItem } from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';

export default function ExportMenu({ onExportCsv, onExportPdf, csvDisabled, pdfDisabled }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleClose = () => setAnchorEl(null);

  return (
    <>
      <Button
        variant="outlined"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        endIcon={<ArrowDropDownIcon />}
        disabled={csvDisabled && pdfDisabled}
      >
        Export
      </Button>
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        <MenuItem
          onClick={() => { handleClose(); onExportCsv(); }}
          disabled={csvDisabled}
        >
          Export CSV
        </MenuItem>
        <MenuItem
          onClick={() => { handleClose(); onExportPdf(); }}
          disabled={pdfDisabled}
        >
          Export PDF
        </MenuItem>
      </Menu>
    </>
  );
}
