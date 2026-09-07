using System;
using System.Text.Json;

namespace WebApplication1.Models
{
    public class ActionJuridique
    {
        public int Id { get; set; }

        // Clé étrangère vers le dossier juridique
        public int DossierId { get; set; }
        public DossierJuridique Dossier { get; set; } = null!;

        // Service concerné (ex: "BureauOrdre", "JalsatWaIjra2at")
        public string Service { get; set; } = string.Empty;

        // Type d'action (ex: "Enregistrement", "Attribution", "Validation", "Transaction")
        public string Action { get; set; } = string.Empty;

        // Commentaire optionnel
        public string? Commentaire { get; set; }

        // Statut de l'action (ex: "En attente", "En cours", "Effectué")
        public string? Statut { get; set; }

        // Nom de l'utilisateur qui a effectué l'action
        public string? Utilisateur { get; set; }

        // Date de l'action
        public DateTime DateAction { get; set; } = DateTime.Now;

        // Données additionnelles au format JSON (ex: { "NumeroDossier": "2026/12345", "Conseiller": "M. X" })
        public string? Donnees { get; set; }

        // Méthode utilitaire pour sérialiser les données en JSON
        public void SetDonnees<T>(T data)
        {
            Donnees = JsonSerializer.Serialize(data);
        }

        // Méthode utilitaire pour désérialiser les données depuis JSON
        public T? GetDonnees<T>()
        {
            if (string.IsNullOrEmpty(Donnees)) return default;
            return JsonSerializer.Deserialize<T>(Donnees);
        }
    }
}