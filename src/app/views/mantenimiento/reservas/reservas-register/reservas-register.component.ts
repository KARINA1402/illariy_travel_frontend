import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  TemplateRef,
} from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { ClienteModel } from 'src/app/models/clientes.model';
import { ReservasModel } from 'src/app/models/reservas.model';
import { ClientesService } from 'src/app/service/clientes.service';
import { SesionService } from 'src/app/service/sesion.service';
import { ReservasService } from 'src/app/service/reservas.service';
import { DestinoService } from 'src/app/service/destino.service';
import { PaqueteModel } from 'src/app/models/paquete.model';
import { PaqueteService } from 'src/app/service/paquete.service';
import { DetalleReservaModel } from 'src/app/models/detalleReservas.model';
import { Pipe, PipeTransform } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Observable } from 'rxjs';
import Swal from 'sweetalert2';

@Pipe({ name: 'round' })
export class RoundPipe implements PipeTransform {
  transform(value: number): number {
    return Math.round(value * 100) / 100;
  }
}

@Component({
  selector: 'app-reservas-register',
  templateUrl: './reservas-register.component.html',
  styleUrls: ['./reservas-register.component.css'],
})
export class ReservasRegisterComponent implements OnInit {
  page = 1;
  filtroCliente = '';
  filtroPaquete = '';
  filtro = '';
  today: Date = new Date();
  pipe = new DatePipe('en-US');
  todayWithPipe = null;
  edadMinima: number = 18;

  @Input() reservas: ReservasModel = new ReservasModel();
  @Output() closeModalEmmit = new EventEmitter<boolean>();

  modalRef?: BsModalRef;
  myForm: FormGroup;

  // cliente
  formNewClienteReserva = new FormGroup({});
  clienteSelect: ClienteModel = new ClienteModel();
  clienteList: ClienteModel[] = [];

  // acompañantes activos en el formulario
  acompanantes: ClienteModel[] = [];
  acompanantesList: ClienteModel[] = [];

  acompanantesComprobante: ClienteModel[] = [];

  // paquete
  paquete: PaqueteModel[] = [];
  paqueteselect: PaqueteModel = new PaqueteModel();

  // otros
  usuario: any = {};
  cliente: any = {};
  paquetesseleccionados: PaqueteModel[] = [];
  pagar_con!: number;
  vuelto: number = 0;
  total_price: number = 0;
  nombre_moneda: string = '';
  tituloModal: string = '';
  miReserva: ReservasModel = new ReservasModel();
  destinoTiplist$!: Observable<any[]>;
  destinoTiplist: any = [];
  destino_nombreTipoMap: Map<number, string> = new Map();
  destino_monedaTipoMap: Map<number, string> = new Map();
  pagarConComprobante: number = 0;
  vueltoComprobante: number = 0;

  constructor(
    private modalService: BsModalService,
    private _sesionSevice: SesionService,
    private fb: FormBuilder,
    private _clienteServece: ClientesService,
    private _reservasService: ReservasService,
    private _produtoservice: PaqueteService,
    private _destinoservice: DestinoService,
  ) {
    this.myForm = this.fb.group({
      iD_Reserva: [null],
      iD_Cliente: [null, [Validators.required]],
      iD_Paquete: [null, [Validators.required]],
      fecha_Reserva: [null],
      numero_Personas: [1, [Validators.required, Validators.min(1)]],
      precio_Total: [null],
      estatus: [null],
      observaciones: [null],
      iD_Pago: [null],
      metodo_Pago: [null],
      monto: [null],
      fecha_Pago: [null],
      numero_Transaccion: [null],
      pagar_con: [null],
      vuelto: [null],
      DetalleReservas: this.fb.array([]),
    });
  }

  get f() { return this.myForm.controls; }

  get DetalleReservas(): FormArray {
    return this.myForm.get('DetalleReservas') as FormArray;
  }

  ngOnInit(): void {
    this.myForm.patchValue({
      ...this.reservas,
      numero_Personas:
        this.reservas.numero_Personas && this.reservas.numero_Personas > 0
          ? this.reservas.numero_Personas : 1,
    });

    this.obtenerUsuario();
    this.destinoTiplist$ = this._destinoservice.getAll();
    this.refreshDestinotipoMap();

    this.myForm.get('numero_Personas')?.valueChanges.subscribe((valor) => {
      const numeroValido = Math.max(1, parseInt(valor) || 1);
      const maxAcompanantes = numeroValido - 1;
      if (this.acompanantes.length > maxAcompanantes) {
        this.acompanantes = this.acompanantes.slice(0, maxAcompanantes);
      }
      this.calcularTotalPrice();
    });
  }

  refreshDestinotipoMap() {
    this._destinoservice.getAll().subscribe((data) => {
      this.destinoTiplist = data;
      for (let i = 0; i < data.length; i++) {
        this.destino_nombreTipoMap.set(data[i].iD_Destino, data[i].nombre);
        this.destino_monedaTipoMap.set(data[i].iD_Destino, data[i].moneda);
      }
    });
  }

  newReservaArray(detalle: DetalleReservaModel): FormGroup {
    const paqueteEncontrado = this.paquete.find(p => p.iD_Paquete === detalle.iD_Paquete);
    const destino_nombre = paqueteEncontrado ? this.destino_nombreTipoMap.get(paqueteEncontrado.iD_Destino) : '';
    const destino_moneda = paqueteEncontrado ? this.destino_monedaTipoMap.get(paqueteEncontrado.iD_Destino) : '';
    const destino_moneda_monto = `${detalle.precio_base_paquete} ${destino_moneda}`;

    return this.fb.group({
      iD_Pago: [{ value: detalle.iD_Pago, disabled: true }],
      iD_Reserva: [detalle.iD_Reserva],
      iD_Paquete: [detalle.iD_Paquete],
      precio_total: [0],
      html_nombre_paquete: [detalle.nombre_paquete],
      html_descripcion_paquete: [detalle.descripcion_paquete],
      html_duracion_paquete: [detalle.duracion_paquete],
      html_fecha_inicio_paquete: [detalle.fecha_inicio_paquete],
      html_fecha_fin_paquete: [detalle.fecha_fin_paquete],
      html_destino_paquete: [destino_nombre],
      html_moneda_paquete: [destino_moneda],
      precio_base_paquete: [detalle.precio_base_paquete],
      html_moneda_monto: [destino_moneda_monto],
    });
  }

  obtenerUsuario() {
    this.usuario = this._sesionSevice.getUser();
  }

  openListCliente(template: TemplateRef<any>) {
    this.filtroCliente = '';
    this.filtroPaquete = '';
    this.filtro = '';
    this._clienteServece.getAll().subscribe((data: ClienteModel[]) => {
      this.clienteList = data;
      this.openModal(template);
    });
  }

  openListPaquete(template: TemplateRef<any>) {
    this.filtroPaquete = '';
    this._produtoservice.getAll().subscribe((data: PaqueteModel[]) => {
      this.paquete = data;
      this.openModal(template);
    });
  }

  openListAcompanantes(template: TemplateRef<any>) {
    this.filtro = '';
    this._clienteServece.getAll().subscribe((data: ClienteModel[]) => {
      // Guardamos la lista completa filtrando al titular y los ya seleccionados
      this.acompanantesList = data.filter(
        (c) =>
          c.iD_Cliente !== this.clienteSelect.iD_Cliente &&
          !this.acompanantes.some((a) => a.iD_Cliente === c.iD_Cliente)
      );
      this.openModal(template);
    });
  }

  agregarAcompanante(cliente: ClienteModel) {
    if (this.acompanantes.find((a) => a.iD_Cliente === cliente.iD_Cliente)) {
      Swal.fire({ position: 'center', icon: 'warning', title: 'Este cliente ya está agregado', showConfirmButton: false, timer: 1500 });
      return;
    }
    if (this.obtenerAcompanantesFaltantes() <= 0) {
      Swal.fire({ position: 'center', icon: 'warning', title: 'Ya se alcanzó el número máximo de personas', showConfirmButton: false, timer: 1500 });
      return;
    }

    this.acompanantes.push(cliente);

    this.acompanantesList = this.acompanantesList.filter(c => c.iD_Cliente !== cliente.iD_Cliente);

    if (this.obtenerAcompanantesFaltantes() === 0) {
      this.modalRef?.hide();
    }
  }

  removerAcompanante(index: number) {
    this.acompanantes.splice(index, 1);
  }

  obtenerAcompanantesFaltantes(): number {
    const numeroPersonas = parseInt(this.myForm.get('numero_Personas')?.value) || 1;
    return Math.max(0, numeroPersonas - (this.acompanantes.length + 1));
  }

  private parseFechaNacimiento(fechaNacimiento: string | Date): Date | null {
    if (!fechaNacimiento) return null;

    if (fechaNacimiento instanceof Date) {
      return isNaN(fechaNacimiento.getTime()) ? null : fechaNacimiento;
    }

    const str = fechaNacimiento.trim();

    const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      const dia = parseInt(match[1], 10);
      const mes = parseInt(match[2], 10);
      const anio = parseInt(match[3], 10);
      const fecha = new Date(anio, mes - 1, dia);
      return isNaN(fecha.getTime()) ? null : fecha;
    }

    const fechaIso = new Date(str);
    return isNaN(fechaIso.getTime()) ? null : fechaIso;
  }

  calcularEdad(fechaNacimiento: string | Date): number {
    const nacimiento = this.parseFechaNacimiento(fechaNacimiento);
    if (!nacimiento) return 0;

    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }
    return edad;
  }

  esMayorDeEdad(): boolean {
    if (!this.clienteSelect?.fecha_Nacimiento) return false;
    return this.calcularEdad(this.clienteSelect.fecha_Nacimiento) >= this.edadMinima;
  }

  puedeAgregarAcompanantes(): boolean {
    const numeroPersonas = parseInt(this.myForm.get('numero_Personas')?.value) || 1;
    return numeroPersonas > 1 && this.obtenerAcompanantesFaltantes() > 0;
  }

  openModal(template: TemplateRef<any>) {
    this.modalRef = this.modalService.show(template, Object.assign({}, {
      class: 'gray modal-lg modal-dialog-centered',
      ignoreBackdropClick: true,
      keyboard: true,
    }));
  }

  closeModal(res: boolean) {
    this.closeModalEmmit.emit(res);
  }

  onChangeCliente(cliente: any) {
    this.clienteSelect = cliente;
    this.miReserva.iD_Cliente = cliente.iD_Cliente;
    this.acompanantes = [];
    this.modalRef?.hide();
  }

  onChangePaquete(paquete: PaqueteModel) {
    this.paqueteselect = paquete;
    this.miReserva.iD_Paquete = paquete.iD_Paquete;
    this.DetalleReservas.clear();

    let detalleReserva: DetalleReservaModel = new DetalleReservaModel();
    detalleReserva.iD_Pago = 0;
    detalleReserva.iD_Paquete = paquete.iD_Paquete;
    detalleReserva.iD_Reserva = 0;
    detalleReserva.nombre_paquete = paquete.nombre;
    detalleReserva.descripcion_paquete = paquete.descripcion;
    detalleReserva.duracion_paquete = paquete.duracion;
    detalleReserva.fecha_inicio_paquete = paquete.fecha_Inicio;
    detalleReserva.fecha_fin_paquete = paquete.fecha_Fin;
    detalleReserva.precio_base_paquete = paquete.precio_Base;
    this.DetalleReservas.push(this.newReservaArray(detalleReserva));

    this.calcularTotalPrice();
    this.modalRef?.hide();
  }

  save() {
    this.reservas = this.myForm.getRawValue();
    if (!this.reservas.iD_Reserva || this.reservas.iD_Reserva == 0) {
      this.createReserva();
    } else {
      this.updateReserva();
    }
  }

  createReserva() {
    this._reservasService.create(this.reservas).subscribe(
      (data: ReservasModel) => {
        Swal.fire({ position: 'center', icon: 'success', title: 'Registro creado de forma satisfactoria', showConfirmButton: false, timer: 1650 });
        this.closeModalEmmit.emit(true);
      },
      (err) => { console.log(err); this.closeModalEmmit.emit(false); }
    );
  }

  updateReserva() {
    this._reservasService.update(this.reservas).subscribe(
      (data: ReservasModel) => {
        Swal.fire({ position: 'center', icon: 'success', title: 'Registro actualizado de forma satisfactoria', showConfirmButton: false, timer: 1650 });
        this.closeModalEmmit.emit(true);
      },
      (err) => { console.log(err); this.closeModalEmmit.emit(false); }
    );
  }

  removeElement(i: number) {
    this.DetalleReservas.removeAt(i);
    this.calcularTotalPrice();
  }

  changerValueFormArray(i: number) {
    this.DetalleReservas.controls[i].get('precio_base_paquete')?.setValue(0);
    this.calcularTotalPrice();
  }

  getMonedaPorPaquete(iD_Paquete: number): string {
    const p = this.paquete.find(p => p.iD_Paquete === iD_Paquete);
    return p ? this.destino_monedaTipoMap.get(p.iD_Destino) || '' : '';
  }

  calcularTotalPrice() {
    this.total_price = 0;
    const numeroPersonas = parseInt(this.myForm.get('numero_Personas')?.value) || 1;
    const detalles: DetalleReservaModel[] = this.DetalleReservas.getRawValue();

    detalles.forEach((detalle) => {
      if (detalle.precio_base_paquete) {
        this.total_price += detalle.precio_base_paquete * numeroPersonas;
      }
    });

    if (this.paqueteselect?.iD_Paquete) {
      this.nombre_moneda = this.destino_monedaTipoMap.get(this.paqueteselect.iD_Destino) || '';
    }

    this.myForm.get('precio_Total')?.setValue(this.total_price);

    // ✅ ASIGNAR AUTOMÁTICAMENTE pagar_con con el total y vuelto en 0
    this.pagar_con = this.total_price;
    this.vuelto = 0;
  }

  calcularVuelto(event: any) {
    this.pagar_con = parseFloat(event.target.value);
    if (isNaN(this.pagar_con) || !this.pagar_con) {
      this.vuelto = 0;
    } else if (this.pagar_con < this.total_price) {
      Swal.fire({ position: 'center', icon: 'info', title: 'El monto a pagar es menor al precio total', showConfirmButton: false, timer: 1650 });
      this.vuelto = 0;
    } else {
      this.vuelto = this.pagar_con - this.total_price;
    }
  }

  limpiarTablas() {
    this.myForm.reset();
    this.clienteSelect = new ClienteModel();
    this.acompanantes = [];
    this.paqueteselect = new PaqueteModel();
    this.total_price = 0;
    this.pagar_con = 0;
    this.vuelto = 0;
    this.nombre_moneda = '';

    while (this.DetalleReservas.length !== 0) {
      this.DetalleReservas.removeAt(0);
    }

    this.myForm.patchValue({
      iD_Reserva: null, iD_Cliente: null, iD_Paquete: null,
      fecha_Reserva: null, numero_Personas: 1, precio_Total: null,
      estatus: null, observaciones: null, iD_Pago: null,
      metodo_Pago: null, monto: null, fecha_Pago: null, numero_Transaccion: null,
      pagar_con: null, vuelto: null,
    });
  }

  formatearFechaHora(fecha: any): string {
    const date = new Date(fecha);
    const dia = String(date.getDate()).padStart(2, '0');
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const anio = date.getFullYear();
    let hora = date.getHours();
    const minutos = String(date.getMinutes()).padStart(2, '0');
    const ampm = hora >= 12 ? 'pm' : 'am';
    hora = hora % 12;
    hora = hora ? hora : 12;
    const horaFormato = String(hora).padStart(2, '0');
    return `${dia}/${mes}/${anio} ${horaFormato}:${minutos} ${ampm}`;
  }

  realizarReserva(template: TemplateRef<any>) {
    // ─── 1. VALIDACIONES EXISTENTES ──────────────────────
    if (!this.clienteSelect.iD_Cliente || !this.paqueteselect.iD_Paquete) {
      Swal.fire({ icon: 'warning', title: 'Seleccione cliente y paquete' });
      return;
    }
    if (this.obtenerAcompanantesFaltantes() > 0) {
      Swal.fire({ icon: 'warning', title: `Faltan ${this.obtenerAcompanantesFaltantes()} acompañante(s)` });
      return;
    }
    if (!this.pagar_con || this.pagar_con < this.total_price) {
      Swal.fire({ icon: 'error', title: 'Monto insuficiente' });
      return;
    }
    if (!this.esMayorDeEdad()) {
      Swal.fire({ icon: 'error', title: 'El titular debe ser mayor de edad' });
      return;
    }

    // ─── 2. OBTENER DATOS DEL FORMULARIO ──────────────────
    const formValues = this.myForm.value;
    const ahora = new Date();
    const fechaFormateada = this.formatearFechaHora(ahora);
    const numeroTransaccion = `RES-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // ─── 3. CONSTRUIR EL PAYLOAD COMPLETO ─────────────────
    const payload = {
      // ── Reserva ──
      ID_Cliente: this.clienteSelect.iD_Cliente,
      ID_Paquete: this.paqueteselect.iD_Paquete,
      Fecha_Reserva: fechaFormateada,
      Numero_Personas: parseInt(formValues.numero_Personas) || 1,
      Precio_Total: this.total_price,
      Observaciones: formValues.observaciones || '',

      // ── Pago ──
      Metodo_Pago: 'Efectivo',          // o el que corresponda
      Monto: this.pagar_con,
      Fecha_Pago: fechaFormateada,
      Numero_Transaccion: numeroTransaccion,
      Moneda: this.nombre_moneda || 'PEN',
      DestinoNombre: this.destino_nombreTipoMap.get(this.paqueteselect.iD_Destino) || '',

      // ── Cliente (objeto completo) ──
      Cliente: {
        ID_Cliente: this.clienteSelect.iD_Cliente,
        Nombre: this.clienteSelect.nombre || '',
        Apellido: this.clienteSelect.apellido || '',
        Telefono: this.clienteSelect.telefono || '',
        Correo: this.clienteSelect.correo || '',
        Pasaporte: this.clienteSelect.pasaporte || '',
        Nacionalidad: this.clienteSelect.nacionalidad || ''
      },

      // ── Acompañantes (array de objetos) ──
      Acompanantes: this.acompanantes.map(a => ({
        ID_Cliente: a.iD_Cliente,
        Nombre: a.nombre || '',
        Apellido: a.apellido || '',
        Telefono: a.telefono || '',
        Correo: a.correo || '',
        Pasaporte: a.pasaporte || '',
        Nacionalidad: a.nacionalidad || ''
      })),

      // ── Paquete (objeto completo) ──
      Paquete: {
        ID_Paquete: this.paqueteselect.iD_Paquete,
        Nombre: this.paqueteselect.nombre || '',
        Descripcion: this.paqueteselect.descripcion || '',
        Fecha_Inicio: this.paqueteselect.fecha_Inicio || '',
        Fecha_Fin: this.paqueteselect.fecha_Fin || '',
        Precio_Base: Number(this.paqueteselect.precio_Base).toFixed(2),
        ID_Destino: this.paqueteselect.iD_Destino,
        Inclusiones: this.paqueteselect.inclusiones || '',
        Exclusiones: this.paqueteselect.exclusiones || ''
      }
    };

    // ─── 4. ENVIAR AL BACKEND (usando confirmarReserva) ──
    Swal.fire({ title: 'Procesando reserva...', allowOutsideClick: false, didOpen: () => Swal.showLoading(null) });

    this._reservasService.confirmarReserva(payload).subscribe(
      (response: any) => {
        // ── 5. PROCESAR RESPUESTA ──────────────────────────
        Swal.close();

        if (response.success) {
          // Guardar datos para el comprobante
          this.miReserva = {
            ...new ReservasModel(),
            iD_Reserva: response.id_Reserva,
            iD_Cliente: this.clienteSelect.iD_Cliente,
            iD_Paquete: this.paqueteselect.iD_Paquete,
            fecha_Reserva: fechaFormateada,
            numero_Personas: parseInt(formValues.numero_Personas),
            precio_Total: this.total_price,
            estatus: 'Pagado',
            observaciones: formValues.observaciones,
            numero_Transaccion: numeroTransaccion,
            iD_Usuario: this.usuario?.iD_Usuario || 0
          };
          this.acompanantesComprobante = [...this.acompanantes];
          this.pagarConComprobante = this.pagar_con;
          this.vueltoComprobante = this.vuelto;

          // Mensaje de éxito
          Swal.fire({
            icon: 'success',
            title: 'Reserva realizada',
            text: 'La reserva se ha registrado correctamente.',
            timer: 2000,
            showConfirmButton: true
          }).then(() => {
            if (response.correoEnviado) {
              Swal.fire({
                icon: 'success',
                title: 'Correo enviado',
                text: `El comprobante ha sido enviado a ${this.clienteSelect.correo || 'tu correo'}.`,
                timer: 3000,
                showConfirmButton: true
              });
            } else {
              Swal.fire({
                icon: 'warning',
                title: 'Correo no enviado',
                text: 'No se pudo enviar el correo (el cliente no tiene email o hubo un error).',
                timer: 4000,
                showConfirmButton: true
              });
            }
          });

          // Limpiar formulario y abrir modal de comprobante
          this.limpiarTablas();
          setTimeout(() => {
            this.tituloModal = 'COMPROBANTE DE RESERVA';
            this.openModal(template);
          }, 2000);

        } else {
          throw new Error(response.mensaje || 'Error al crear reserva');
        }
      },
      (error) => {
        Swal.close();
        console.error('Error en confirmarReserva:', error);
        let mensajeError = 'Ocurrió un error al procesar la reserva';
        if (error.error?.errores) {
          mensajeError = 'Errores de validación:\n' + JSON.stringify(error.error.errores, null, 2);
        } else if (error.error?.mensaje) {
          mensajeError = error.error.mensaje;
        }
        Swal.fire({ icon: 'error', title: 'Error', text: mensajeError });
      }
    );
  }

  listReserva(template: TemplateRef<any>) {
    this.openModal(template);
  }
}