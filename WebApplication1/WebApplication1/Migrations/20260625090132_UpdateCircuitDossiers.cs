using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WebApplication1.Migrations
{
    /// <inheritdoc />
    public partial class UpdateCircuitDossiers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EstEnRetrait",
                table: "Documents");

            migrationBuilder.RenameColumn(
                name: "Source",
                table: "Documents",
                newName: "Sujet");

            migrationBuilder.RenameColumn(
                name: "ServiceProprietaireId",
                table: "Documents",
                newName: "StatutActuel");

            migrationBuilder.RenameColumn(
                name: "NumeroBureauOrdre",
                table: "Documents",
                newName: "NumeroReference");

            migrationBuilder.RenameColumn(
                name: "DateEnregistrement",
                table: "Documents",
                newName: "DateCreation");

            migrationBuilder.AlterColumn<string>(
                name: "Objet",
                table: "Documents",
                type: "nvarchar(max)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AddColumn<DateTime>(
                name: "DateEntree",
                table: "Documents",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DateReception",
                table: "Documents",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Demandeur",
                table: "Documents",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Discriminator",
                table: "Documents",
                type: "nvarchar(21)",
                maxLength: 21,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DossierJuridique_TypeCircuit",
                table: "Documents",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EtapeJalsatActuelle",
                table: "Documents",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EtatGlobal",
                table: "Documents",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Expediteur",
                table: "Documents",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FilePath",
                table: "Documents",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MotifException",
                table: "Documents",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NumeroDossierJuridique",
                table: "Documents",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NumeroOrdre",
                table: "Documents",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ServiceActuel",
                table: "Documents",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "TypeCircuit",
                table: "Documents",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Transactions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DocumentId = table.Column<int>(type: "int", nullable: false),
                    ServiceOrigine = table.Column<int>(type: "int", nullable: false),
                    ServiceDestination = table.Column<int>(type: "int", nullable: false),
                    DateTransaction = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Remarques = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    UtilisateurId = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Transactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Transactions_Documents_DocumentId",
                        column: x => x.DocumentId,
                        principalTable: "Documents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_DocumentId",
                table: "Transactions",
                column: "DocumentId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Transactions");

            migrationBuilder.DropColumn(
                name: "DateEntree",
                table: "Documents");

            migrationBuilder.DropColumn(
                name: "DateReception",
                table: "Documents");

            migrationBuilder.DropColumn(
                name: "Demandeur",
                table: "Documents");

            migrationBuilder.DropColumn(
                name: "Discriminator",
                table: "Documents");

            migrationBuilder.DropColumn(
                name: "DossierJuridique_TypeCircuit",
                table: "Documents");

            migrationBuilder.DropColumn(
                name: "EtapeJalsatActuelle",
                table: "Documents");

            migrationBuilder.DropColumn(
                name: "EtatGlobal",
                table: "Documents");

            migrationBuilder.DropColumn(
                name: "Expediteur",
                table: "Documents");

            migrationBuilder.DropColumn(
                name: "FilePath",
                table: "Documents");

            migrationBuilder.DropColumn(
                name: "MotifException",
                table: "Documents");

            migrationBuilder.DropColumn(
                name: "NumeroDossierJuridique",
                table: "Documents");

            migrationBuilder.DropColumn(
                name: "NumeroOrdre",
                table: "Documents");

            migrationBuilder.DropColumn(
                name: "ServiceActuel",
                table: "Documents");

            migrationBuilder.DropColumn(
                name: "TypeCircuit",
                table: "Documents");

            migrationBuilder.RenameColumn(
                name: "Sujet",
                table: "Documents",
                newName: "Source");

            migrationBuilder.RenameColumn(
                name: "StatutActuel",
                table: "Documents",
                newName: "ServiceProprietaireId");

            migrationBuilder.RenameColumn(
                name: "NumeroReference",
                table: "Documents",
                newName: "NumeroBureauOrdre");

            migrationBuilder.RenameColumn(
                name: "DateCreation",
                table: "Documents",
                newName: "DateEnregistrement");

            migrationBuilder.AlterColumn<string>(
                name: "Objet",
                table: "Documents",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "EstEnRetrait",
                table: "Documents",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }
    }
}
