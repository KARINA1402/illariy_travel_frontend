import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ClienteModel } from 'src/app/models/clientes.model';
import { ClientesService } from 'src/app/service/clientes.service';
import Swal from 'sweetalert2';
import { DatePipe } from '@angular/common';
import { UsuarioModel } from 'src/app/models/usuario.model';
import { SesionService } from 'src/app/service/sesion.service';
import { environment } from 'src/environments/environment';
import { firstValueFrom } from 'rxjs';

interface VerificaPeRespuesta {
  success: boolean;
  data: {
    dni: string;
    fullName: string;
    names: string;
    paternalSurname: string;
    maternalSurname: string;
    birthDate: string;
    gender: string;
    updatedAt: string;
    source: string;
  };
  creditsRemaining: number;
}

@Component({
  selector: 'app-clientes-register',
  templateUrl: './clientes-register.component.html',
  styleUrls: ['./clientes-register.component.css']
})
export class ClientesRegisterComponent implements OnInit {

  @Input() clientes: ClienteModel = new ClienteModel();
  @Output() closeModalEmmit = new EventEmitter<boolean>();

  myForm: FormGroup;
  pipe = new DatePipe('en-US');
  usuario: UsuarioModel[] = [];
  mostrarInputOtros = false;

  // Variables para la consulta RENIEC
  buscandoDNI = false;
  dniBuscado = false;
  dniEncontrado: boolean | null = null;

  // private readonly TOKEN = 'vp_live_aada01fa0e4c4fa290b3e042fc612bb8';
  private readonly API_DNI = environment.uri_back_end + 'VerificaPe/v2/dni';
  private debounceTimer: any = null;

  readonly EDAD_MINIMA = 3;
  readonly EDAD_MAXIMA = 120;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private _clientesService: ClientesService,
    private _sesionService: SesionService
  ) {
    this.myForm = this.fb.group({
      iD_Cliente: [null, [Validators.required]],
      iD_Usuario: [null, [Validators.required]],
      nombre: [null, [Validators.required]],
      apellido: [null, [Validators.required]],
      correo: [null, [Validators.required, Validators.email]],
      telefono: [null, [Validators.required, Validators.pattern('^[0-9]{9,12}$')]],
      direccion: [null, [Validators.required]],
      fecha_Nacimiento: [null, [Validators.required, this.validarRangoEdad()]],
      nacionalidad: ['Peruana', [Validators.required]],
      nacionalidadOtros: [''],
      pasaporte: [null],
      frecuencia_Viajero: ['Media', [Validators.required]],
    });

    this.myForm.get('nacionalidad')?.valueChanges.subscribe((valor: string) => {
      const controlOtros = this.myForm.get('nacionalidadOtros');
      if (valor === 'Otros') {
        this.mostrarInputOtros = true;
        controlOtros?.setValidators([Validators.required]);
      } else {
        this.mostrarInputOtros = false;
        controlOtros?.clearValidators();
      }
      controlOtros?.updateValueAndValidity();
    });
  }

  get f() { return this.myForm.controls; }

  // ─── MÉTODOS PARA CONSULTA RENIEC ──────────────────────────────
  onDNIInput(event: Event): void {
    const valor = (event.target as HTMLInputElement).value.trim();

    this.dniBuscado = false;
    this.dniEncontrado = null;

    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    // Solo consulta si son exactamente 8 dígitos
    if (!/^[0-9]{8}$/.test(valor)) return;

    this.debounceTimer = setTimeout(() => this.buscarDNI(valor), 500);
  }

  buscarDNI(dni: string): void {
    this.buscandoDNI = true;

    this.http.get<VerificaPeRespuesta>(`${this.API_DNI}/${dni}`).subscribe({
      next: (resp) => {
        this.buscandoDNI = false;
        if (!resp.success || !resp.data) {
          this.dniBuscado = true;
          this.dniEncontrado = false;
          return;
        }
        this.dniBuscado = true;
        this.dniEncontrado = true;

        // Formatear nombres con mayúscula inicial
        const cap = (s: string) => s
          ? s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
          : '';

        this.myForm.patchValue({
          nombre: cap(resp.data.names),
          apellido: [resp.data.paternalSurname, resp.data.maternalSurname]
            .filter(Boolean).map(cap).join(' '),
          fecha_Nacimiento: this.formatDate(resp.data.birthDate),
          nacionalidad: 'Peruana'
        });

        // Marcar los campos como tocados para que se muestren los iconos y validaciones
        ['nombre', 'apellido', 'fecha_Nacimiento'].forEach(c =>
          this.myForm.get(c)?.markAsTouched()
        );
      },
      error: (err) => {
        this.buscandoDNI = false;
        this.dniBuscado = true;
        this.dniEncontrado = false;

        console.error('🔥 ERROR REAL DE LA API:', err);
        console.log('URL que se está llamando:', `${this.API_DNI}/${dni}`);
      }
    });
  }

  // ─── VALIDADORES ─────────────────────────────────────────────────
  validarRangoEdad() {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }

      const fechaNacimiento = new Date(control.value);
      const hoy = new Date();

      if (fechaNacimiento > hoy) {
        return { 'fechaFutura': true };
      }

      let edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
      const mes = hoy.getMonth() - fechaNacimiento.getMonth();
      if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNacimiento.getDate())) {
        edad--;
      }

      if (edad < this.EDAD_MINIMA) {
        return { 'edadMinima': { valor: this.EDAD_MINIMA } };
      }

      if (edad > this.EDAD_MAXIMA) {
        return { 'edadMaxima': { valor: this.EDAD_MAXIMA } };
      }

      return null;
    };
  }

  getMinDate(): string {
    const hoy = new Date();
    const haceXAnos = new Date(hoy.getFullYear() - this.EDAD_MINIMA, hoy.getMonth(), hoy.getDate());
    return haceXAnos.toISOString().split('T')[0];
  }

  getMaxDate(): string {
    const hoy = new Date();
    const hace120Anos = new Date(hoy.getFullYear() - this.EDAD_MAXIMA, hoy.getMonth(), hoy.getDate());
    return hace120Anos.toISOString().split('T')[0];
  }

  // ─── CICLO DE VIDA ───────────────────────────────────────────────
  ngOnInit(): void {
    const nacionalidadActual = this.clientes.nacionalidad;
    if (nacionalidadActual && !['Peruana', 'Venezolana', 'Boliviana', 'Chilena'].includes(nacionalidadActual)) {
      this.mostrarInputOtros = true;
      this.myForm.get('nacionalidad')?.setValue('Otros');
      this.myForm.get('nacionalidadOtros')?.setValue(nacionalidadActual);
    }

    this.myForm.patchValue({
      iD_Cliente: this.clientes.iD_Cliente,
      iD_Usuario: this.clientes.iD_Usuario,
      nombre: this.clientes.nombre,
      apellido: this.clientes.apellido,
      correo: this.clientes.correo,
      telefono: this.clientes.telefono,
      direccion: this.clientes.direccion,
      fecha_Nacimiento: this.formatDate(this.clientes.fecha_Nacimiento),
      nacionalidad: this.clientes.nacionalidad || 'Peruana',
      pasaporte: this.clientes.pasaporte,
      frecuencia_Viajero: this.clientes.frecuencia_Viajero || 'Media'
    });
  }

  // ─── UTILIDADES DE FECHA ─────────────────────────────────────────
  /** "DD/MM/YYYY" → "YYYY-MM-DD" (para el input date) */
  formatDate(dateString: string): string {
    if (!dateString) return '';
    const dateParts = dateString.split('/');
    if (dateParts.length !== 3) return '';
    const [day, month, year] = dateParts;
    return `${year}-${month}-${day}`;
  }

  /** "YYYY-MM-DD" → "DD/MM/YYYY" (para el servidor) */
  formatDateForServer(dateString: string): string {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  }

  // ─── MODAL ───────────────────────────────────────────────────────
  closeModal(res: boolean) {
    this.closeModalEmmit.emit(res);
  }

  private async clienteYaExiste(correo: string | null | undefined, dni: string | null | undefined, idActual: number): Promise<boolean> {
    try {
      // Obtener todos los clientes (idealmente debería ser un servicio con filtro, pero asumimos que getAll devuelve todos)
      const lista = await firstValueFrom(this._clientesService.getAll());

      // Normalizar valores
      const correoNormalizado = correo?.trim().toLowerCase() || '';
      const dniNormalizado = dni?.trim() || '';

      // Si ambos están vacíos, no hay duplicado posible
      if (!correoNormalizado && !dniNormalizado) return false;

      // Buscar coincidencia
      return lista.some(cliente => {
        // Saltar el mismo registro en edición
        if (idActual !== 0 && cliente.iD_Cliente === idActual) return false;

        const correoCliente = cliente.correo?.trim().toLowerCase() || '';
        const dniCliente = cliente.pasaporte?.trim() || '';

        // Comparar solo si los campos no están vacíos
        const mismoCorreo = correoNormalizado && correoCliente === correoNormalizado;
        const mismoDni = dniNormalizado && dniCliente === dniNormalizado;

        return mismoCorreo || mismoDni;
      });
    } catch (error) {
      console.error('Error al verificar duplicados:', error);
      // En caso de error, permitimos el guardado (o podrías lanzar una excepción)
      return false;
    }
  }

  // ─── GUARDAR ─────────────────────────────────────────────────────
  async save() {
    // 1. Validar formulario
    if (this.myForm.invalid) {
      Swal.fire({
        position: 'center',
        icon: 'warning',
        title: 'Formulario inválido',
        text: 'Por favor, completa todos los campos correctamente',
        showConfirmButton: true
      });
      return;
    }

    // 2. Obtener valores del formulario
    const formValues = this.myForm.getRawValue();
    const correo = formValues.correo?.trim();
    const dni = formValues.pasaporte?.trim();
    const idActual = formValues.iD_Cliente || 0; // 0 para nuevo, >0 para edición

    // 3. Verificar duplicados (si hay correo o DNI)
    if (correo || dni) {
      const existe = await this.clienteYaExiste(correo, dni, idActual);
      if (existe) {
        Swal.fire({
          position: 'center',
          icon: 'error',
          title: 'Cliente ya registrado',
          text: 'Ya existe un cliente con este correo o DNI en el sistema.',
          confirmButtonText: 'Aceptar'
        });
        return;
      }
    }

    // 4. Preparar objeto cliente (incluyendo nacionalidad "Otros")
    let clienteData = { ...formValues };

    if (clienteData.nacionalidad === 'Otros') {
      clienteData.nacionalidad = this.myForm.get('nacionalidadOtros')?.value || 'Otros';
    }

    // 5. Formatear fecha para el servidor (DD/MM/YYYY)
    clienteData.fecha_Nacimiento = this.formatDateForServer(clienteData.fecha_Nacimiento);

    // 6. Asignar usuario autenticado (solo para nuevo)
    if (idActual === 0) {
      const authenticatedUser = this._sesionService.getUser();
      if (authenticatedUser) {
        clienteData.iD_Usuario = authenticatedUser.iD_Usuario;
      } else {
        Swal.fire({
          position: 'center',
          icon: 'error',
          title: 'Usuario no autenticado',
          showConfirmButton: false,
          timer: 1650
        });
        return;
      }
    }

    // 7. Guardar o actualizar
    this.clientes = clienteData; // actualizar el modelo local

    if (idActual === 0) {
      this.createClientes(clienteData);
    } else {
      this.updateClientes(clienteData);
    }
  }

  createClientes(cliente: any) {
    this._clientesService.create(cliente).subscribe(
      (data: ClienteModel) => {
        Swal.fire({
          position: 'center',
          icon: 'success',
          title: 'Registro creado de forma satisfactoria',
          showConfirmButton: false,
          timer: 1650
        });
        this.closeModalEmmit.emit(true);
      },
      err => {
        console.error('Error creating client:', err);
        Swal.fire({
          position: 'center',
          icon: 'error',
          title: 'Error al crear el registro',
          showConfirmButton: false,
          timer: 1650
        });
        this.closeModalEmmit.emit(false);
      }
    );
  }

  updateClientes(cliente: any) {
    this._clientesService.update(cliente).subscribe(
      (data: ClienteModel) => {
        Swal.fire({
          position: 'center',
          icon: 'success',
          title: 'Registro actualizado de forma satisfactoria',
          showConfirmButton: false,
          timer: 1650
        });
        this.closeModalEmmit.emit(true);
      },
      err => {
        console.error('Error updating client:', err);
        Swal.fire({
          position: 'center',
          icon: 'error',
          title: 'Error al actualizar el registro',
          showConfirmButton: false,
          timer: 1650
        });
        this.closeModalEmmit.emit(false);
      }
    );
  }
}