import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ReservasService } from 'src/app/service/reservas.service';
import { PaqueteService } from 'src/app/service/paquete.service';
import { DestinoService } from 'src/app/service/destino.service';
import { ClientesService } from 'src/app/service/clientes.service';
import { ReservasModel } from 'src/app/models/reservas.model';
import { PaqueteModel } from 'src/app/models/paquete.model';
import { ClienteModel } from 'src/app/models/clientes.model';
import * as XLSX from 'xlsx-js-style';
import * as FileSaver from 'file-saver';
import Swal from 'sweetalert2';

declare const Chart: any;

const EXCEL_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8';
const EXCEL_EXTENSION = '.xlsx';

interface TopItem { nombre: string; cantidad: number; }
interface ResumenEstado { estado: string; cantidad: number; }

interface ClientePorPaquete {
  paquete: string;
  cliente: string;
  pasaporte: string;
  nacionalidad: string;
  correo: string;
  telefono: string;
  totalPersonas: number;
  acompanantes: number;
  fechaSalida: string;
  fechaFin: string;
  estado: string;
  fechaReserva: string;
  precio: number;
}

interface ClientesPaqueteAgg { nombre: string; clientes: number; pasajeros: number; }

interface ResumenSalida {
  paquete: string;
  fechaSalida: string;
  fechaFin: string;
  reservas: number;
  pasajeros: number;
  ingresos: number;
}

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.css']
})
export class WelcomeComponent implements OnInit, OnDestroy {
  // Reloj
  currentTime = new Date();
  currentHours!: number;
  currentMinutes!: number;
  currentSeconds!: number;
  am_pm!: string;
  private clockInterval: any;

  // Datos
  private reservasTodas: ReservasModel[] = [];
  private paqueteMap: Map<number, PaqueteModel> = new Map();
  private paqueteNombreMap: { [id: number]: string } = {};
  private destinoNombreMap: Map<number, string> = new Map();
  private destinoMonedaMap: Map<number, string> = new Map();
  private clienteMap: Map<number, ClienteModel> = new Map();

  // Filtros
  fechaInicio = '';
  fechaFin = '';
  fechaMinimaStr = '';
  fechaMaximaStr = '';
  fechaMinimaGlobal: Date | null = null;
  fechaMaximaGlobal: Date | null = null;

  // KPIs
  totalReportes = 0;
  totalIngresos = 0;
  topPaquetes: TopItem[] = [];
  topDestinos: TopItem[] = [];
  resumenEstados: ResumenEstado[] = [];

  // Reportes de clientes / pasajeros
  clientesPorPaqueteDetalle: ClientePorPaquete[] = [];
  clientesPorPaqueteResumen: ClientesPaqueteAgg[] = [];
  resumenPorSalida: ResumenSalida[] = [];

  // Charts
  private charts: { [id: string]: any } = {};
  private readonly PALETTE = [
    '#F97316', '#14B8A6', '#A855F7', '#EF4444', '#3B82F6',
    '#F59E0B', '#8B5CF6', '#EC4899', '#10B981', '#6366F1'
  ];

  constructor(
    private _reservasService: ReservasService,
    private _paqueteService: PaqueteService,
    private _destinoservice: DestinoService,
    private _clientesService: ClientesService,
    private cdRef: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.iniciarReloj();
    this.cargarDatos();
  }

  ngOnDestroy(): void {
    clearInterval(this.clockInterval);
    Object.values(this.charts).forEach(c => c?.destroy());
  }

  private iniciarReloj(): void {
    const tick = () => {
      this.currentTime = new Date();
      this.currentHours = this.currentTime.getHours();
      this.currentMinutes = this.currentTime.getMinutes();
      this.currentSeconds = this.currentTime.getSeconds();
      this.am_pm = this.currentHours >= 12 ? 'p.m' : 'a.m';
      this.currentHours = this.currentHours % 12 || 12;
    };
    tick();
    this.clockInterval = setInterval(tick, 1000);
  }

  private cargarChartJs(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof (window as any)['Chart'] !== 'undefined') { resolve(); return; }
      const existing = document.querySelector('script[data-chartjs]');
      if (existing) { existing.addEventListener('load', () => resolve()); return; }
      const script = document.createElement('script');
      script.setAttribute('data-chartjs', 'true');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('No se pudo cargar Chart.js'));
      document.head.appendChild(script);
    });
  }

  private cargarDatos(): void {
    forkJoin([
      this._paqueteService.getAll(9999),
      this._reservasService.getAll(9999),
      this._destinoservice.getAll(9999),
      this._clientesService.getAll(9999)
    ]).subscribe(([paquetes, reservas, destinos, clientes]) => {
      paquetes.forEach(p => {
        this.paqueteMap.set(p.iD_Paquete, p);
        this.paqueteNombreMap[p.iD_Paquete] = p.nombre;
      });
      destinos.forEach(d => {
        this.destinoNombreMap.set(d.iD_Destino, d.nombre);
        this.destinoMonedaMap.set(d.iD_Destino, d.moneda);
      });
      clientes.forEach(c => this.clienteMap.set(c.iD_Cliente, c));
      reservas.forEach(r => {
        const paq = this.paqueteMap.get(r.iD_Paquete);
        if (paq) r.paquete = paq;
      });

      this.reservasTodas = reservas;
      this.calcularFechasExtremas(reservas);
      this.cdRef.detectChanges();

      this.cargarChartJs().then(() => setTimeout(() => this.renderizarGraficos(), 100))
        .catch(err => {
          console.error(err);
          Swal.fire('Sin gráficos', 'No se pudo cargar Chart.js. Verifica tu conexión.', 'warning');
        });
    }, err => console.error(err));
  }

  private calcularFechasExtremas(reservas: ReservasModel[]): void {
    let min: Date | null = null, max: Date | null = null;
    reservas.forEach(r => {
      const f = this.parseFecha(r.fecha_Reserva);
      if (f) {
        if (!min || f < min) min = f;
        if (!max || f > max) max = f;
      }
    });
    this.fechaMinimaGlobal = min;
    this.fechaMaximaGlobal = max;
    if (min) this.fechaMinimaStr = this.toYMD(min);
    if (max) this.fechaMaximaStr = this.toYMD(max);
    if (min && max) {
      this.fechaInicio = this.fechaMinimaStr;
      this.fechaFin = this.fechaMaximaStr;
    }
  }

  private parseFecha(s: string): Date | null {
    if (!s) return null;
    const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(am|pm)$/i);
    if (!m) return null;
    let h = parseInt(m[4], 10);
    const mn = parseInt(m[5], 10);
    if (m[6].toLowerCase() === 'pm' && h !== 12) h += 12;
    if (m[6].toLowerCase() === 'am' && h === 12) h = 0;
    return new Date(+m[3], +m[2] - 1, +m[1], h, mn);
  }

  // fecha_Inicio/fecha_Fin del paquete puede venir como ISO ("2026-09-15") o
  // con el mismo formato con hora que usas en reservas; probamos ambos.
  private parseFechaGenerica(s: string): Date | null {
    if (!s) return null;
    const conHora = this.parseFecha(s);
    if (conHora) return conHora;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  formatearFecha(s: string): string {
    const d = this.parseFechaGenerica(s);
    if (!d) return s || '—';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  private toYMD(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  fechasValidas(): boolean {
    if (!this.fechaInicio || !this.fechaFin) return false;
    return new Date(this.fechaInicio) <= new Date(this.fechaFin);
  }

  private filtrarPorRango(): ReservasModel[] {
    if (!this.fechaInicio || !this.fechaFin) return this.reservasTodas;
    const s = new Date(this.fechaInicio); s.setHours(0, 0, 0, 0);
    const e = new Date(this.fechaFin); e.setHours(23, 59, 59, 999);
    return this.reservasTodas.filter(r => {
      const f = this.parseFecha(r.fecha_Reserva);
      return f && f >= s && f <= e;
    });
  }

  aplicarFiltro(): void { this.renderizarGraficos(); }

  private renderizarGraficos(): void {
    const datos = this.filtrarPorRango();
    this.calcularKPIs(datos);
    this.renderTopPaquetes(datos);
    this.renderTopDestinos(datos);
    this.renderEstados(datos);
    this.renderPersonas(datos);
    this.renderTendencia(datos);
    this.calcularReportesClientes(datos);
    this.renderClientesPorPaquete();
    this.renderPasajerosPorSalida();
    this.cdRef.detectChanges();
  }

  private calcularKPIs(datos: ReservasModel[]): void {
    this.totalReportes = datos.length;
    this.totalIngresos = datos.reduce((sum, r) => sum + (r.precio_Total || 0), 0);

    const mapPaq = new Map<string, number>();
    datos.forEach(r => {
      const n = this.paqueteNombreMap[r.iD_Paquete] || 'Desconocido';
      mapPaq.set(n, (mapPaq.get(n) || 0) + 1);
    });
    this.topPaquetes = [...mapPaq.entries()]
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);

    const mapDest = new Map<string, number>();
    datos.forEach(r => {
      const n = this.destinoNombreMap.get(r.paquete?.iD_Destino ?? 0) || 'Desconocido';
      mapDest.set(n, (mapDest.get(n) || 0) + 1);
    });
    this.topDestinos = [...mapDest.entries()]
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);

    const estadosMap = new Map<string, number>();
    datos.forEach(r => estadosMap.set(r.estatus, (estadosMap.get(r.estatus) || 0) + 1));
    this.resumenEstados = [...estadosMap.entries()]
      .map(([estado, cantidad]) => ({ estado, cantidad }));
  }

  private calcularReportesClientes(datos: ReservasModel[]): void {
    // Detalle: 1 fila por reserva (titular + cantidad de acompañantes)
    this.clientesPorPaqueteDetalle = datos.map(r => {
      const cliente = this.clienteMap.get(r.iD_Cliente);
      const paq = this.paqueteMap.get(r.iD_Paquete);
      return {
        paquete: paq?.nombre || this.paqueteNombreMap[r.iD_Paquete] || 'Desconocido',
        cliente: cliente ? `${cliente.nombre} ${cliente.apellido}`.trim() : 'Desconocido',
        pasaporte: cliente?.pasaporte || '',
        nacionalidad: cliente?.nacionalidad || '',
        correo: cliente?.correo || '',
        telefono: cliente?.telefono || '',
        totalPersonas: r.numero_Personas || 0,
        acompanantes: Math.max((r.numero_Personas || 0) - 1, 0),
        fechaSalida: paq?.fecha_Inicio || '',
        fechaFin: paq?.fecha_Fin || '',
        estado: r.estatus,
        fechaReserva: r.fecha_Reserva,
        precio: r.precio_Total || 0
      } as ClientePorPaquete;
    });

    // Resumen agregado por paquete (para el gráfico de barras)
    const mapPaqAgg = new Map<string, { clientes: number; pasajeros: number }>();
    datos.forEach(r => {
      const nombre = this.paqueteNombreMap[r.iD_Paquete] || 'Desconocido';
      const cur = mapPaqAgg.get(nombre) || { clientes: 0, pasajeros: 0 };
      cur.clientes++;
      cur.pasajeros += r.numero_Personas || 0;
      mapPaqAgg.set(nombre, cur);
    });
    this.clientesPorPaqueteResumen = [...mapPaqAgg.entries()]
      .map(([nombre, v]) => ({ nombre, clientes: v.clientes, pasajeros: v.pasajeros }))
      .sort((a, b) => b.pasajeros - a.pasajeros);

    // Resumen por salida (paquete + fecha_Inicio del paquete)
    const mapSalida = new Map<string, ResumenSalida>();
    datos.forEach(r => {
      const paq = this.paqueteMap.get(r.iD_Paquete);
      const nombre = paq?.nombre || this.paqueteNombreMap[r.iD_Paquete] || 'Desconocido';
      const fechaSalida = paq?.fecha_Inicio || '';
      const key = `${nombre}|${fechaSalida}`;
      const cur = mapSalida.get(key) || {
        paquete: nombre,
        fechaSalida,
        fechaFin: paq?.fecha_Fin || '',
        reservas: 0,
        pasajeros: 0,
        ingresos: 0
      };
      cur.reservas++;
      cur.pasajeros += r.numero_Personas || 0;
      cur.ingresos += r.precio_Total || 0;
      mapSalida.set(key, cur);
    });
    this.resumenPorSalida = [...mapSalida.values()].sort((a, b) => {
      const da = this.parseFechaGenerica(a.fechaSalida);
      const db = this.parseFechaGenerica(b.fechaSalida);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da.getTime() - db.getTime();
    });
  }

  private renderTopPaquetes(datos: ReservasModel[]): void {
    const top = this.topPaquetes.slice(0, 6);
    // Generar un color diferente para cada barra
    const colores = this.PALETTE.slice(0, top.length);

    this.renderChart('chartTopPaquetes', {
      type: 'bar',
      data: {
        labels: top.map(t => t.nombre),
        datasets: [{
          label: 'Reservas',
          data: top.map(t => t.cantidad),
          backgroundColor: colores,
          borderRadius: 10,
          barPercentage: 0.7,
          categoryPercentage: 0.8
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#ffffff',
            titleColor: '#0f172a',
            bodyColor: '#334155',
            borderColor: '#e2e8f0',
            borderWidth: 1,
            callbacks: {
              label: (context: any) => ` Reservas: ${context.raw}`
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { color: '#475569', stepSize: 1 },
            grid: { color: '#e2e8f0', drawBorder: false }
          },
          y: {
            ticks: { color: '#1e293b', font: { weight: '500', size: 11 } },
            grid: { display: false }
          }
        }
      }
    });
  }

  private renderTopDestinos(datos: ReservasModel[]): void {
    const top = this.topDestinos.slice(0, 6);
    const total = top.reduce((sum, t) => sum + t.cantidad, 0);

    this.renderChart('chartTopDestinos', {
      type: 'doughnut',
      data: {
        labels: top.map(t => t.nombre),
        datasets: [{
          data: top.map(t => t.cantidad),
          backgroundColor: this.PALETTE.slice(0, top.length),
          borderColor: '#ffffff',
          borderWidth: 3,
          cutout: '60%',          // mismo que Estados
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#1e293b', font: { size: 11, weight: '500' }, boxWidth: 12, padding: 12 }
          },
          tooltip: {
            backgroundColor: '#ffffff',
            titleColor: '#0f172a',
            bodyColor: '#334155',
            borderColor: '#e2e8f0',
            borderWidth: 1,
            callbacks: {
              label: (context: any) => ` ${context.label}: ${context.raw} (${((context.raw / total) * 100).toFixed(1)}%)`
            }
          }
        }
      }
    });
  }

  private renderEstados(datos: ReservasModel[]): void {
    const map: any = {};
    datos.forEach(r => map[r.estatus] = (map[r.estatus] || 0) + 1);
    const labels = Object.keys(map);
    const total = datos.length;

    this.renderChart('chartEstados', {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: labels.map(l => map[l]),
          backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
          borderColor: '#ffffff',
          borderWidth: 3,
          cutout: '60%',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#1e293b', font: { size: 11, weight: '500' }, boxWidth: 12, padding: 12 }
          },
          tooltip: {
            backgroundColor: '#ffffff',
            titleColor: '#0f172a',
            bodyColor: '#334155',
            borderColor: '#e2e8f0',
            borderWidth: 1,
            callbacks: {
              label: (context: any) => ` ${context.label}: ${context.raw} (${((context.raw / total) * 100).toFixed(1)}%)`
            }
          }
        }
      }
    });
  }

  private renderPersonas(datos: ReservasModel[]): void {
    const map = new Map<string, number>();
    datos.forEach(r => {
      const nombre = this.paqueteNombreMap[r.iD_Paquete] || 'Desconocido';
      map.set(nombre, (map.get(nombre) || 0) + (r.numero_Personas || 0));
    });
    const entries = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    // Colores distintos para cada barra
    const colores = this.PALETTE.slice(0, entries.length);

    this.renderChart('chartPersonas', {
      type: 'bar',
      data: {
        labels: entries.map(e => e[0]),
        datasets: [{
          label: 'Personas',
          data: entries.map(e => e[1]),
          backgroundColor: colores,
          borderRadius: 10,
          barPercentage: 0.65,
          categoryPercentage: 0.8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#ffffff',
            titleColor: '#0f172a',
            bodyColor: '#334155',
            borderColor: '#e2e8f0',
            borderWidth: 1
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { color: '#475569', stepSize: 1 },
            grid: { color: '#e2e8f0', drawBorder: false }
          },
          x: {
            ticks: { color: '#1e293b', font: { weight: '500', size: 10 } },
            grid: { display: false }
          }
        }
      }
    });
  }

  private renderTendencia(datos: ReservasModel[]): void {
    const map = new Map<string, number>();
    datos.forEach(r => {
      const f = this.parseFecha(r.fecha_Reserva);
      if (f) {
        const key = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`;
        map.set(key, (map.get(key) || 0) + 1);
      }
    });
    const sorted = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const ctx = document.getElementById('chartTendencia') as HTMLCanvasElement;
    const grad = ctx?.getContext('2d')?.createLinearGradient(0, 0, 0, 250);
    grad?.addColorStop(0, 'rgba(249,115,22,0.3)');
    grad?.addColorStop(1, 'rgba(249,115,22,0.02)');

    this.renderChart('chartTendencia', {
      type: 'line',
      data: {
        labels: sorted.map(([k]) => {
          const [y, m] = k.split('-');
          return `${MESES[+m - 1]} ${y}`;
        }),
        datasets: [{
          label: 'Reservas',
          data: sorted.map(([, v]) => v),
          borderColor: '#f97316',
          backgroundColor: grad,
          borderWidth: 3,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#f97316',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#ffffff',
            titleColor: '#0f172a',
            bodyColor: '#334155',
            borderColor: '#e2e8f0',
            borderWidth: 1,
            callbacks: {
              label: (context: any) => ` Reservas: ${context.raw}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { color: '#475569', stepSize: 1 },
            grid: { color: '#e2e8f0', drawBorder: false },
            title: { display: false }
          },
          x: {
            ticks: { color: '#1e293b', font: { weight: '500' } },
            grid: { display: false }
          }
        },
        elements: {
          line: { borderJoin: 'round' }
        }
      }
    });
  }

  private renderClientesPorPaquete(): void {
    const top = this.clientesPorPaqueteResumen.slice(0, 8);
    this.renderChart('chartClientesPaquete', {
      type: 'bar',
      data: {
        labels: top.map(t => t.nombre),
        datasets: [
          {
            label: 'Clientes (reservas)',
            data: top.map(t => t.clientes),
            backgroundColor: '#3B82F6',
            borderRadius: 8,
            barPercentage: 0.6,
            categoryPercentage: 0.7
          },
          {
            label: 'Pasajeros totales',
            data: top.map(t => t.pasajeros),
            backgroundColor: '#F97316',
            borderRadius: 8,
            barPercentage: 0.6,
            categoryPercentage: 0.7
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#1e293b', font: { size: 11 } } },
          tooltip: {
            backgroundColor: '#ffffff', titleColor: '#0f172a', bodyColor: '#334155',
            borderColor: '#e2e8f0', borderWidth: 1
          }
        },
        scales: {
          y: { beginAtZero: true, ticks: { color: '#475569', stepSize: 1 }, grid: { color: '#e2e8f0', drawBorder: false } },
          x: { ticks: { color: '#1e293b', font: { size: 10 } }, grid: { display: false } }
        }
      }
    });
  }

  private renderPasajerosPorSalida(): void {
    const top = this.resumenPorSalida.slice(0, 12);
    this.renderChart('chartPasajerosSalida', {
      type: 'bar',
      data: {
        labels: top.map(t => `${t.paquete} — ${this.formatearFecha(t.fechaSalida)}`),
        datasets: [{
          label: 'Pasajeros',
          data: top.map(t => t.pasajeros),
          backgroundColor: '#14B8A6',
          borderRadius: 8,
          barPercentage: 0.6,
          categoryPercentage: 0.7
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#ffffff', titleColor: '#0f172a', bodyColor: '#334155',
            borderColor: '#e2e8f0', borderWidth: 1
          }
        },
        scales: {
          x: { beginAtZero: true, ticks: { color: '#475569', stepSize: 1 }, grid: { color: '#e2e8f0', drawBorder: false } },
          y: { ticks: { color: '#1e293b', font: { size: 10 } }, grid: { display: false } }
        }
      }
    });
  }

  private renderChart(canvasId: string, config: any): void {
    const el = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!el) return;
    if (this.charts[canvasId]) {
      this.charts[canvasId].destroy();
      delete this.charts[canvasId];
    }
    this.charts[canvasId] = new Chart(el, config);
  }

  exportarExcel(): void {
    if (!this.fechasValidas()) {
      Swal.fire('Rango inválido', 'La fecha de inicio debe ser anterior o igual a la fecha de fin.', 'warning');
      return;
    }
    const datos = this.filtrarPorRango();
    if (datos.length === 0) {
      Swal.fire('Sin datos', 'No hay reservas en el rango seleccionado.', 'info');
      return;
    }

    const wb = XLSX.utils.book_new();

    const mapPaq = new Map<string, { cantidad: number; personas: number; ingresos: number }>();
    datos.forEach(r => {
      const nombre = this.paqueteNombreMap[r.iD_Paquete] || 'Desconocido';
      const cur = mapPaq.get(nombre) || { cantidad: 0, personas: 0, ingresos: 0 };
      cur.cantidad++;
      cur.personas += r.numero_Personas || 0;
      cur.ingresos += r.precio_Total || 0;
      mapPaq.set(nombre, cur);
    });
    const rowsPaq = [...mapPaq.entries()].sort((a, b) => b[1].cantidad - a[1].cantidad)
      .map(([nombre, v], i) => ({
        '#': i + 1,
        'Paquete': nombre,
        'N° Reservas': v.cantidad,
        'Total Personas': v.personas,
        'Ingresos (S/)': v.ingresos.toFixed(2)
      }));
    XLSX.utils.book_append_sheet(wb, this.createStyledSheet(rowsPaq, ['#', 'Paquete', 'N° Reservas', 'Total Personas', 'Ingresos (S/)']), 'Top Paquetes');

    const mapDest = new Map<string, { cantidad: number; personas: number }>();
    datos.forEach(r => {
      const nombre = this.destinoNombreMap.get(r.paquete?.iD_Destino ?? 0) || 'Desconocido';
      const cur = mapDest.get(nombre) || { cantidad: 0, personas: 0 };
      cur.cantidad++; cur.personas += r.numero_Personas || 0;
      mapDest.set(nombre, cur);
    });
    const rowsDest = [...mapDest.entries()].sort((a, b) => b[1].cantidad - a[1].cantidad)
      .map(([nombre, v], i) => ({
        '#': i + 1,
        'Destino': nombre,
        'N° Reservas': v.cantidad,
        'Total Personas': v.personas
      }));
    XLSX.utils.book_append_sheet(wb, this.createStyledSheet(rowsDest, ['#', 'Destino', 'N° Reservas', 'Total Personas']), 'Top Destinos');

    const rowsEst = this.resumenEstados.map((e, i) => ({
      '#': i + 1,
      'Estado': e.estado,
      'Cantidad': e.cantidad
    }));
    XLSX.utils.book_append_sheet(wb, this.createStyledSheet(rowsEst, ['#', 'Estado', 'Cantidad']), 'Reservas por Estado');

    // Hoja: Clientes por Paquete (detalle)
    const rowsClientes = this.clientesPorPaqueteDetalle.map((c, i) => ({
      '#': i + 1,
      'Paquete': c.paquete,
      'Cliente (Titular)': c.cliente,
      'Pasaporte': c.pasaporte,
      'Nacionalidad': c.nacionalidad,
      'Correo': c.correo,
      'Teléfono': c.telefono,
      'N° Pasajeros': c.totalPersonas,
      'Acompañantes': c.acompanantes,
      'Fecha Salida': this.formatearFecha(c.fechaSalida),
      'Fecha Fin': this.formatearFecha(c.fechaFin),
      'Estado': c.estado,
      'Precio (S/)': c.precio.toFixed(2)
    }));
    XLSX.utils.book_append_sheet(wb, this.createStyledSheet(rowsClientes,
      ['#', 'Paquete', 'Cliente (Titular)', 'Pasaporte', 'Nacionalidad', 'Correo', 'Teléfono',
        'N° Pasajeros', 'Acompañantes', 'Fecha Salida', 'Fecha Fin', 'Estado', 'Precio (S/)']
    ), 'Clientes por Paquete');

    // Hoja: Resumen por Salida
    const rowsSalida = this.resumenPorSalida.map((s, i) => ({
      '#': i + 1,
      'Paquete': s.paquete,
      'Fecha Salida': this.formatearFecha(s.fechaSalida),
      'Fecha Fin': this.formatearFecha(s.fechaFin),
      'N° Reservas': s.reservas,
      'N° Pasajeros': s.pasajeros,
      'Ingresos (S/)': s.ingresos.toFixed(2)
    }));
    XLSX.utils.book_append_sheet(wb, this.createStyledSheet(rowsSalida,
      ['#', 'Paquete', 'Fecha Salida', 'Fecha Fin', 'N° Reservas', 'N° Pasajeros', 'Ingresos (S/)']
    ), 'Resumen por Salida');

    // Hoja: Manifiesto de Pasajeros (titular + filas en blanco para acompañantes)
    const rowsManifiesto: any[] = [];
    let contador = 1;
    this.clientesPorPaqueteDetalle.forEach(c => {
      rowsManifiesto.push({
        '#': contador++,
        'Paquete': c.paquete,
        'Fecha Salida': this.formatearFecha(c.fechaSalida),
        'Tipo': 'Titular',
        'Nombre Completo': c.cliente,
        'Pasaporte': c.pasaporte,
        'Nacionalidad': c.nacionalidad
      });
      for (let i = 0; i < c.acompanantes; i++) {
        rowsManifiesto.push({
          '#': contador++,
          'Paquete': c.paquete,
          'Fecha Salida': this.formatearFecha(c.fechaSalida),
          'Tipo': `Acompañante ${i + 1}`,
          'Nombre Completo': '',
          'Pasaporte': '',
          'Nacionalidad': ''
        });
      }
    });
    XLSX.utils.book_append_sheet(wb, this.createStyledSheet(rowsManifiesto,
      ['#', 'Paquete', 'Fecha Salida', 'Tipo', 'Nombre Completo', 'Pasaporte', 'Nacionalidad']
    ), 'Manifiesto Pasajeros');

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buffer], { type: EXCEL_TYPE });
    FileSaver.saveAs(blob, `Reporte_${this.fechaInicio}_a_${this.fechaFin}_${Date.now()}${EXCEL_EXTENSION}`);
  }

  private createStyledSheet(data: any[], headers: string[]): any {
    const sheetData = [headers, ...data.map(row => headers.map(h => row[h] ?? ''))];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    const headerStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10, name: 'Arial' },
      fill: { fgColor: { rgb: '1A1A1A' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
    };
    const cellStyle = {
      font: { sz: 9, name: 'Arial' },
      alignment: { horizontal: 'center', vertical: 'center' }
    };
    const range = XLSX.utils.decode_range(ws['!ref']!);
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[addr]) ws[addr] = { v: '', t: 's' };
        ws[addr].s = R === 0 ? headerStyle : cellStyle;
      }
    }
    ws['!cols'] = headers.map(h => ({ wch: 20 }));
    return ws;
  }
}