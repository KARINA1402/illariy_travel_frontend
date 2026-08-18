import { HttpClient, HttpHeaders } from '@angular/common/http';
import { HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { const_uri } from '../constantes/const_uri';
import { ReservasModel } from '../models/reservas.model';
import { SesionService } from './sesion.service';

@Injectable({
  providedIn: 'root'
})
export class ReservasService {

  url = const_uri.mant_reserva;
  constructor(
    private _http: HttpClient,
    private _sesionservice: SesionService
  ) { }

  getAll(cantidad: number = 10): Observable<ReservasModel[]> {
    const params = new HttpParams().set('cantidad', cantidad.toString());
    return this._http.get<ReservasModel[]>(this.url, { params });
  }

  create(reservas: ReservasModel): Observable<ReservasModel> {
    return this._http.post<ReservasModel>(this.url, reservas);
  }

  confirmarReserva(reservaData: any): Observable<any> {
    const endpoint = `${this.url}confirmar`;
    return this._http.post(endpoint, reservaData);
  }

  update(reservas: ReservasModel): Observable<ReservasModel> {
    return this._http.put<ReservasModel>(this.url, reservas)
  }


  delete(id: number): Observable<number> {
    return this._http.delete<number>(`${this.url}${id}`);
  }

  getById(id:number){
    return this._http.get<ReservasModel[]>(`${this.url}${id}`);
  }


}