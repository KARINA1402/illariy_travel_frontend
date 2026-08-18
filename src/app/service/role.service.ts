import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { Observable } from 'rxjs';
import { RoleModel } from '../models/role.model';

@Injectable({
  providedIn: 'root'
})
export class RoleService {

  urlback = "https://illary.bsite.net/api/role/";

  constructor(
    private http: HttpClient
  ) { }

  /** TRAE LA LISTA DE ROLES */
  getAll(): Observable<RoleModel[]> {
    return this.http.get<RoleModel[]>(`${this.urlback}`);
  }


  delete(id: number): Observable<number> {
    return this.http.delete<number>(`${this.urlback}${id}`);
  }

  create(obj: RoleModel): Observable<RoleModel> {
    return this.http.post<RoleModel>(this.urlback, obj);
  }

  update(obj: RoleModel): Observable<RoleModel> {
    return this.http.put<RoleModel>(this.urlback, obj);
  }

}
