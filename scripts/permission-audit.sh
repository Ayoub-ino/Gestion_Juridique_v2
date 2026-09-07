#!/usr/bin/env bash
# Live RBAC permission audit.
# Rule: permission ENABLED  -> response must NOT be 403 (and NOT 401)
#       permission DISABLED -> response MUST be 403 (401 for missing/bad tokens)
# The script is self-contained: it creates its own courriers/transfers/dossiers
# so the ownership-sensitive checks (accepter, refuser, transferer_juridique)
# always act on data owned by the acting user's service.
set -u
BASE="http://localhost:5200"
PASS=0; FAIL=0

token_of() { # $1=login $2=password
  curl -s "$BASE/api/auth/login" -X POST -H "Content-Type: application/json" \
    -d "{\"Login\":\"$1\",\"Password\":\"$2\"}" | grep -o '"token":"[^"]*"' | cut -d'"' -f4
}

ADMIN=$(token_of admin admin123)
BO=$(token_of bureauordre bureauordre123)
FATH=$(token_of fathmilafat fathmilafat123)
SECR=$(token_of secretarait secretarait123)
ARCH=$(token_of archive archive123)

check() { # $1=name $2=expected_blocked(yes=401/403) $3=code
  local name="$1" expect="$2" code="$3"
  if [ "$expect" = "yes" ] && { [ "$code" = "403" ] || [ "$code" = "401" ]; }; then
    PASS=$((PASS+1)); echo "PASS [blocked ✓] $name -> $code"
  elif [ "$expect" = "no" ] && [ "$code" != "403" ] && [ "$code" != "401" ]; then
    PASS=$((PASS+1)); echo "PASS [open ✓] $name -> $code"
  else
    FAIL=$((FAIL+1)); echo "FAIL [$name expected $expect got $code]"
  fi
}

# ---- owned-data helpers ----
create_courrier_admin() { # $1=token -> prints courrier id
  curl -s -X POST "$BASE/api/CourrierAdmin" -H "Authorization: Bearer $1" \
    -H 'Content-Type: application/json' \
    -d "{\"NumeroOrdre\":\"AUDIT-$RANDOM-$(date +%s)\",\"Expediteur\":\"Audit\",\"Objet\":\"Audit script\"}" \
    | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2
}
transfer_to() { # $1=token $2=documentId $3=destination -> prints first transaction id
  curl -s -X POST "$BASE/api/Transfer" -H "Authorization: Bearer $1" \
    -H 'Content-Type: application/json' \
    -d "{\"documentId\":$2,\"documentType\":\"entrant-admin\",\"serviceDestination\":\"$3\"}" \
    | grep -o '"transactionIds":\[[0-9]*' | grep -o '[0-9]*$'
}
create_juridique() { # $1=token -> prints dossier id
  curl -s -X POST "$BASE/api/CourrierJuridique" -H "Authorization: Bearer $1" \
    -H 'Content-Type: application/json' \
    -d "{\"Reference\":\"AUDIT-$RANDOM-$(date +%s)\",\"Objet\":\"Audit script\"}" \
    | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2
}

# ---------- creer_modifier (POST /api/CourrierSortant) ----------
check "bureauordre creer_modifier ENABLED" no   "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/CourrierSortant" -H "Authorization: Bearer $BO" -H 'Content-Type: application/json' -d '{}')"
check "secretarait creer_modifier DISABLED" yes "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/CourrierSortant" -H "Authorization: Bearer $SECR" -H 'Content-Type: application/json' -d '{}')"
check "admin creer_modifier OVERRIDE-DISABLED" yes "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/CourrierSortant" -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{}')"

# ---------- creer_courrier_admin (POST /api/CourrierAdmin) ----------
check "bureauordre creer_courrier_admin ENABLED" no   "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/CourrierAdmin" -H "Authorization: Bearer $BO" -H 'Content-Type: application/json' -d '{}')"
check "fathmilafat creer_courrier_admin DISABLED" yes "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/CourrierAdmin" -H "Authorization: Bearer $FATH" -H 'Content-Type: application/json' -d '{}')"
check "admin creer_courrier_admin OVERRIDE-DISABLED" yes "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/CourrierAdmin" -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{}')"

# ---------- creer_courrier_juridique (POST /api/CourrierJuridique) ----------
check "fathmilafat creer_courrier_juridique ENABLED" no   "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/CourrierJuridique" -H "Authorization: Bearer $FATH" -H 'Content-Type: application/json' -d '{}')"
check "bureauordre creer_courrier_juridique DISABLED" yes "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/CourrierJuridique" -H "Authorization: Bearer $BO" -H 'Content-Type: application/json' -d '{}')"

# ---------- supprimer (DELETE /api/CourrierAdmin/99999) ----------
check "bureauordre supprimer ENABLED" no   "$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$BASE/api/CourrierAdmin/99999" -H "Authorization: Bearer $BO")"
check "secretarait supprimer DISABLED" yes "$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$BASE/api/CourrierAdmin/99999" -H "Authorization: Bearer $SECR")"
check "admin supprimer OVERRIDE-DISABLED" yes "$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$BASE/api/CourrierAdmin/99999" -H "Authorization: Bearer $ADMIN")"

# ---------- transferer (POST /api/Transfer) ----------
CA_T=$(create_courrier_admin "$BO")
check "bureauordre transferer ENABLED" no   "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/Transfer" -H "Authorization: Bearer $BO" -H 'Content-Type: application/json' -d "{\"documentId\":$CA_T,\"documentType\":\"entrant-admin\",\"serviceDestination\":\"Archive\"}")"
check "archive transferer DISABLED" yes "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/Transfer" -H "Authorization: Bearer $ARCH" -H 'Content-Type: application/json' -d '{"documentId":1,"documentType":"entrant-admin","serviceDestination":"Archive"}')"

# ---------- archiver (POST /api/Documents/archive-batch) ----------
check "archive archiver ENABLED" no   "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/Documents/archive-batch" -H "Authorization: Bearer $ARCH" -H 'Content-Type: application/json' -d '{"ids":[]}')"
check "bureauordre archiver ENABLED" no   "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/Documents/archive-batch" -H "Authorization: Bearer $BO" -H 'Content-Type: application/json' -d '{"ids":[]}')"

# ---------- transferer_juridique (POST /api/juridique/{id}/TransactionJuridique) ----------
DJ=$(create_juridique "$FATH")
check "fathmilafat transferer_juridique ENABLED (owned dossier)" no   "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/juridique/$DJ/TransactionJuridique" -H "Authorization: Bearer $FATH" -H 'Content-Type: application/json' -d '{}')"
check "bureauordre transferer_juridique DISABLED" yes "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/juridique/$DJ/TransactionJuridique" -H "Authorization: Bearer $BO" -H 'Content-Type: application/json' -d '{}')"

# ---------- accepter (PUT /api/Transactions/{id}/accepter) — owned tx ----------
CA_A=$(create_courrier_admin "$BO")
TX_A=$(transfer_to "$BO" "$CA_A" "Archive")
check "archive accepter ENABLED (owned tx)" no   "$(curl -s -o /dev/null -w '%{http_code}' -X PUT "$BASE/api/Transactions/$TX_A/accepter" -H "Authorization: Bearer $ARCH" -H 'Content-Type: application/json' -d '{}')"
check "admin accepter OVERRIDE-DISABLED" yes "$(curl -s -o /dev/null -w '%{http_code}' -X PUT "$BASE/api/Transactions/$TX_A/accepter" -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{}')"

# ---------- refuser (PUT /api/Transactions/{id}/refuser) — owned tx ----------
CA_R=$(create_courrier_admin "$BO")
TX_R=$(transfer_to "$BO" "$CA_R" "Archive")
check "archive refuser ENABLED (owned tx)" no   "$(curl -s -o /dev/null -w '%{http_code}' -X PUT "$BASE/api/Transactions/$TX_R/refuser" -H "Authorization: Bearer $ARCH" -H 'Content-Type: application/json' -d '{}')"
check "admin refuser OVERRIDE-DISABLED" yes "$(curl -s -o /dev/null -w '%{http_code}' -X PUT "$BASE/api/Transactions/$TX_R/refuser" -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{}')"

# ---------- retrait_archive (POST /api/Retrait) ----------
check "archive retrait_archive ENABLED" no   "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/Retrait" -H "Authorization: Bearer $ARCH" -H 'Content-Type: application/json' -d '{"documentId":1}')"
check "bureauordre retrait_archive DISABLED" yes "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/Retrait" -H "Authorization: Bearer $BO" -H 'Content-Type: application/json' -d '{"documentId":1}')"

# ---------- ajouter_notes (POST /api/Workspace/document/1/notes) ----------
check "fathmilafat ajouter_notes ENABLED" no   "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/Workspace/document/1/notes" -H "Authorization: Bearer $FATH" -H 'Content-Type: application/json' -d '{"contenu":"audit"}')"
check "admin ajouter_notes OVERRIDE-DISABLED" yes "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/Workspace/document/1/notes" -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{"contenu":"audit"}')"

# ---------- restaurer (PATCH /api/Documents/{id}/restaurer) ----------
check "archive restaurer ENABLED" no   "$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "$BASE/api/Documents/1/restaurer" -H "Authorization: Bearer $ARCH" -H 'Content-Type: application/json' -d '{}')"
check "bureauordre restaurer DISABLED" yes "$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "$BASE/api/Documents/1/restaurer" -H "Authorization: Bearer $BO" -H 'Content-Type: application/json' -d '{}')"
check "admin restaurer OVERRIDE-DISABLED" yes "$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "$BASE/api/Documents/1/restaurer" -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{}')"

# ---------- voir_corbeille (GET /api/Documents/corbeille) ----------
check "archive voir_corbeille ENABLED" no   "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/Documents/corbeille" -H "Authorization: Bearer $ARCH")"
check "bureauordre voir_corbeille DISABLED" yes "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/Documents/corbeille" -H "Authorization: Bearer $BO")"
# admin is an overseer: voir_corbeille (view) is NOT in the 20-key override list — only restaurer (action) is disabled
check "admin voir_corbeille ENABLED (view perm, not overridden)" no   "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/Documents/corbeille" -H "Authorization: Bearer $ADMIN")"

# ---------- gerer_services (POST /api/Services) — admin-only, no override ----------
check "admin gerer_services ENABLED" no   "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/Services" -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{}')"
check "bureauordre gerer_services DISABLED" yes "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/Services" -H "Authorization: Bearer $BO" -H 'Content-Type: application/json' -d '{}')"

# ---------- gerer_equipements (POST /api/Equipment) — admin-only, no override ----------
check "admin gerer_equipements ENABLED" no   "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/Equipment" -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{}')"
check "bureauordre gerer_equipements DISABLED" yes "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/Equipment" -H "Authorization: Bearer $BO" -H 'Content-Type: application/json' -d '{}')"

# ---------- gerer_listes (POST /api/ListItems) — admin-only, no override ----------
check "admin gerer_listes ENABLED" no   "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/ListItems" -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{}')"
check "bureauordre gerer_listes DISABLED" yes "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/ListItems" -H "Authorization: Bearer $BO" -H 'Content-Type: application/json' -d '{}')"

# ---------- gerer_permissions (GET /api/rbac/permissions/matrix) — admin-only, no override ----------
# NOTE: must use the non-destructive GET; PUT /admin deletes ALL overrides (write check would corrupt the matrix)
check "admin gerer_permissions ENABLED" no   "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/rbac/permissions/matrix" -H "Authorization: Bearer $ADMIN")"
check "bureauordre gerer_permissions DISABLED" yes "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/rbac/permissions/matrix" -H "Authorization: Bearer $BO")"

# ---------- gerer_utilisateurs (GET /api/Users) + open /actifs for substitute picker ----------
check "admin gerer_utilisateurs ENABLED" no   "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/Users" -H "Authorization: Bearer $ADMIN")"
check "bureauordre gerer_utilisateurs DISABLED" yes "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/Users" -H "Authorization: Bearer $BO")"
check "bureauordre GET /api/Users/actifs OPEN (substitute picker)" no   "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/Users/actifs" -H "Authorization: Bearer $BO")"

# ---------- /api/auth/me (permission refresh endpoint) ----------
check "any-user /api/auth/me ENABLED" no   "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/auth/me" -H "Authorization: Bearer $BO")"

# ---------- no token / invalid token ----------
check "no-token blocked (401)" yes "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/Transfer" -H 'Content-Type: application/json' -d '{}')"
check "garbage-token blocked (401)" yes "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/Transfer" -H "Authorization: Bearer garbage" -H 'Content-Type: application/json' -d '{}')"

# ---------- admin overrides endpoint (matrix integrity) ----------
OVERRIDES=$(curl -s "$BASE/api/rbac/permissions/admin" -H "Authorization: Bearer $ADMIN")
N_DISABLED=$(echo "$OVERRIDES" | grep -o '"enabled":false\|"Enabled":false' | wc -l)
echo "INFO: admin override matrix contains $N_DISABLED disabled permissions"
[ "$N_DISABLED" -ge 20 ] && { PASS=$((PASS+1)); echo "PASS admin override matrix >= 20 disabled"; } || { FAIL=$((FAIL+1)); echo "FAIL admin override matrix only $N_DISABLED"; }

echo ""
echo "======================================"
echo "RESULT: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && echo "ALL PERMISSION CHECKS PASSED" || echo "SOME CHECKS FAILED"
exit $FAIL
