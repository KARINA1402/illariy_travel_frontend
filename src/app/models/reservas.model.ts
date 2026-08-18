import { PaqueteModel } from "./paquete.model";


export class ReservasModel {
    iD_Usuario: number;
    paqueteIds: number[];


    //Datos Reserva
    iD_Reserva: number;
    iD_Cliente: number;
    iD_Paquete: number;
    fecha_Reserva: string;
    numero_Personas: number;
    precio_Total: number;
    estatus: string;
    observaciones: string;

    //Datos paquete
    paquete?: PaqueteModel;
    numero_Transaccion?: string;

    // status: StatusModel;
    constructor() {
        this.iD_Usuario = 0;
        this.paqueteIds = [];

        //Datos Reserva
        this.iD_Reserva = 0;
        this.iD_Cliente = 0;
        this.iD_Paquete = 0;
        this.fecha_Reserva = '';
        this.numero_Personas = 0;
        this.precio_Total = 0;
        this.estatus = '';
        this.observaciones = '';

        //Paquete
        this.paquete = new PaqueteModel();
    }
}