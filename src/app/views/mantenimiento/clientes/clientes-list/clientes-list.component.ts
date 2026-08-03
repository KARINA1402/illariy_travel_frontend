import { Component, OnInit,TemplateRef } from '@angular/core';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import {  ClienteModel } from 'src/app/models/clientes.model';
import { ClientesService } from 'src/app/service/clientes.service';
import Swal from 'sweetalert2';


@Component({
  selector: 'app-clientes-list',
  templateUrl: './clientes-list.component.html',
  styleUrls: ['./clientes-list.component.css']
})
export class ClientesListComponent implements OnInit {
  modalRef?: BsModalRef;
  clientes:ClienteModel[] = [];
  clientesSelected:ClienteModel = new ClienteModel();
  tituloModal:string = "";
  filtro='';
  page = 1;
  cantidadRegistros: number = 10;
  constructor(
    private _clientesService:ClientesService,
    private modalService: BsModalService
  ) { }

  ngOnInit(): void {
    this.getAllClientes(this.cantidadRegistros); // Pasa la cantidad de registros como argumento
  }  
  
  getAllClientes(cantidad: number) {
    this._clientesService.getAll(cantidad).subscribe(
      (data: ClienteModel[]) => {
        this.clientes = data;
        console.log(data);
      },
      err => {
        console.log(err);
      }
    );
  }
    

  editarRegistro(clientes:ClienteModel,template: TemplateRef<any>)
  {
    this.tituloModal="EDITAR REGISTRO";
    this.clientesSelected = clientes;
    this.openModal(template);
  }

  crearRegistro(template: TemplateRef<any>)
  {
    this.tituloModal="CREAR REGISTRO";
    this.clientesSelected = new ClienteModel();
    this.openModal(template);
  }

  openModal(template: TemplateRef<any>) {
    this.modalRef = this.modalService.show(template, {
      ignoreBackdropClick: true,
    });
  }


  recibeCloseModal(res:boolean)
  {
    if(res) //==> si es verdadero
    {
      this.getAllClientes(this.cantidadRegistros);     
    }
    this.modalRef?.hide();
  }


  modalDelete(clientes:ClienteModel)
  {

    let res= Swal.fire({
      title: '¿Está seguro de eliminar el registro?',
      text: "¡No podrás revertir esto!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Si, bórralo!'
    }).then((result) => {
      if (result.isConfirmed) {
        this._clientesService.delete(clientes.iD_Cliente).subscribe(
            (data:number)=>{
            console.log(data);
        Swal.fire(
          'Eliminado!',
          'registro eliminado de forma satisfactoría.',
          'success'
        )
        this.getAllClientes(this.cantidadRegistros);
        });
        
      }
    })
    // let res = confirm("Está seguro de eliminar el registro");

    // if(res) // si es verdadero
    // {
    //   this._clientesService.delete(clientes.idCliente).subscribe(
    //     (data:number)=>{
    //       console.log(data);
    //       alert("registro eliminado de forma satisfactoría");
    //       this.getAllClientes();
    //     },
    //     err =>{
    //       //alert("ocurrio un error");
    //     }
    //   );
    // }
  }

  // ...
  onRegistrosChange() {
    this.page = 1; // Reinicia la página actual a 0
    this.getAllClientes(this.cantidadRegistros); // Actualiza la lista de clientes según la cantidad seleccionada
  }
  // ...
}