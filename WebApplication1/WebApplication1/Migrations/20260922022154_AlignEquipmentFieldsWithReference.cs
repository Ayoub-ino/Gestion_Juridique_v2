using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WebApplication1.Migrations
{
    /// <inheritdoc />
    public partial class AlignEquipmentFieldsWithReference : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Equipment_NumeroInventaire",
                table: "Equipment");

            migrationBuilder.DropColumn(
                name: "Code",
                table: "Equipment");

            migrationBuilder.DropColumn(
                name: "NumeroInventaire",
                table: "Equipment");

            // Dropped outright rather than renamed into AdditionalInfo: the two
            // mean different things, so carrying a "Bureau" value across would
            // silently mislabel it. The new field starts empty.
            migrationBuilder.DropColumn(
                name: "Bureau",
                table: "Equipment");

            migrationBuilder.AddColumn<string>(
                name: "AdditionalInfo",
                table: "Equipment",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AdditionalInfo",
                table: "Equipment");

            migrationBuilder.AddColumn<string>(
                name: "Bureau",
                table: "Equipment",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Code",
                table: "Equipment",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "NumeroInventaire",
                table: "Equipment",
                type: "nvarchar(450)",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Equipment_NumeroInventaire",
                table: "Equipment",
                column: "NumeroInventaire",
                unique: true,
                filter: "[NumeroInventaire] IS NOT NULL");
        }
    }
}
