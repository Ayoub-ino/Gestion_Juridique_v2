using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WebApplication1.Migrations
{
    /// <inheritdoc />
    public partial class Overhaul_Part1 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "Utilisateurs",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "Utilisateurs",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "StatutPrecedent",
                table: "Transactions",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TargetUserId",
                table: "Transactions",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Bureau",
                table: "Equipment",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NumeroInventaire",
                table: "Equipment",
                type: "nvarchar(450)",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_TargetUserId",
                table: "Transactions",
                column: "TargetUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Equipment_NumeroInventaire",
                table: "Equipment",
                column: "NumeroInventaire",
                unique: true,
                filter: "[NumeroInventaire] IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_Transactions_Utilisateurs_TargetUserId",
                table: "Transactions",
                column: "TargetUserId",
                principalTable: "Utilisateurs",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Transactions_Utilisateurs_TargetUserId",
                table: "Transactions");

            migrationBuilder.DropIndex(
                name: "IX_Transactions_TargetUserId",
                table: "Transactions");

            migrationBuilder.DropIndex(
                name: "IX_Equipment_NumeroInventaire",
                table: "Equipment");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "Utilisateurs");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "Utilisateurs");

            migrationBuilder.DropColumn(
                name: "StatutPrecedent",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "TargetUserId",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "Bureau",
                table: "Equipment");

            migrationBuilder.DropColumn(
                name: "NumeroInventaire",
                table: "Equipment");
        }
    }
}
