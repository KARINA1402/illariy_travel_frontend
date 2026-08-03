import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SesionService } from 'src/app/service/sesion.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-sidenav',
  templateUrl: './sidenav.component.html',
  styleUrls: ['./sidenav.component.css']
})
export class SidenavComponent implements OnInit {
  usuario: any = {};
  constructor( 
    private _sesionSevice: SesionService,
    private _router: Router) { }

  ngOnInit(): void {
    this.obtenerUsuario();
  }
  obtenerUsuario() {
    this.usuario = this._sesionSevice.getUser();
  }

  logout() {
    Swal.fire({
      title: '¿Estás seguro de que deseas cerrar sesión?',
      icon: 'info',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, cerrar sesión',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.value) {
        // Aquí puedes colocar la lógica para cerrar sesión
        this._router.navigate(['']);
      }
    });
  }
  
   
}
