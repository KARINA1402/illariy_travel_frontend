import { Component, Input, OnInit } from '@angular/core';
import * as XLSX from 'xlsx-js-style';
import * as FileSaver from 'file-saver';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const EXCEL_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8';
const EXCEL_EXTENSION = '.xlsx';

@Component({
  selector: 'app-export-exlsx-cvs-pdf',
  templateUrl: './export-exlsx-cvs-pdf.component.html',
  styleUrls: ['./export-exlsx-cvs-pdf.component.css']
})
export class ExportExlsxCvsPdfComponent implements OnInit {

  @Input() columns: any[] = [];     // Puede ser array de strings o de objetos {header, datakey}
  @Input() jsonData: any[] = [];
  @Input() fileName: string = 'data';
  @Input() onBeforeExport?: (dispararDescarga: () => void) => void;

  constructor() {}

  ngOnInit(): void {}

  // ─── Excel ────────────────────────────────────────────────────────────────

  exportJsonToExcel(): void {
    if (this.onBeforeExport) {
      this.onBeforeExport(() => this.generarExcel());
    } else {
      this.generarExcel();
    }
  }

  private generarExcel(): void {
    // Depuración: ver qué datos llegan
    console.log('Export - columns:', this.columns);
    console.log('Export - jsonData (primer registro):', this.jsonData[0]);

    // Normalizar columns: si es array de strings, convertirlo a {header: string, datakey: string}
    let columnDefs: { header: string; datakey: string }[];
    if (this.columns.length > 0 && typeof this.columns[0] === 'string') {
      columnDefs = this.columns.map(col => ({ header: col, datakey: col }));
    } else {
      columnDefs = this.columns as any[];
    }

    const headers = columnDefs.map(c => c.header);
    const wsData: any[][] = [headers];

    // Construir filas usando datakey
    this.jsonData.forEach(row => {
      const rowValues = columnDefs.map(col => {
        let value = row[col.datakey];
        if (value === undefined || value === null) value = '';
        return value;
      });
      wsData.push(rowValues);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Estilos
    const headerStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10, name: 'Arial' },
      fill: { fgColor: { rgb: '1A1A1A' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
    };
    const evenRowStyle = {
      font: { sz: 9, name: 'Arial' },
      fill: { fgColor: { rgb: 'F2F4F6' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
    };
    const oddRowStyle = {
      font: { sz: 9, name: 'Arial' },
      fill: { fgColor: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
    };

    const range = XLSX.utils.decode_range(ws['!ref']!);
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[addr]) ws[addr] = { v: '', t: 's' };
        ws[addr].s = R === 0 ? headerStyle : (R % 2 === 0 ? evenRowStyle : oddRowStyle);
      }
    }

    // Ancho de columnas
    ws['!cols'] = columnDefs.map((col, idx) => {
      let maxLen = col.header.length;
      this.jsonData.forEach(row => {
        const val = String(row[col.datakey] ?? '');
        if (val.length > maxLen) maxLen = val.length;
      });
      return { wch: Math.min(maxLen + 3, 45) };
    });

    ws['!rows'] = [{ hpt: 22 }];

    const workbook = { Sheets: { data: ws }, SheetNames: ['data'] };
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    this.saveAsExcelFile(excelBuffer, this.fileName);
  }

  saveAsExcelFile(buffer: any, fileName: string): void {
    const data = new Blob([buffer], { type: EXCEL_TYPE });
    FileSaver.saveAs(data, `${fileName}_export_${new Date().getTime()}${EXCEL_EXTENSION}`);
  }

  // ─── PDF ──────────────────────────────────────────────────────────────────

  exportJsonToPdf(): void {
    if (this.onBeforeExport) {
      this.onBeforeExport(() => this.generarPdf());
    } else {
      this.generarPdf();
    }
  }

  private generarPdf(): void {
    // Normalizar columns igual que en Excel
    let columnDefs: { header: string; datakey: string }[];
    if (this.columns.length > 0 && typeof this.columns[0] === 'string') {
      columnDefs = this.columns.map(col => ({ header: col, datakey: col }));
    } else {
      columnDefs = this.columns as any[];
    }

    const headers = columnDefs.map(c => c.header);
    const tableBody = this.jsonData.map(row =>
      columnDefs.map(col => row[col.datakey] ?? '')
    );

    const pdf = new jsPDF();
    pdf.text('REPORTE DE PAQUETES', 11, 8);
    (pdf as any).autoTable({
      head: [headers],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [26, 26, 26], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
      alternateRowStyles: { fillColor: [242, 244, 246] },
      styles: { fontSize: 8, halign: 'center' }
    });
    pdf.save(`${this.fileName}.pdf`);
  }
}