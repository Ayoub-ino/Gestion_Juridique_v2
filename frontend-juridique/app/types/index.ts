// app/types/index.ts

export type Langue = "fr" | "ar";

export type VueActive =
  | "dashboard"
  | "mes-entites"
  | "mes-dossiers-en-cours"
  | "transactions"
  | "archives"
  | "recherche-dossiers"
  | "entrant-admin"
  | "entrant-juridique"
  | "sortant-normal"
  | "admin-utilisateurs"
  | "admin-services"
  | "admin-services-historiques"
  | "admin-permissions"
  | "admin-equipements"
  | "notifications"
  | "profil";

export interface CourrierSimule {
  id: number;
  reference: string;
  objet: string;
  type: VueActive;
  date: string;
  dateRaw?: string;
  source: string;
  serviceActuel: string;
  serviceActuelKey?: string;
  /** Dynamic RBAC service code of the service currently holding the document. */
  serviceActuelCode?: string;
  statut: string;
  filePath?: string;
  description?: string;
  destinataireExterne?: string;
  dateEnvoi?: string;
  typeSortant?: string;
  tribunalOrigine?: string;
  tribunalDestination?: string;
  transmissible?: string;
  targetUserId?: number;
}

export interface LocalRetrait {
  id: number;
  reference: string;
  objet: string;
  date: string;
  responsable: string;
  statut: string;
}

export interface RbacService {
  id: number;
  nom: string;
  code: string;
  description?: string;
  parentId?: number;
  parentNom?: string;
  userCount?: number;
}

export interface Permission {
  id: number;
  key: string;
  labelFr: string;
  labelAr: string;
  description?: string;
  category: string;
  defaultEnabled: boolean;
}

export interface ServicePermission {
  key: string;
  labelFr: string;
  labelAr: string;
  description?: string;
  category: string;
  enabled: boolean;
}

export interface EquipmentItem {
  id: number;
  serial: string;
  /** Code of a row in the "types_equipement" managed list. */
  type: string;
  /** Code of a row in the "etats_equipement" managed list. */
  etat: string;
  service: string;
  estCharge: boolean;
  dateDechargement?: string;
  /** Informations supplémentaires — optional free text. */
  additionalInfo?: string;
}

export interface UserItem {
  id: number;
  login: string;
  nom: string;
  password?: string;
  role: string;
  service: string;
  serviceId?: number;
  serviceNom?: string;
  serviceCode?: string;
  substituteUserId?: number;
  deletedAt?: string | null;
}