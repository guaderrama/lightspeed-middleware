import * as XLSX from 'xlsx';

interface ExportOptions {
  filename: string;
  sheetName?: string;
}

export function exportToExcel(data: Record<string, any>[], options: ExportOptions) {
  if (!data || data.length === 0) return;

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, options.sheetName || 'Data');

  // Auto-size columns
  const colWidths = Object.keys(data[0]).map((key) => {
    const maxLen = Math.max(
      key.length,
      ...data.map((row) => String(row[key] ?? '').length)
    );
    return { wch: Math.min(maxLen + 2, 40) };
  });
  ws['!cols'] = colWidths;

  XLSX.writeFile(wb, `${options.filename}.xlsx`);
}

export function exportMultiSheet(
  sheets: { name: string; data: Record<string, any>[] }[],
  filename: string
) {
  const wb = XLSX.utils.book_new();

  for (const sheet of sheets) {
    if (!sheet.data || sheet.data.length === 0) continue;
    const ws = XLSX.utils.json_to_sheet(sheet.data);
    const colWidths = Object.keys(sheet.data[0]).map((key) => {
      const maxLen = Math.max(
        key.length,
        ...sheet.data.map((row) => String(row[key] ?? '').length)
      );
      return { wch: Math.min(maxLen + 2, 40) };
    });
    ws['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.substring(0, 31));
  }

  XLSX.writeFile(wb, `${filename}.xlsx`);
}
