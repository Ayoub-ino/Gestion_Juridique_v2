# Description Détaillée des Cas d'Utilisation
## Projet : Gestion Juridique — Cour d'Appel Administrative de Fès
### Auteurs : Ayoub AGROUKH & Ikrame OUDGHIRI

---

## Table des matières
1. [UC-01 à UC-03 : Authentification & Profil](#uc-01)
2. [UC-04 à UC-11 : Gestion des Documents](#uc-04)
3. [UC-12 à UC-17 : Transfert & Circuit Juridique](#uc-12)
4. [UC-18 à UC-22 : Transactions & Notifications](#uc-18)
5. [UC-23 à UC-25 : Recherche & Export](#uc-23)
6. [UC-26 à UC-28 : Espace de Travail](#uc-26)
7. [UC-29 à UC-30 : Mes Entités](#uc-29)
8. [UC-31 à UC-36 : Archives & Corbeille](#uc-31)
9. [UC-37 à UC-43 : Administration RBAC](#uc-37)

---

<a id="uc-01"></a>
## 1. Authentification & Profil

### UC-01 : S'authentifier
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-01 |
| **Nom** | S'authentifier |
| **Acteurs** | Tous les utilisateurs |
| **Permission requise** | Aucune (endpoint public) |
| **Pré-condition** | L'utilisateur possède un compte actif dans le système |
| **Post-condition** | L'utilisateur reçoit un token JWT + ses permissions |
| **Fréquence** | À chaque session |

**Scénario principal :**
1. L'utilisateur saisit son identifiant (login) et mot de passe
2. Le frontend envoie `POST /api/Auth/login` avec `{Login, Password}`
3. Le backend recherche l'utilisateur dans la base de données
4. Vérifie le mot de passe avec `BCrypt.Net.BCrypt.Verify()`
5. Charge le service de l'utilisateur et ses permissions activées
6. Génère un token JWT (durée 8h, ClockSkew = TimeSpan.Zero)
7. Retourne `{token, user: {id, nom, login, service, role, permissions}}`
8. Le frontend stocke le token et redirige vers le tableau de bord

**Scénario alternatif A1 :** Identifiants invalides → 401 "identifiants invalides" (message générique, ne révèle pas quel champ est incorrect)

**Scénario alternatif A2 :** Utilisateur archivé (IsActive = false) → 401 "Compte désactivé"

**Scénario alternatif A3 :** Erreur serveur → 500

---

### UC-02 : Consulter son profil
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-02 |
| **Nom** | Consulter son profil |
| **Acteurs** | Tous les utilisateurs |
| **Permission requise** | `profil` (autres) |
| **Pré-condition** | Utilisateur authentifié |
| **Post-condition** | Affichage des informations de profil |

**Scénario principal :**
1. L'utilisateur clique sur "Mon profil"
2. Le frontend appelle `GET /api/auth/me`
3. Le backend retourne les informations de l'utilisateur courant
4. Affichage du profil : nom, login, service, rôle, permissions activées

---

### UC-03 : Consulter le tableau de bord
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-03 |
| **Nom** | Consulter le tableau de bord |
| **Acteurs** | Tous les utilisateurs |
| **Permission requise** | `dashboard` (autres) |
| **Pré-condition** | Utilisateur authentifié |
| **Post-condition** | Affichage des statistiques |

**Scénario principal :**
1. L'utilisateur accède au tableau de bord
2. Le frontend affiche :
   - Pour les agents : nombre de documents par service, volume de travail, activité récente
   - Pour l'admin : vue globale des services, nombre de dossiers par service
3. Les données sont récupérées via `GET /api/Transactions/stats-by-service`

**Note :** Les utilisateurs admin-like (Admin, Greffier, Directeur, Consultant) voient un dashboard restreint sans notifications opérationnelles.

---

<a id="uc-04"></a>
## 2. Gestion des Documents

### UC-04 : Créer un courrier administratif
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-04 |
| **Nom** | Créer un courrier administratif |
| **Acteurs** | Agent Bureau d'ordre |
| **Permission requise** | `creer_courrier_admin` (documents) |
| **Pré-condition** | Utilisateur authentifié avec permission activée |
| **Post-condition** | Le courrier est créé et le service actuel est "Bureau d'ordre" |

**Scénario principal :**
1. L'agent clique sur "Ajouter" dans la section Courriers Administratifs
2. Remplit le formulaire : numéro d'ordre, expéditeur, objet, date de réception, type de circuit
3. Joign éventuellement un fichier (PDF/Word/Excel)
4. Le frontend envoie `POST /api/CourrierAdmin` avec le DTO complet
5. Le middleware vérifie `creer_courrier_admin` pour le service de l'utilisateur
6. Le backend crée le document avec `ServiceActuel = BureauOrdre`
7. Le document apparaît dans la liste "Mes entités"

**Scénario alternatif A1 :** Numéro d'ordre déjà existant → 400 "Ce numéro d'ordre existe déjà"

**Scénario alternatif A2 :** Permission désactivée → 403 "Permission 'creer_courrier_admin' not granted"

**Scénario alternatif A3 :** Import Excel → `POST /api/CourrierAdmin/import-excel` avec mapping de colonnes

---

### UC-05 : Créer un dossier juridique
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-05 |
| **Nom** | Créer un dossier juridique |
| **Acteurs** | Agent Ouverture des dossiers |
| **Permission requise** | `creer_courrier_juridique` (documents) |
| **Pré-condition** | Utilisateur authentifié avec permission activée |
| **Post-condition** | Le dossier juridique est créé avec un circuit (classique/exception) |

**Scénario principal :**
1. L'agent sélectionne "Créer un dossier juridique"
2. Remplit : numéro de dossier, demandeur, type de circuit (classique/exception)
3. Si circuit exception : choisir le motif (islah, mousaada, ikhtissas)
4. Le frontend envoie `POST /api/CourrierJuridique`
5. Le backend crée le DossierJuridique avec `EtapeService = 1` (ouverture)
6. Le document suit le circuit judiciaire en 6 étapes

**Scénario alternatif A1 :** Circuit classique → le document suit le circuit standard
**Scénario alternatif A2 :** Circuit exception → des étapes supplémentaires sont ajoutées

---

### UC-06 : Créer/Modifier un courrier sortant
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-06 |
| **Nom** | Créer/Modifier un courrier sortant |
| **Acteurs** | Agent Bureau d'ordre, Agent Secrétariat |
| **Permission requise** | `creer_modifier` (documents) |
| **Pré-condition** | Utilisateur authentifié avec permission activée |
| **Post-condition** | Le courrier sortant est créé/modifié |

**Scénario principal :**
1. L'agent crée un courrier sortant (normal ou demande/réclamation)
2. Remplit : destinataire externe, date d'envoi, tribunal origine/destination
3. Le frontend envoie `POST /api/CourrierSortant`
4. Le backend crée le document
5. L'agent peut modifier le statut (brouillon → en attente → envoyé)

---

### UC-07 : Modifier un document
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-07 |
| **Nom** | Modifier un document |
| **Acteurs** | Agent Bureau d'ordre, Agent Ouverture des dossiers |
| **Permission requise** | `creer_modifier` (documents) + **custody check** |
| **Pré-condition** | L'utilisateur est le détenteur actuel du document (ServiceActuel == son service) |
| **Post-condition** | Le document est mis à jour |

**Scénario principal :**
1. L'agent clique sur "Modifier" d'un document qu'il détient
2. Modifie les champs souhaités
3. Le frontend envoie `PUT /api/CourrierAdmin/{id}` (ou similaire selon le type)
4. Le backend vérifie la permission `creer_modifier`
5. Le middleware vérifie que l'utilisateur est le détenteur (custody check via `DocumentAccessService.IsUserCustodian`)
6. Le document est mis à jour

**Scénario alternatif A1 :** L'utilisateur n'est pas le détenteur → 403 "Vous n'êtes pas le détenteur actuel de ce document"

---

### UC-08 : Supprimer un document (soft delete)
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-08 |
| **Nom** | Supprimer un document |
| **Acteurs** | Agent Bureau d'ordre, Agent Archive |
| **Permission requise** | `supprimer` (documents) + **custody check** |
| **Pré-condition** | L'utilisateur est le détenteur actuel |
| **Post-condition** | Le document est marqué EstSupprime = true (soft delete) |

**Scénario principal :**
1. L'agent clique sur "Supprimer" d'un document
2. Confirmation demandée
3. Le frontend envoie `PATCH /api/Documents/{id}/supprimer`
4. Le backend vérifie la permission `supprimer` + custody
5. Le document est marqué `EstSupprime = true` (passe dans la corbeille)

**Note :** La suppression définitive (hard delete) est réservée au service Archive via UC-34.

---

### UC-09 : Consulter les détails d'un document
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-09 |
| **Nom** | Consulter les détails |
| **Acteurs** | Tous les agents de service |
| **Permission requise** | `consulter` (documents) |
| **Pré-condition** | Utilisateur authentifié |
| **Post-condition** | Affichage des détails complets du document |

---

### UC-10 : Télécharger un fichier
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-10 |
| **Nom** | Télécharger un fichier |
| **Acteurs** | Tous les agents de service |
| **Permission requise** | `telecharger_fichiers` (autres) |
| **Pré-condition** | Le document a un fichier joint |
| **Post-condition** | Le fichier est téléchargé |

---

### UC-11 : Importer des documents via Excel
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-11 |
| **Nom** | Importer des documents via Excel |
| **Acteurs** | Agent Bureau d'ordre, Agent Ouverture des dossiers |
| **Permission requise** | `creer_courrier_admin` ou `creer_courrier_juridique` |
| **Pré-condition** | Fichier Excel avec structure correcte |
| **Post-condition** | Les documents sont importés en masse |

---

<a id="uc-12"></a>
## 3. Transfert & Circuit Juridique

### UC-12 : Transférer un document
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-12 |
| **Nom** | Transférer un document |
| **Acteurs** | Tous les agents de service (sauf Archive/Tabligh pour transfert standard) |
| **Permission requise** | `transferer` (documents) + **custody check** |
| **Pré-condition** | L'utilisateur est le détenteur actuel du document |
| **Post-condition** | Une ou plusieurs transactions sont créées, le document change de service |

**Scénario principal (transfert unique) :**
1. L'agent sélectionne un document et clique sur "Transférer"
2. Choisit le mode : **Transaction Unique** (un service) ou **En Diffusion** (plusieurs services)
3. Sélectionne le service destinataire et optionnellement un ou plusieurs utilisateurs cibles
4. Ajoute un commentaire/message
5. Le frontend envoie `POST /api/Transfer` avec `{documentId, documentType, serviceDestination, targetUserIds[], message, doitRevenir}`
6. Le middleware vérifie `transferer` + custody
7. Pour chaque destinataire : une `Transaction` est créée avec `Statut = EnAttente`
8. Le `ServiceActuel` du document est mis à jour
9. Des `DocumentAccess` sont créés pour les services émetteur et destinataire (ACL)
10. Les destinataires reçoivent une notification

**Scénario alternatif A1 :** Mode diffusion → transactions multiples pour plusieurs services
**Scénario alternatif A2 :** Service historique → la transaction est auto-acceptée (pas de login possible)
**Scénario alternatif A3 :** `targetUserIds` avec plusieurs IDs → une transaction par utilisateur
**Scénario alternatif A4 :** L'utilisateur n'est pas le détenteur → 403

---

### UC-13 : Transférer un dossier judiciaire (circuit)
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-13 |
| **Nom** | Transférer un dossier judiciaire |
| **Acteurs** | Agent Ouverture, Séances, Expertise, Délivrance, Règlement, Archive, Notification |
| **Permission requise** | `transferer_juridique` (juridique) |
| **Pré-condition** | Le document est un DossierJuridique |
| **Post-condition** | Le dossier avance dans le circuit judiciaire |

**Scénario principal :**
1. L'agent accède au circuit du dossier
2. Choisit l'étape suivante (ex: Ouverture → Séances)
3. Le frontend envoie `POST /api/juridique/{id}/TransactionJuridique`
4. Le backend crée la transaction et met à jour `EtapeService`

**Circuit en 6 étapes :**
1. **Bureau d'ordre** (مكتب الضبط) — Enregistrement
2. **Ouverture des dossiers** (فتح الملفات) — N° dossier + circuit
3. **Secrétariat particulier** (الكتابة الخاصة) — Préparation audience
4. **Séances & audiences** (الجلسات والإجراءات) — Enquête, expertises
5. **Délivrance & clôture** (تسليم النسخ) — Signification, dépens
6. **Archives** (الأرشيف) — Archivage + retraits

---

### UC-14 : Avancer l'étape judiciaire
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-14 |
| **Nom** | Avancer l'étape judiciaire |
| **Acteurs** | Agent Séances & Procédures, Agent Expertise |
| **Permission requise** | `etape_suivante` (juridique) |

---

### UC-15 : Reculer l'étape judiciaire
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-15 |
| **Nom** | Reculer l'étape judiciaire |
| **Acteurs** | Agent Séances & Procédures, Agent Expertise |
| **Permission requise** | `etape_precedente` (juridique) |

---

### UC-16 : Ouvrir un dossier judiciaire
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-16 |
| **Nom** | Ouvrir un dossier judiciaire |
| **Acteurs** | Agent Ouverture des dossiers |
| **Permission requise** | `ouvrir_dossier` (juridique) |

---

### UC-17 : Clôturer un dossier
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-17 |
| **Nom** | Clôturer un dossier |
| **Acteurs** | Agent Ouverture des dossiers |
| **Permission requise** | `cloturer` (juridique) |

---

<a id="uc-18"></a>
## 4. Transactions & Notifications

### UC-18 : Accepter un transfert
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-18 |
| **Nom** | Accepter un transfert |
| **Acteurs** | Tous les agents de service |
| **Permission requise** | `accepter` (notifications) + **ownership check** |
| **Pré-condition** | La transaction est "En attente" et destinée au service de l'utilisateur |
| **Post-condition** | La transaction est acceptée, le document change de service |

**Scénario principal :**
1. L'agent voit les notifications dans son tableau de bord
2. Clique sur "Accepter" pour une transaction en attente
3. Ajoute éventuellement un commentaire
4. Le frontend envoie `PUT /api/Transactions/{id}/accepter` avec `{commentaire}`
5. Le backend vérifie `accepter` + que la transaction est bien destinée à son service
6. `Statut = Accepte`
7. Si `doitRevenir = true` : le document retourne au service émetteur automatiquement
8. Sinon : `Document.ServiceActuel = ServiceDestination`

**Scénario alternatif A1 :** Transaction déjà traitée → 400 "Cette transaction n'est plus en attente"
**Scénario alternatif A2 :** L'utilisateur n'est pas le destinataire → 403 "Accès refusé"
**Scénario alternatif A3 :** `doitRevenir = true` → création d'une transaction retour automatique + révocation de l'accès receiver

---

### UC-19 : Refuser un transfert
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-19 |
| **Nom** | Refuser un transfert |
| **Acteurs** | Tous les agents de service |
| **Permission requise** | `refuser` (notifications) + **ownership check** |
| **Pré-condition** | La transaction est "En attente" et destinée au service de l'utilisateur |
| **Post-condition** | La transaction est refusée, motif obligatoire, notification au service émetteur |

**Scénario principal :**
1. L'agent clique sur "Refuser"
2. **Doit obligatoirement** saisir un motif de refus
3. Coche éventuellement "Le document doit revenir au service d'origine"
4. Le frontend envoie `PUT /api/Transactions/{id}/refuser` avec `{commentaire, doitRevenir}`
5. Le backend vérifie `refuser` + ownership
6. `Statut = Refuse`, `MotifRefus = commentaire`
7. Si `doitRevenir = true` : le document retourne à l'émetteur
8. Une notification de refus est créée pour le service émetteur

---

### UC-20 : Annuler un transfert
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-20 |
| **Nom** | Annuler un transfert |
| **Acteurs** | Tous les agents de service |
| **Permission requise** | `annuler_transfert` (notifications) |
| **Pré-condition** | La transaction est "En attente" et envoyée par l'utilisateur |
| **Post-condition** | La transaction et les transactions postérieures sont annulées |

**Scénario principal :**
1. L'agent identifie un transfert à annuler dans la liste des transactions
2. Clique sur "Annuler"
3. Le backend annule la transaction + toutes les transactions postérieures pour le même document
4. Le document retourne au service d'origine
5. Les accès DocumentAccess sont révoqués pour le service destinataire

**Note :** Un admin peut annuler n'importe quelle transaction en attente (pas seulement les siens).

---

### UC-21 : Consulter les transactions
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-21 |
| **Nom** | Consulter les transactions |
| **Acteurs** | Tous les agents de service |
| **Permission requise** | `transactions` (autres) |

---

### UC-22 : Voir les notifications + doit-revenir
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-22 |
| **Nom** | Voir les notifications |
| **Acteurs** | Agent Bureau d'ordre, Agent Ouverture, Agent Secrétariat |
| **Permission requise** | Aucune (basée sur le service de l'utilisateur) |

---

<a id="uc-23"></a>
## 5. Recherche & Export

### UC-23 : Recherche avancée
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-23 |
| **Nom** | Recherche avancée de documents |
| **Acteurs** | Tous les agents de service |
| **Permission requise** | `recherche_avancee` (recherche) |

---

### UC-24 : Exporter en Excel
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-24 |
| **Nom** | Exporter en Excel |
| **Acteurs** | Tous les agents de service |
| **Permission requise** | `export_excel` (recherche) |

---

### UC-25 : Exporter en Word
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-25 |
| **Nom** | Exporter en Word |
| **Acteurs** | Tous les agents de service |
| **Permission requise** | `export_word` (recherche) |

---

<a id="uc-26"></a>
## 6. Espace de Travail

### UC-26 : Ouvrir l'espace de travail
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-26 |
| **Nom** | Ouvrir l'espace de travail |
| **Acteurs** | Tous les agents (sauf Tabligh) |
| **Permission requise** | `voir_workspace` (autres) |
| **Pré-condition** | L'utilisateur a accès au document (DocumentAccess) |

**Scénario principal :**
1. L'agent clique sur un document pour ouvrir son espace de travail
2. Trois onglets s'affichent : Informations, Notes, Historique
3. L'espace de travail gère les accès ACL (Owner/Editor/Viewer par service)

---

### UC-27 : Ajouter des notes
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-27 |
| **Nom** | Ajouter des notes |
| **Acteurs** | Agent BO, OD, Sec, Séances, Expertise |
| **Permission requise** | `ajouter_notes` (autres) |

---

### UC-28 : Consulter l'historique
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-28 |
| **Nom** | Consulter l'historique des modifications |
| **Acteurs** | Tous les agents (sauf Tabligh) |
| **Permission requise** | `voir_historique` (autres) |

---

<a id="uc-31"></a>
## 8. Archives & Corbeille

### UC-31 : Archiver un document
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-31 |
| **Nom** | Archiver un document |
| **Acteurs** | Agent Archive |
| **Permission requise** | `archiver` (documents) |
| **Pré-condition** | Le document est dans le service Archive |
| **Post-condition** | `ServiceActuel = Archive, StatutActuel = Archive` |

---

### UC-32 : Voir la corbeille
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-32 |
| **Nom** | Voir la corbeille |
| **Acteurs** | Agent Archive |
| **Permission requise** | `voir_corbeille` (documents) |

---

### UC-33 : Restaurer un document
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-33 |
| **Nom** | Restaurer un document |
| **Acteurs** | Agent Archive |
| **Permission requise** | `restaurer` (documents) |
| **Pré-condition** | Le document est dans la corbeille (EstSupprime = true) |
| **Post-condition** | `EstSupprime = false` |

---

### UC-34 : Supprimer définitivement
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-34 |
| **Nom** | Supprimer définitivement |
| **Acteurs** | Agent Archive |
| **Permission requise** | `supprimer` (documents) |
| **Pré-condition** | Le document est dans la corbeille |
| **Post-condition** | Le document est supprimé physiquement (transactions, accès, fichier) |

---

### UC-35 : Voir les archives
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-35 |
| **Nom** | Voir les archives |
| **Acteurs** | Agent Archive, Délivrance, Notification, Admin |
| **Permission requise** | `archives_view` (autres) |

---

### UC-36 : Enregistrer un retrait de dossier
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-36 |
| **Nom** | Enregistrer un retrait de dossier |
| **Acteurs** | Agent Archive, Chef du greffe, Conseiller rapporteur, 1er président |
| **Permission requise** | `retrait_archive` (juridique) |
| **Pré-condition** | Le dossier est archivé |
| **Post-condition** | Un retrait est enregistré avec autorité, motif, dates |

---

<a id="uc-37"></a>
## 9. Administration RBAC

### UC-37 : Gérer les utilisateurs
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-37 |
| **Nom** | Gérer les utilisateurs |
| **Acteurs** | Administrateur uniquement |
| **Permission requise** | `gerer_utilisateurs` (admin) |
| **Pré-condition** | Admin authentifié |
| **Post-condition** | CRUD complet sur les utilisateurs |

**Scénario principal :**
1. L'admin accède à "Gestion des utilisateurs"
2. Voit la liste des utilisateurs (filtres par nom, login, service)
3. Peut créer : `{nom, login, password, serviceId}`
4. Peut modifier : `{nom, login, password? (optionnel), serviceId}`
5. Peut archiver (soft-delete) : `DELETE /api/Users/{id}`
6. Peut restaurer : `POST /api/Users/{id}/restore`
7. Peut supprimer définitivement : `DELETE /api/Users/{id}/permanent`
8. L'interface "Voir Archives" affiche les utilisateurs archivés avec restauration/suppression

---

### UC-38 : Gérer les services RBAC
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-38 |
| **Nom** | Gérer les services RBAC |
| **Acteurs** | Administrateur uniquement |
| **Permission requise** | `gerer_services` (admin) |

**Scénario principal :**
1. L'admin gère les 9 services RBAC
2. Création : `{nom, code, description}`
3. Modification : mettre à jour les champs
4. Soft-delete : `DELETE /api/rbac/services/{id}` → `IsActive = false`
5. Restauration : `POST /api/rbac/services/{id}/restore`
6. Suppression définitive : `DELETE /api/rbac/services/{id}/permanent`
7. **Règle :** la suppression définitive est bloquée si des utilisateurs sont assignés (400)

---

### UC-39 : Gérer la matrice des permissions
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-39 |
| **Nom** | Gérer la matrice des permissions |
| **Acteurs** | Administrateur uniquement |
| **Permission requise** | `gerer_permissions` (admin) |

**Scénario principal :**
1. L'admin accède à la matrice (service × permission)
2. 9 services × 37 permissions = matrice interactive
3. Pour chaque cellule, l'admin peut activer/désactiver la permission
4. Le frontend envoie `PUT /api/rbac/permissions/service/{id}` avec la liste complète
5. Le backend remplace toutes les `ServicePermission` pour ce service
6. **Impact immédiat :** l'utilisateur re-connecté verra ses permissions changées

---

### UC-40 : Gérer les overrides admin
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-40 |
| **Nom** | Gérer les overrides admin |
| **Acteurs** | Administrateur uniquement |
| **Permission requise** | `gerer_permissions` (admin) |

**Scénario principal :**
1. L'admin gère ses propres restrictions (séparation des tâches)
2. 20 permissions désactivées par défaut (ne peut pas créer, transférer, etc.)
3. L'admin peut activer certaines permissions pour lui-même
4. Le frontend envoie `PUT /api/rbac/permissions/admin`
5. Les overrides sont stockés dans `AdminPermissionOverrides`

---

### UC-41 : Gérer les équipements
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-41 |
| **Nom** | Gérer les équipements |
| **Acteurs** | Administrateur uniquement |
| **Permission requise** | `gerer_equipements` (admin) |

---

### UC-42 : Gérer les listes dynamiques
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-42 |
| **Nom** | Gérer les listes dynamiques |
| **Acteurs** | Administrateur uniquement |
| **Permission requise** | `gerer_listes` (admin) |

---

### UC-43 : Gérer les services historiques
| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-43 |
| **Nom** | Gérer les services historiques |
| **Acteurs** | Administrateur uniquement |
| **Permission requise** | `gerer_services` (admin) |

**Note :** Les services historiques sont des entités d'enregistrement uniquement (pas de login). 16 services historiques seedés : Recherche, Commissaire du roi, Conseiller rapporteur, Règlement des dépens, Secrétariat particulier, Ouverture des dossiers, etc.

---

## Annexe : Mapping Permission → Endpoints API

| Permission | Endpoints protégés |
|------------|-------------------|
| `accepter` | PUT /api/Transactions/{id}/accepter |
| `refuser` | PUT /api/Transactions/{id}/refuser |
| `annuler_transfert` | PUT /api/Transactions/{id}/annuler-transition |
| `transferer` | POST /api/Transfer |
| `transferer_juridique` | POST /api/juridique/{id}/TransactionJuridique, POST /api/ActionsJuridiques |
| `creer_courrier_admin` | POST /api/CourrierAdmin |
| `creer_courrier_juridique` | POST /api/CourrierJuridique |
| `creer_modifier` | POST/PUT /api/CourrierSortant |
| `supprimer` | PATCH /api/Documents/{id}/supprimer, DELETE /api/Documents/{id}/permanent |
| `archiver` | PATCH /api/Documents/{id}/archive, POST /api/Documents/archive-batch |
| `restaurer` | PATCH /api/Documents/{id}/restaurer |
| `voir_corbeille` | GET /api/Documents/corbeille |
| `etape_suivante` | (workflow séances/expertise) |
| `etape_precedente` | (workflow séances/expertise) |
| `ouvrir_dossier` | (ouverture des dossiers) |
| `retrait_archive` | POST /api/Retrait, PATCH /api/Retrait/{id}/annuler |
| `recherche_avancee` | GET /api/search |
| `export_excel` | GET /api/export/excel |
| `export_word` | GET /api/export/word |
| `gerer_utilisateurs` | GET/POST/PUT/DELETE /api/Users |
| `gerer_services` | GET/POST/PUT/DELETE /api/rbac/services |
| `gerer_permissions` | PUT /api/rbac/permissions/service/{id}, PUT /api/rbac/permissions/admin |
| `gerer_equipements` | CRUD /api/Equipment |
| `gerer_listes` | CRUD /api/ListItems |

---

*Document généré automatiquement à partir de l'analyse du code source.*
*Source : SeederService.cs, PermissionService.cs, RequirePermissionAttribute.cs, Controllers, Cypress E2E tests.*
