using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WebApplication1.Migrations
{
    /// <inheritdoc />
    public partial class AddSubstitutionAuditAndRetraitAuthority : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AutoriteDemandeuse",
                table: "Retraits",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "SaisiPar",
                table: "Retraits",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "SubstitutionActions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EffectueParUserId = table.Column<int>(type: "int", nullable: false),
                    PourUserId = table.Column<int>(type: "int", nullable: false),
                    Action = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DocumentId = table.Column<int>(type: "int", nullable: true),
                    Reference = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DateAction = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SubstitutionActions", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SubstitutionActions");

            migrationBuilder.DropColumn(
                name: "AutoriteDemandeuse",
                table: "Retraits");

            migrationBuilder.DropColumn(
                name: "SaisiPar",
                table: "Retraits");
        }
    }
}
