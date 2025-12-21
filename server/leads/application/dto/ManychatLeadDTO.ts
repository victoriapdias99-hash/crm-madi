export interface ManychatLeadDTO {
  fecha: string;                        /*Fecha completa del registro*/
  nombre: string;                      /* Nombre de la persona */
  telefono: string;                   /* Teléfono en formato internacional */
  localidad: string;                 /* Localidad / ciudad */
  modelo: string;                   /* Modelo o mensaje inicial  */
  horarioComentarios: string;      /* Horario / Comentarios libres del usuario */
  origen: string;                 /* Origen del lead */
  localizacion: string;          /* Localización macro */
  cliente: string;              /* Nombre del cliente */
}
