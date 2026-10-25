using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WebApplication1.Migrations
{
    /// <inheritdoc />
    public partial class DynamicCourrierFieldsAndDelegationPeriod : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "DateAcceptation",
                table: "Substitutes",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DateDebut",
                table: "Substitutes",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "DateFin",
                table: "Substitutes",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MotifRefus",
                table: "Substitutes",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Statut",
                table: "Substitutes",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ChampsPersonnalises",
                table: "Documents",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "CourrierFields",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CourrierType = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    FieldKey = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    LabelFr = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    LabelAr = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    FieldType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsRequired = table.Column<bool>(type: "bit", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsCustom = table.Column<bool>(type: "bit", nullable: false),
                    DisplayOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CourrierFields", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CourrierFields_CourrierType_FieldKey",
                table: "CourrierFields",
                columns: new[] { "CourrierType", "FieldKey" },
                unique: true);

            // ── Carry the pre-existing delegations onto the new status machine ──
            // Delegations written before this migration have no Statut: a running
            // one was simply IsActive. An unlimited running delegation becomes an
            // accepted one with an open-ended period, which is exactly what it was.
            migrationBuilder.Sql(@"
                UPDATE Substitutes
                   SET Statut = CASE WHEN IsActive = 1 THEN 'Accepte' ELSE 'Revoque' END,
                       DateDebut = DateAssignation,
                       DateAcceptation = CASE WHEN IsActive = 1 THEN DateAssignation ELSE NULL END;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CourrierFields");

            migrationBuilder.DropColumn(
                name: "DateAcceptation",
                table: "Substitutes");

            migrationBuilder.DropColumn(
                name: "DateDebut",
                table: "Substitutes");

            migrationBuilder.DropColumn(
                name: "DateFin",
                table: "Substitutes");

            migrationBuilder.DropColumn(
                name: "MotifRefus",
                table: "Substitutes");

            migrationBuilder.DropColumn(
                name: "Statut",
                table: "Substitutes");

            migrationBuilder.DropColumn(
                name: "ChampsPersonnalises",
                table: "Documents");
        }
    }
}
