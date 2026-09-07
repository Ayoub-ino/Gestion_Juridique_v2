-- ============================================================================
--  GRANT NEW RBAC PERMISSIONS ON AN EXISTING DATABASE (idempotent)
-- ============================================================================
--  Contexte : les permissions décorées côté API ([RequirePermission]) exigent
--  que les clés soient accordées aux services. Le SeederService (Program.cs) ne
--  s'exécute que sur base vide ; pour une base EXISTANTE, exécuter ce script.
--
--  Usage (depuis la racine du dépôt, en bash) :
--    sqlcmd -S "(localdb)\MSSQLLocalDB" -d GestionJuridiqueDB -i scripts/grant-permissions-existing-db.sql
--  (ou exécuter via SQL Server Management Studio)
--
--  Le script est IDEMPOTENT : il peut être relancé sans risque.
--  Matrice alignée sur Services/SeederService.cs (Session G du CHANGELOG).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Garantir que les clés existent dans la table master Permissions
-- ----------------------------------------------------------------------------
INSERT INTO Permissions ([Key], LabelFr, LabelAr, Category, DefaultEnabled)
SELECT v.[Key], v.LabelFr, v.LabelAr, v.Category, v.DefaultEnabled
FROM (VALUES
    ('creer_courrier_admin',      N'Créer courrier administratif', N'إنشاء رسالة إدارية', 'documents',  1),
    ('creer_courrier_juridique',  N'Créer dossier juridique',      N'إنشاء ملف قضائي',    'documents',  1),
    ('supprimer',                 N'Supprimer',                    N'حذف',                 'documents',  0),
    ('transferer_juridique',      N'Transférer juridique',         N'تحويل قضائي',        'juridique',  1),
    ('ajouter_notes',             N'Ajouter notes',                N'إضافة ملاحظات',      'autres',     1)
) v([Key], LabelFr, LabelAr, Category, DefaultEnabled)
WHERE NOT EXISTS (SELECT 1 FROM Permissions p WHERE p.[Key] = v.[Key]);

-- ----------------------------------------------------------------------------
-- 2. Accorder les permissions par service (idempotent)
-- ----------------------------------------------------------------------------

-- bureauordre : + creer_courrier_admin, supprimer, ajouter_notes
INSERT INTO ServicePermissions (ServiceId, PermissionKey, Enabled)
SELECT s.Id, v.[Key], 1
FROM RbacServices s
CROSS APPLY (VALUES ('creer_courrier_admin'), ('supprimer'), ('ajouter_notes')) v([Key])
WHERE s.Code = 'bureauordre'
  AND NOT EXISTS (SELECT 1 FROM ServicePermissions sp WHERE sp.ServiceId = s.Id AND sp.PermissionKey = v.[Key]);

-- fathmilafat : + creer_courrier_juridique, transferer_juridique, ajouter_notes
INSERT INTO ServicePermissions (ServiceId, PermissionKey, Enabled)
SELECT s.Id, v.[Key], 1
FROM RbacServices s
CROSS APPLY (VALUES ('creer_courrier_juridique'), ('transferer_juridique'), ('ajouter_notes')) v([Key])
WHERE s.Code = 'fathmilafat'
  AND NOT EXISTS (SELECT 1 FROM ServicePermissions sp WHERE sp.ServiceId = s.Id AND sp.PermissionKey = v.[Key]);

-- seances&procedures : + transferer_juridique, ajouter_notes
INSERT INTO ServicePermissions (ServiceId, PermissionKey, Enabled)
SELECT s.Id, v.[Key], 1
FROM RbacServices s
CROSS APPLY (VALUES ('transferer_juridique'), ('ajouter_notes')) v([Key])
WHERE s.Code = 'seances&procedures'
  AND NOT EXISTS (SELECT 1 FROM ServicePermissions sp WHERE sp.ServiceId = s.Id AND sp.PermissionKey = v.[Key]);

-- khibra : + transferer_juridique
INSERT INTO ServicePermissions (ServiceId, PermissionKey, Enabled)
SELECT s.Id, v.[Key], 1
FROM RbacServices s
CROSS APPLY (VALUES ('transferer_juridique')) v([Key])
WHERE s.Code = 'khibra'
  AND NOT EXISTS (SELECT 1 FROM ServicePermissions sp WHERE sp.ServiceId = s.Id AND sp.PermissionKey = v.[Key]);

-- taslimnosakh : + transferer_juridique
INSERT INTO ServicePermissions (ServiceId, PermissionKey, Enabled)
SELECT s.Id, v.[Key], 1
FROM RbacServices s
CROSS APPLY (VALUES ('transferer_juridique')) v([Key])
WHERE s.Code = 'taslimnosakh'
  AND NOT EXISTS (SELECT 1 FROM ServicePermissions sp WHERE sp.ServiceId = s.Id AND sp.PermissionKey = v.[Key]);

-- tasfiatSawa2irTakmilia : + transferer_juridique
INSERT INTO ServicePermissions (ServiceId, PermissionKey, Enabled)
SELECT s.Id, v.[Key], 1
FROM RbacServices s
CROSS APPLY (VALUES ('transferer_juridique')) v([Key])
WHERE s.Code = 'tasfiatSawa2irTakmilia'
  AND NOT EXISTS (SELECT 1 FROM ServicePermissions sp WHERE sp.ServiceId = s.Id AND sp.PermissionKey = v.[Key]);

-- archive : + supprimer, transferer_juridique
INSERT INTO ServicePermissions (ServiceId, PermissionKey, Enabled)
SELECT s.Id, v.[Key], 1
FROM RbacServices s
CROSS APPLY (VALUES ('supprimer'), ('transferer_juridique')) v([Key])
WHERE s.Code = 'archive'
  AND NOT EXISTS (SELECT 1 FROM ServicePermissions sp WHERE sp.ServiceId = s.Id AND sp.PermissionKey = v.[Key]);

-- atabligh : + transferer_juridique
INSERT INTO ServicePermissions (ServiceId, PermissionKey, Enabled)
SELECT s.Id, v.[Key], 1
FROM RbacServices s
CROSS APPLY (VALUES ('transferer_juridique')) v([Key])
WHERE s.Code = 'atabligh'
  AND NOT EXISTS (SELECT 1 FROM ServicePermissions sp WHERE sp.ServiceId = s.Id AND sp.PermissionKey = v.[Key]);

-- ----------------------------------------------------------------------------
-- 3. Réactiver les permissions de la matrice désactivées manuellement
--    (la matrice seed fait autorité pour ces clés)
-- ----------------------------------------------------------------------------
UPDATE sp SET sp.Enabled = 1
FROM ServicePermissions sp
INNER JOIN RbacServices s ON s.Id = sp.ServiceId
WHERE (
       (s.Code = 'bureauordre'            AND sp.PermissionKey IN ('creer_courrier_admin','supprimer','ajouter_notes'))
    OR (s.Code = 'fathmilafat'            AND sp.PermissionKey IN ('creer_courrier_juridique','transferer_juridique','ajouter_notes'))
    OR (s.Code = 'seances&procedures'     AND sp.PermissionKey IN ('transferer_juridique','ajouter_notes'))
    OR (s.Code = 'khibra'                 AND sp.PermissionKey = 'transferer_juridique')
    OR (s.Code = 'taslimnosakh'           AND sp.PermissionKey = 'transferer_juridique')
    OR (s.Code = 'tasfiatSawa2irTakmilia' AND sp.PermissionKey = 'transferer_juridique')
    OR (s.Code = 'archive'                AND sp.PermissionKey IN ('supprimer','transferer_juridique'))
    OR (s.Code = 'atabligh'               AND sp.PermissionKey = 'transferer_juridique')
   )
  AND sp.Enabled = 0;

-- ----------------------------------------------------------------------------
-- Vérification : nombre de lignes accordées
-- ----------------------------------------------------------------------------
SELECT s.Code, COUNT(sp.Id) AS NbPermissions
FROM RbacServices s
LEFT JOIN ServicePermissions sp ON sp.ServiceId = s.Id
GROUP BY s.Code
ORDER BY s.Code;
