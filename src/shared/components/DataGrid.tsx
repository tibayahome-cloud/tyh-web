import type { GridColDef } from "@mui/x-data-grid";
import { DataGrid as MuiDataGrid } from "@mui/x-data-grid";

interface DataGridProps {
  rows: unknown[];
  columns: GridColDef[];
  loading?: boolean;
  autoHeight?: boolean;
}

export const DataGrid = ({ rows, columns, loading, autoHeight = true }: DataGridProps) => {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200">
      <MuiDataGrid
        rows={rows}
        columns={columns}
        loading={loading}
        autoHeight={autoHeight}
        disableRowSelectionOnClick
        density="comfortable"
        style={{ width: "100%" }}
        className="min-w-full"
        sx={{
          border: "none",
          "& .MuiDataGrid-columnHeaders": {
            backgroundColor: "#f8fafc"
          },
          "& .MuiDataGrid-withBorderColor": {
            borderColor: "#e2e8f0"
          }
        }}
      />
    </div>
  );
};
