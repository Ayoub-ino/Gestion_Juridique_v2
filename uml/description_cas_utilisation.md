# Description des Cas d'Utilisation - Gestion Juridique

## Diagramme de Cas d'Utilisation

Le diagramme de cas d'Utilisation modélise les interactions entre les acteurs du système et les fonctionnalités proposées par l'application de gestion des dossiers judiciaires de la Cour d'Appel Administrative de Fès.

---

## 1. Acteurs du Système

### 1.1 Acteurs Principaux

| Acteur | Rôle | Description |
|--------|------|-------------|
| **Administrateur** | Rôle `Admin` | Gestionnaire du système. Bypass ACL. Contrôle total sur les utilisateurs, services, permissions et équipements. |
| **Agent Bureau d'Ordre** | Service `bureauordre` | Réceptionne les courriers, crée les entrants administratifs et sortants, effectue les transferts initiaux. |
| **Agent Ouverture des Dossiers** | Service `fathmilafat` | Ouvre les dossiers juridiques et initie le circuit de traitement judiciaire. |
| **Agent Secrétariat** | Service `secretarait` | Assure le secrétariat particulier, gère les courriers sortants. |
| **Agent Séances & Procédures** | Service `seances&procedures` | Gère les audiences, avance/recule les étapes du circuit juridique. |
| **Agent Expertise** | Service `khibra` | Gère l'expertise judiciaire et les avis d'experts. |
| **Agent Délivrance des Copies** | Service `taslimnosakh` | Délivre les copies de jugements et arrêts. |
| **Agent Règlement des Dépens** | Service `tasfiatSawa2irTakmilia` | Traite la taxations et règlement des dépens. |
| **Agent Archive** | Service `archive` | Gère l'archivage définitif, la corbeille, les retraits. |
| **Agent Notification** | Service `atabligh` | Assure la signification et notification des actes. |

### 1.2 Acteurs Secondaires (bypass ACL)

| Acteur | Rôle | Description |
|--------|------|-------------|
| **Greffier** | Rôle `Greffier` | Contourne l'ACL, accès complet en lecture/écriture sur tous les documents. |
| **Directeur** | Rôle `Directeur` | Contourne l'ACL, supervision générale. |
| **Consultant** | Rôle `Consultant` | Contourne l'ACL, consultation libre. |

---

## 2. Cas d'Utilisation par Sous-Système

### 2.1 Authentification & Profil

| Cas d'Utilisation | Acteurs | Description |
|-------------------|---------|-------------|
| **S'authentifier** | Tous | Connexion via login/mot de passe. Génération d'un token JWT contenant les permissions de l'utilisateur. Hachage BCrypt des mots de passe. |
| **Consulter son profil** | Tous | Affichage des informations personnelles, service rattaché, gestion des substituts. |

### 2.2 Tableau de Bord

| Cas d'Utilisation | Acteurs | Description |
|-------------------|---------|-------------|
| **Consulter le tableau de bord** | Tous | Vue d'ensemble : progression du workflow, statistiques (total, en attente, acceptés, refusés), activité récente, charge par service, documents à retourner. |

### 2.3 Gestion des Documents

| Cas d'Utilisation | Acteurs | Description |
|-------------------|---------|-------------|
| **Créer un courrier administratif** | BO | Création d'un courrier entrant avec 3 modes : archivage direct, transfert unique, diffusion multiple. Pièces jointes intégrées. |
| **Créer un dossier juridique** | OD | Création d'un dossier juridique avec circuits classique ou exception (islah, mousaada, ikhtissas). Auto-transfert vers Ouverture des Dossiers. |
| **Créer un courrier sortant** | BO, Sec | Création de courriers sortants (normal ou demande) avec workflow Brouillon → En attente → Envoyé/Annulé. |
| **Modifier un document** | BO, OD | Modification des champs d'un document. Soumis au contrôle de garde (custody) : seul le service détenteur peut modifier. |
| **Supprimer un document** | BO, Arch | Suppression logique (soft delete). Le document est déplacé vers la corbeille avant suppression définitive. |
| **Consulter les détails** | Tous | Affichage complet d'un document : métadonnées, historique des transferts, notes, pièces jointes. |
| **Télécharger un fichier** | Tous (permission requise) | Téléchargement sécurisé des pièces jointes avec contrôle ETag. |
| **Importer via Excel** | BO, OD | Import en masse depuis un fichier Excel avec mapping colonnes-champs. |

### 2.4 Transfert & Circuit Juridique

| Cas d'Utilisation | Acteurs | Description |
|-------------------|---------|-------------|
| **Transférer un document** | Tous (selon permission) | Transfert vers un ou plusieurs services. Routage multi-utilisateur, support services historiques, drapeau « doit revenir ». Seul le service détenteur peut transférer. |
| **Transférer un dossier juridique** | OD, Seance, Expert, Taslim, Tasfiya, Arch, Tabligh | Déplacement dans le circuit judiciaire : Jalsat ↔ Sous-services, Taslim → Tabligh/Tasfiya/Archive, Archive → Retrait. |
| **Avancer l'étape juridique** | Seance, Expert | Passage à l'étape suivante du circuit (ex: Jalsat → Ijra2Baht). |
| **Reculer l'étape juridique** | Seance, Expert | Retour à l'étape précédente du circuit. |

### 2.5 Transactions & Notifications

| Cas d'Utilisation | Acteurs | Description |
|-------------------|---------|-------------|
| **Accepter un transfert** | Tous (selon permission) | Réception et validation d'un transfert entrant. Le document passe en statut « Accepté ». |
| **Refuser un transfert** | Tous (selon permission) | Refus d'un transfert avec commentaire. Possibilité de marquer « doit revenir ». |
| **Annuler un transfert** | Tous (selon permission) | Annulation d'un transfert en attente par l'expéditeur. |
| **Consulter les transactions** | Tous | Registre des transferts : en attente, acceptés, refusés, envoyés. Statistiques par service. |
| **Recevoir des notifications** | Tous | Notifications temps réel (rafraîchissement 30s) pour les transferts en attente. |

### 2.6 Recherche & Export

| Cas d'Utilisation | Acteurs | Description |
|-------------------|---------|-------------|
| **Recherche avancée** | Tous (selon permission) | Recherche multi-critères : texte, service, type, plage de dates. Recherche locale dans les fichiers (PDF/DOC/XLSX). |
| **Exporter en Excel** | Tous (selon permission) | Export des résultats de recherche ou de la liste courante au format Excel/CSV. |
| **Exporter en Word** | Tous (selon permission) | Export au format Word. |

### 2.7 Espace de Travail

| Cas d'Utilisation | Acteurs | Description |
|-------------------|---------|-------------|
| **Ouvrir l'espace de travail** | BO, OD, Sec, Seance, Expert | Vue détaillée d'un document avec édition, notes, ACL et historique des modifications. |
| **Ajouter des notes** | BO, OD (selon permission) | Annotations libres sur un document. Notes éditables et supprimables. |
| **Consulter l'historique** | BO, OD (selon permission) | Piste d'audit complète : qui a modifié quoi et quand. |
| **Gérer les accès ACL** | Admin (selon permission) | Attribution des niveaux d'accès par service : Owner (propriétaire), Editor (éditeur), Viewer (lecteur). |

### 2.8 Mes Entités

| Cas d'Utilisation | Acteurs | Description |
|-------------------|---------|-------------|
| **Consulter mes entités** | Tous | Liste des documents reçus par le service de l'utilisateur. Actions par lots : transfert, archivage, suppression. |
| **Consulter mes dossiers en cours** | BO, OD | Documents actuellement détenus par le service. Filtre par volume. |

### 2.9 Archives

| Cas d'Utilisation | Acteurs | Description |
|-------------------|---------|-------------|
| **Consulter les archives** | Arch (selon permission) | Liste des documents archivés et de la corbeille. |
| **Archiver un document** | Arch (selon permission) | Archivage définitif d'un document. |
| **Restaurer un document** | Arch (selon permission) | Récupération depuis la corbeille. Extension du cas « Supprimer ». |
| **Supprimer définitivement** | Arch (selon permission) | Suppression irréversible (fichier + transactions). |
| **Enregistrer un retrait** | Arch (selon permission) | Enregistrement du retrait physique d'un document archivé. Suivi du retour. |

### 2.10 Administration RBAC

| Cas d'Utilisation | Acteurs | Description |
|-------------------|---------|-------------|
| **Gérer les utilisateurs** | Admin | CRUD complet : création, modification, désactivation, restauration, suppression. Affectation à un service. |
| **Gérer les services RBAC** | Admin | Création/modification des services avec hiérarchie parent-enfant. Initialisation automatique des permissions par défaut. |
| **Gérer les permissions** | Admin | Matrice permissions × services. Override spécifique pour l'Administrateur (20 permissions désactivées par défaut). |
| **Gérer les équipements** | Admin | Inventaire des équipements : numéro de série, code, type, état, bascule de charge. |
| **Gérer les listes dynamiques** | Admin | Valeurs des menus déroulants : sources, états, etc. Bilingue FR/AR. |
| **Gérer les substituts** | Admin | Désignation de remplaçants temporaires pour un utilisateur absent. |

---

## 3. Relations entre Cas d'Utilisation

### 3.1 Relations `<<include>>`

| Cas de base | Cas inclus | Description |
|-------------|------------|-------------|
| Créer courrier admin | Transferer | Tout courrier créé (mode unique/diffusion) déclenche un transfert automatique. |
| Créer dossier juridique | Transferer juridique | Tout dossier juridique est auto-transféré vers Ouverture des Dossiers. |
| Archiver | Consulter les archives | L'archivage nécessite l'accès à la vue archives. |
| Supprimer définitivement | Consulter les archives | La suppression définitive se fait depuis la vue archives/corbeille. |
| Retrait archive | Consulter les archives | Le retrait est enregistré depuis la vue archives. |
| Télécharger | Consulter détails | Le téléchargement nécessite l'accès au détail du document. |
| Ajouter notes | Espace de travail | Les notes sont ajoutées depuis l'espace de travail. |
| Historique | Espace de travail | L'historique est consulté depuis l'espace de travail. |
| ACL | Espace de travail | La gestion des accès se fait depuis l'espace de travail. |

### 3.2 Relations `<<extend>>`

| Cas d'extension | Cas de base | Description |
|-----------------|-------------|-------------|
| Restaurer | Supprimer | La restauration étend la suppression logique (depuis la corbeille). |
| Annuler transfert | Transferer | L'annulation étend le transfert (uniquement pour les transferts en attente). |

### 3.3 Héritage d'Acteurs

```
Administrateur
├── Greffier    (bypass ACL)
├── Directeur   (bypass ACL)
└── Consultant  (bypass ACL)
```

Les acteurs Greffier, Directeur et Consultant héritent des permissions de l'Administrateur et contournent les contrôles d'accès basés sur les documents (ACL) et de garde (custody).

---

## 4. Diagramme

Le diagramme de cas d'utilisation est disponible aux formats suivants :

- **PlantUML** : `uml/diagramme_cas_utilisation.puml` (version complète)
- **PlantUML simplifié** : `uml/diagramme_cas_utilisation_simplifie.puml` (version allégée pour le rapport)

Pour générer l'image, utiliser :
- L'extension PlantUML dans VS Code
- Le serveur en ligne : https://www.plantuml.com/plantuml/
- La ligne de commande : `plantuml uml/diagramme_cas_utilisation.puml`
